import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { DsPriorityBadge, DsStatusPill, DsTone } from '../../shared/ui';
import { CustomerService } from '../customer-search/customer.service';
import {
  ActivityRange,
  CustomerActivityResponse,
  CustomerDetail,
  CustomerDiagnosis,
  EnrollmentStatus,
  SensitiveField,
} from '../customer-search/customer.models';
import { TICKET_STATUS, TicketService, isDone, readApiError, ticketNo, titleCase, toDsPriority } from '../my-tickets/ticket.service';
import { ApiPlatform, CustomerTicketsResponse } from '../my-tickets/ticket.models';

type Tab = 'activity' | 'tickets';

const RANGES: { id: ActivityRange; label: string }[] = [
  { id: 'LAST_6_HOURS', label: 'Last 6 hours' },
  { id: 'TODAY', label: 'Today' },
  { id: 'LAST_7_DAYS', label: '7 days' },
];

@Component({
  selector: 'app-customer-360',
  imports: [DatePipe, RouterLink, DsStatusPill, DsPriorityBadge],
  templateUrl: './customer-360.html',
})
export class Customer360 {
  private service = inject(CustomerService);
  private ticketService = inject(TicketService);
  private router = inject(Router);

  /** From the URL /customer-search/:cif (withComponentInputBinding). */
  cif = input.required<string>();

  // ---------- the customer (GET /api/customers/{cif}) ----------
  customer = signal<CustomerDetail | null>(null);
  /** not-verified = 403 CALLER_NOT_VERIFIED: the server hides the customer until the caller passes. */
  state = signal<'loading' | 'ready' | 'not-verified' | 'not-found' | 'error'>('loading');
  loadError = signal('');

  // ---------- tickets (GET /api/customers/{cif}/tickets) ----------
  private customerTickets = signal<CustomerTicketsResponse | null>(null);
  tickets = computed(() => this.customerTickets()?.tickets ?? []);
  repeatCaller = computed(() => this.customerTickets()?.repeatCaller ?? false);
  repeatCallerNote = computed(() => this.customerTickets()?.repeatCallerNote ?? '');

  // ---------- diagnosis (GET /api/customers/{cif}/diagnosis) ----------
  diagnosis = signal<CustomerDiagnosis | null>(null);

  // ---------- activity log (GET /api/customers/{cif}/activity) ----------
  tab = signal<Tab>('activity');
  ranges = RANGES;
  range = signal<ActivityRange>('LAST_6_HOURS');
  failuresOnly = signal(false);
  platform = signal<ApiPlatform | 'ALL'>('ALL');
  platforms: { id: ApiPlatform | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'MOBILE', label: 'Mobile' },
    { id: 'WEB', label: 'Web' },
  ];
  activity = signal<CustomerActivityResponse | null>(null);
  activityLoading = signal(false);
  activityError = signal('');
  events = computed(() => this.activity()?.events ?? []);

  /** Everything the activity request depends on. A change → a new request. */
  private activityQuery = computed(() => ({
    cif: this.cif(),
    ready: this.state() === 'ready',
    range: this.range(),
    failuresOnly: this.failuresOnly(),
    platform: this.platform() === 'ALL' ? undefined : (this.platform() as ApiPlatform),
  }));

  // ---------- profile: masked until revealed (POST /reveal, audited) ----------
  revealed = signal<Partial<Record<SensitiveField, string>>>({});
  revealing = signal<SensitiveField | null>(null);
  revealError = signal('');

  ending = signal(false);

  enrollment: Record<EnrollmentStatus, { label: string; tone: DsTone }> = {
    ENROLLED: { label: 'Active', tone: 'success' },
    SUSPENDED: { label: 'Suspended', tone: 'danger' },
    NOT_ENROLLED: { label: 'Not enrolled', tone: 'neutral' },
  };
  ticketStatus = TICKET_STATUS;
  isDone = isDone;
  no = ticketNo;
  priority = toDsPriority;
  titleCase = titleCase;

  constructor() {
    // A new CIF in the URL → load the header. Only when the server shows it, load the rest.
    toObservable(this.cif)
      .pipe(
        tap(() => {
          this.state.set('loading');
          this.customer.set(null);
          this.revealed.set({});
        }),
        switchMap(cif =>
          this.service.get(cif).pipe(
            catchError(err => {
              const e = readApiError(err);
              this.state.set(
                e.code === 'CALLER_NOT_VERIFIED' ? 'not-verified' : e.status === 404 ? 'not-found' : 'error',
              );
              this.loadError.set(e.message);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(c => {
        this.customer.set(c);
        this.state.set('ready');
        this.ticketService.forCustomer(c.cif).pipe(catchError(() => of(null))).subscribe(r => this.customerTickets.set(r));
        this.service.diagnosis(c.cif).pipe(catchError(() => of(null))).subscribe(d => this.diagnosis.set(d));
      });

    // Filters changed → ask for the activity again. switchMap drops a slower older request.
    toObservable(this.activityQuery)
      .pipe(
        switchMap(q => {
          if (!q.ready) return EMPTY;
          this.activityLoading.set(true);
          this.activityError.set('');
          return this.service.activity(q.cif, q).pipe(
            catchError(err => {
              this.activityError.set(readApiError(err).message);
              return of(null);
            }),
            finalize(() => this.activityLoading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(a => this.activity.set(a));
  }

  // ---------- derived ----------
  nationalId = computed(() => this.revealed().NATIONAL_ID ?? this.customer()?.maskedNationalId ?? '');
  mobile = computed(() => this.revealed().MOBILE ?? this.customer()?.maskedMobile ?? '');

  initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  isToday(iso: string) {
    return new Date(iso).toDateString() === new Date().toDateString();
  }

  // ---------- actions ----------
  reveal(field: SensitiveField) {
    if (this.revealing()) return;
    this.revealing.set(field);
    this.revealError.set('');
    this.service
      .reveal(this.cif(), field)
      .pipe(finalize(() => this.revealing.set(null)))
      .subscribe({
        next: r => this.revealed.update(v => ({ ...v, [r.field]: r.value })),
        error: err => this.revealError.set(readApiError(err).message),
      });
  }

  /** Locks the customer again on the server, then goes back to the search. */
  endVerification() {
    if (this.ending()) return;
    this.ending.set(true);
    this.service
      .endCall(this.cif())
      .pipe(finalize(() => this.ending.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/customer-search']),
        error: () => this.router.navigate(['/customer-search']),
      });
  }

  createTicket() {
    this.router.navigate(['/customer-search', this.cif(), 'new-ticket']);
  }
}
