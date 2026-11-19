import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize, switchMap, tap } from 'rxjs';
import { DsPriorityBadge, DsSlaMeter, DsStatusPill } from '../../shared/ui';
import { CustomerService } from '../customer-search/customer.service';
import {
  ORIGIN_LABEL,
  SLA_STATE,
  STEP_LABEL,
  TICKET_STATUS,
  TicketService,
  historyText,
  isButtonStep,
  isDone,
  readApiError,
  titleCase,
  toDsPriority,
} from '../my-tickets/ticket.service';
import { ContactDto, HistoryItem, TicketDto, TicketStatus, TicketStep } from '../my-tickets/ticket.models';

type Tab = 'work' | 'timeline' | 'contact' | 'audit';

/** These steps get the filled (primary) button; the others are outlined. */
const PRIMARY: TicketStep[] = ['PICK_UP_TICKET', 'DETAILS_RECEIVED', 'APPLY_FIX', 'ARCHIVE', 'REVIEWER_APPROVES'];
/** The SRE side of the ticket, in order. */
const SRE_STEPS: TicketStatus[] = ['ESCALATED', 'WITH_SRE', 'SRE_FIXED', 'IN_REVIEW', 'RESOLVED'];

@Component({
  selector: 'app-ticket-workspace',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, DsPriorityBadge, DsSlaMeter, DsStatusPill],
  templateUrl: './ticket-workspace.html',
})
export class TicketWorkspace {
  private api = inject(TicketService);
  private customers = inject(CustomerService);

  /** From the URL /tickets/:id — the ticket number without "#". */
  id = input.required<string>();

  // ---------- ticket ----------
  ticket = signal<TicketDto | null>(null);
  state = signal<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  loadError = signal('');

  // ---------- tabs ----------
  tab = signal<Tab>('work');
  timeline = signal<HistoryItem[]>([]);
  audit = signal<HistoryItem[]>([]);
  contacts = signal<ContactDto[]>([]);

  // ---------- status change ----------
  busy = signal(false);
  actionError = signal('');
  reason = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  // ---------- contact note ----------
  note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(2000)],
  });
  noteSaving = signal(false);
  noteSaved = signal(false);
  noteError = signal('');

  // ---------- helpers for the template ----------
  statusInfo = TICKET_STATUS;
  originLabel = ORIGIN_LABEL;
  historyText = historyText;
  titleCase = titleCase;
  priority = toDsPriority;

  constructor() {
    // Every time the :id in the URL changes → load that ticket.
    // switchMap cancels the old request if the agent jumps to another ticket.
    toObservable(this.id)
      .pipe(
        tap(() => {
          this.state.set('loading');
          this.ticket.set(null);
        }),
        switchMap(id =>
          this.api.get(id).pipe(
            catchError(err => {
              const e = readApiError(err);
              this.state.set(e.status === 404 || e.status === 400 ? 'not-found' : 'error');
              this.loadError.set(e.message);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(t => {
        this.ticket.set(t);
        this.state.set('ready');
        this.loadHistory();
        this.loadContacts();
      });
  }

  // ---------- derived ----------
  verified = computed(() => {
    const t = this.ticket();
    return !!t?.customerCif && this.customers.isVerified(t.customerCif);
  });

  sla = computed(() => {
    const t = this.ticket();
    if (!t) return undefined;
    return { state: SLA_STATE[t.slaState], label: t.slaLabel, progress: t.slaPercentUsed, raw: t.slaState };
  });

  /** The buttons: exactly the steps the server says this user can take now, in the server's order. */
  actions = computed(() => {
    const steps = (this.ticket()?.availableSteps ?? []).filter(isButtonStep);
    return steps.map(step => ({
      step,
      label: STEP_LABEL[step],
      primary: PRIMARY.includes(step) || steps.length === 1,
    }));
  });

  done = computed(() => {
    const t = this.ticket();
    return !!t && isDone(t.status);
  });

  /** SRE progress, shown while SRE owns the ticket. */
  sreSteps = computed(() => {
    const status = this.ticket()?.status;
    // REOPENED = the reviewer rejected the fix; the system sends it back to SRE (FIX_FAILED → WITH_SRE).
    const current = status === 'REOPENED' ? SRE_STEPS.indexOf('WITH_SRE') : status ? SRE_STEPS.indexOf(status) : -1;
    if (current === -1 || status === 'RESOLVED') return null;
    return SRE_STEPS.map((s, i) => ({
      label: TICKET_STATUS[s].label,
      state: i < current ? 'done' : i === current ? 'current' : 'todo',
    })) as { label: string; state: 'done' | 'current' | 'todo' }[];
  });

  /** The customer's latest failed events (still from the mock logs). */
  failedActivity = computed(() => {
    const t = this.ticket();
    return t?.customerCif ? this.customers.activityFor(t.customerCif).filter(e => e.failed).slice(0, 3) : [];
  });

  notePlaceholder = computed(
    () => `e.g. Called ${this.ticket()?.customerName?.split(' ')[0] ?? 'the customer'}, asked them to retry while on the call.`,
  );

  // ---------- actions ----------
  takeStep(step: TicketStep) {
    if (this.busy() || this.reason.invalid) return;
    const reason = this.reason.value.trim() || undefined;

    // The server refuses a rejection without a reason (422 REASON_REQUIRED); say it before sending.
    if (step === 'REVIEWER_REJECTS' && !reason) {
      this.actionError.set('Write why you reject the fix in the reason box.');
      return;
    }

    this.busy.set(true);
    this.actionError.set('');
    this.api
      .takeStep(this.id(), step, reason)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: t => {
          this.ticket.set(t); // the response is the updated ticket — no second GET
          this.reason.reset();
          this.loadHistory();
        },
        error: err => {
          const e = readApiError(err);
          // 409 DATA_CONFLICT: someone else moved the ticket. Show the latest version.
          if (e.code === 'DATA_CONFLICT') this.reload();
          this.actionError.set(e.message);
        },
      });
  }

  /** Load the ticket again (after someone else changed it). */
  private reload() {
    this.api.get(this.id()).subscribe({ next: t => this.ticket.set(t), error: () => {} });
    this.loadHistory();
  }

  addNote() {
    if (this.note.invalid) {
      this.note.markAsTouched();
      return;
    }
    if (this.noteSaving()) return;
    this.noteSaving.set(true);
    this.noteError.set('');

    this.api
      .addContact(this.id(), this.note.value.trim())
      .pipe(finalize(() => this.noteSaving.set(false)))
      .subscribe({
        next: contact => {
          this.contacts.update(list => [contact, ...list]); // newest first, like the server
          this.note.reset();
          this.noteSaved.set(true);
          this.loadHistory(); // the audit tab gets CUSTOMER_CONTACTED
        },
        error: err => this.noteError.set(readApiError(err).message),
      });
  }

  noteInvalid() {
    return this.note.invalid && this.note.touched;
  }

  // ---------- loading the tabs ----------
  private loadHistory() {
    this.api.timeline(this.id()).subscribe({ next: r => this.timeline.set(r.items), error: () => this.timeline.set([]) });
    this.api.audit(this.id()).subscribe({ next: r => this.audit.set(r.items), error: () => this.audit.set([]) });
  }

  private loadContacts() {
    this.api.contacts(this.id()).subscribe({ next: r => this.contacts.set(r.items), error: () => this.contacts.set([]) });
  }
}