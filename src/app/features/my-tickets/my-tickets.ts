import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { DsPriorityBadge, DsSlaState, DsStatusPill } from '../../shared/ui';
import {
  ORIGIN_LABEL,
  SLA_LABEL,
  SLA_STATE,
  TICKET_STATUS,
  TicketService,
  readApiError,
  ticketNo,
  toDsPriority,
} from './ticket.service';
import { PageResponse, TicketListRow, TicketView } from './ticket.models';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-my-tickets',
  imports: [DatePipe, RouterLink, DsPriorityBadge, DsStatusPill],
  templateUrl: './my-tickets.html',
})
export class MyTickets {
  private api = inject(TicketService);

  status = signal<TicketView>('ALL');
  /** What the agent types (every key). */
  query = signal('');
  /** What we send: the query 300ms after the agent stops typing. */
  private search = signal('');
  /** Zero-based, like the API. The template shows page() + 1. */
  page = signal(0);

  result = signal<PageResponse<TicketListRow> | null>(null);
  loading = signal(true);
  error = signal('');

  statusFilters: { id: TicketView; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'OPEN', label: 'Open' },
    { id: 'RESOLVED_CLOSED', label: 'Resolved & closed' },
  ];

  /** Everything the request depends on. A change to any of them → a new request. */
  private params = computed(() => ({ view: this.status(), q: this.search(), page: this.page(), size: PAGE_SIZE }));

  constructor() {
    // Typing → wait 300ms → a new search starts again from the first page.
    toObservable(this.query)
      .pipe(debounceTime(300), map(q => q.trim()), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(q => {
        this.search.set(q);
        this.page.set(0);
      });

    // params change → ask the server. switchMap cancels a slower older request.
    toObservable(this.params)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(p =>
          this.api.list(p).pipe(
            catchError(err => {
              this.error.set(readApiError(err).message);
              this.result.set(null);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        this.result.set(res);
        this.error.set('');
        this.loading.set(false);
      });
  }

  rows = computed(() => this.result()?.items ?? []);
  total = computed(() => this.result()?.totalItems ?? 0);
  pages = computed(() => Math.max(1, this.result()?.totalPages ?? 1));

  setStatus(view: TicketView) {
    this.status.set(view);
    this.page.set(0); // a new filter starts again from the first page
  }

  statusInfo = TICKET_STATUS;
  originLabel = ORIGIN_LABEL;
  slaLabel = SLA_LABEL;
  priority = toDsPriority;
  no = ticketNo;
  slaState = (t: TicketListRow): DsSlaState => SLA_STATE[t.slaState];

  slaClass(state: DsSlaState) {
    return {
      ok: 'bg-success-tint text-success',
      'at-risk': 'bg-warning-tint text-warning',
      breached: 'bg-danger-tint text-danger',
      paused: 'bg-page text-ink-3',
    }[state];
  }
}