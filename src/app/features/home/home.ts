import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap, tap, timer } from 'rxjs';
import { DsPriorityBadge, DsSlaState } from '../../shared/ui';
import { AuthService } from '../../core/theme/auth/auth.service';
import { CustomerService } from '../customer-search/customer.service';
import {
  ORIGIN_LABEL,
  SLA_STATE,
  TICKET_STATUS,
  TicketService,
  readApiError,
  ticketNo,
  titleCase,
  toDsPriority,
} from '../my-tickets/ticket.service';
import { QueueChip, QueueResponse, QueueTicket } from '../my-tickets/ticket.models';
import { SERVICE_HEALTH } from '../customer-search/customers.mock';

/** Refresh the queue every minute so SLA labels stay fresh. */
const REFRESH_MS = 60_000;

const CHIPS: { id: QueueChip; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AT_RISK', label: 'At risk' },
  { id: 'IN_REVIEW', label: 'Confirm fix' }, // the API calls this chip IN_REVIEW
  { id: 'AUTO_CREATED', label: 'Auto-created' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, DsPriorityBadge],
  templateUrl: './home.html',
})
export class Home {
  private auth = inject(AuthService);
  private customers = inject(CustomerService);
  private api = inject(TicketService);

  firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  greeting = signal(greetingFor(new Date().getHours()));

  // ---------- known issue banner (still mock: no incidents API yet) ----------
  incident = computed(() => this.customers.activeIncidents()[0]);
  showScript = signal(false);

  // ---------- queue (from the server) ----------
  filter = signal<QueueChip>('ALL');
  queue = signal<QueueResponse | null>(null);
  loading = signal(true);
  error = signal('');

  constructor() {
    // A new chip → load it now, then again every minute.
    // switchMap drops the old chip's timer when the agent picks another chip.
    toObservable(this.filter)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(chip =>
          timer(0, REFRESH_MS).pipe(
            switchMap(() =>
              this.api.queue(chip).pipe(
                catchError(err => {
                  this.error.set(readApiError(err).message);
                  this.loading.set(false);
                  return EMPTY;
                }),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        this.queue.set(res);
        this.error.set('');
        this.loading.set(false);
      });
  }

  /** Chip counts come from the server and stay the same whichever chip is selected. */
  filters = computed(() => {
    const counts = this.queue()?.counts;
    return CHIPS.map(c => ({ ...c, count: counts?.[c.id] ?? 0 }));
  });

  /** Already ordered by the server: confirm-fix first, paused last, highest SLA % in between. */
  visible = computed(() => this.queue()?.tickets ?? []);
  shown = computed(() => this.visible().slice(0, 8));

  // ---------- side ----------
  health = SERVICE_HEALTH;

  attention = computed(() => {
    const items: { text: string; tone: 'bad' | 'info'; link: string }[] = [];
    for (const t of this.visible()) {
      if (t.slaState === 'BREACHED') items.push({ text: `SLA breached on ${t.number}`, tone: 'bad', link: this.link(t) });
    }
    for (const t of this.visible()) {
      if (t.status === 'IN_REVIEW') items.push({ text: `SRE fixed ${t.number} — confirm the fix`, tone: 'info', link: this.link(t) });
    }
    const inc = this.incident();
    if (inc) items.push({ text: `Known issue: ${inc.summary}.`, tone: 'bad', link: '/tickets' });
    return items;
  });

  status = TICKET_STATUS;
  originLabel = ORIGIN_LABEL;
  priority = toDsPriority;
  slaState = (t: QueueTicket): DsSlaState => SLA_STATE[t.slaState];

  link(t: QueueTicket) {
    return `/tickets/${ticketNo(t.number)}`;
  }

  customerLine(t: QueueTicket) {
    return [t.customerName, titleCase(t.segment), titleCase(t.platform)].join(' · ');
  }

  slaClass(state: DsSlaState) {
    return {
      ok: 'bg-success-tint text-success',
      'at-risk': 'bg-warning-tint text-warning',
      breached: 'bg-danger-tint text-danger',
      paused: 'bg-page text-ink-3',
    }[state];
  }

  /** Icon tile colour: red for breached, purple while SRE owns it, amber to confirm, blue otherwise. */
  tileClass(t: QueueTicket) {
    if (t.slaState === 'BREACHED') return 'bg-danger-tint text-danger';
    if (t.status === 'ESCALATED' || t.status === 'WITH_SRE') return 'bg-sre-tint text-sre';
    if (t.status === 'IN_REVIEW') return 'bg-warning-tint text-warning';
    return 'bg-blue-50 text-brand';
  }
}

function greetingFor(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}