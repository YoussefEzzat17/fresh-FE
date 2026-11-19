import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { DsPriorityBadge, DsStatusPill, DsTone } from '../../shared/ui';
import { CustomerService } from '../customer-search/customer.service';
import { TICKET_STATUS, TicketService, isDone, ticketNo, toDsPriority } from '../my-tickets/ticket.service';
import { CustomerTicketsResponse } from '../my-tickets/ticket.models';import {
  DigitalStatus,
  Platform,
  maskMobile,
  maskNationalId,
} from '../customer-search/customer.models';

type Tab = 'activity' | 'tickets';
type RangeId = '6h' | 'today' | '7d';

const RANGES: { id: RangeId; label: string; minutes: number }[] = [
  { id: '6h', label: 'Last 6 hours', minutes: 6 * 60 },
  { id: 'today', label: 'Today', minutes: 24 * 60 },
  { id: '7d', label: '7 days', minutes: 7 * 24 * 60 },
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

  customer = computed(() => this.service.getByCif(this.cif()));
  verified = computed(() => this.service.isVerified(this.cif()));
  verifiedAt = computed(() => this.service.verifiedTime(this.cif()));
  /** From GET /api/customers/{cif}/tickets. Empty if the server refuses (e.g. caller not verified there). */
  private customerTickets = signal<CustomerTicketsResponse | null>(null);
  tickets = computed(() => this.customerTickets()?.tickets ?? []);
  repeatCaller = computed(() => this.customerTickets()?.repeatCaller ?? false);
  repeatCallerNote = computed(() => this.customerTickets()?.repeatCallerNote ?? '');
  activity = computed(() => this.service.activityFor(this.cif()));

  // ---------- activity log filters ----------
  tab = signal<Tab>('activity');
  ranges = RANGES;
  range = signal<RangeId>('6h');
  failuresOnly = signal(false);
  platform = signal<Platform | 'all'>('all');

  inRange = computed(() => {
    const minutes = RANGES.find(r => r.id === this.range())!.minutes;
    const from = Date.now() - minutes * 60_000;
    return this.activity().filter(e => e.at.getTime() >= from);
  });

  visible = computed(() =>
    this.inRange().filter(
      e =>
        (!this.failuresOnly() || e.failed) &&
        (this.platform() === 'all' || e.platform === this.platform()),
    ),
  );

  failedCount = computed(() => this.inRange().filter(e => e.failed).length);
  hiddenCount = computed(() => this.inRange().length - this.visible().length);

  // ---------- profile ----------
  showNationalId = signal(false);
  showMobile = signal(false);

  nationalId = computed(() => {
    const c = this.customer();
    if (!c) return '';
    return this.showNationalId() ? c.nationalId : maskNationalId(c.nationalId);
  });

  mobile = computed(() => {
    const c = this.customer();
    if (!c) return '';
    return this.showMobile() ? c.mobile : maskMobile(c.mobile);
  });

  /** More than one ticket in the last 20 days. */

  statusTone: Record<DigitalStatus, DsTone> = { active: 'success', locked: 'danger', inactive: 'neutral' };

  ticketStatus = TICKET_STATUS;
  isDone = isDone;
  no = ticketNo;
  priority = toDsPriority;

  constructor() {
    // A new CIF in the URL → load that customer's tickets.
    toObservable(this.cif)
      .pipe(
        switchMap(cif => this.ticketService.forCustomer(cif).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe(res => this.customerTickets.set(res));
  }
  initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  isToday(date: Date) {
    return date.toDateString() === new Date().toDateString();
  }

  reveal(field: 'nationalId' | 'mobile') {
    // TODO: send a "reveal" event to the audit log API.
    if (field === 'nationalId') this.showNationalId.set(true);
    else this.showMobile.set(true);
  }

  endVerification() {
    this.service.endVerification(this.cif());
    this.router.navigate(['/customer-search']);
  }

  createTicket() {
    this.router.navigate(['/customer-search', this.cif(), 'new-ticket']);
  }
}
