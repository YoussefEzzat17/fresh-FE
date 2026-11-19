import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, Signal, signal } from '@angular/core';
import { tap } from 'rxjs';
import { DsPriority, DsSlaState, DsTone } from '../../shared/ui';
import {
  ApiErrorResponse,
  AgentStep,
  ApiPriority,
  CategoryDto,
  ContactDto,
  ContactsResponse,
  CreateTicketRequest,
  CustomerTicketsResponse,
  HistoryItem,
  HistoryResponse,
  PageResponse,
  PrecheckRequest,
  PrecheckResponse,
  QueueChip,
  QueueResponse,
  SlaState,
  TicketDto,
  TicketListQuery,
  TicketListRow,
  TicketOrigin,
  TicketStatus,
  TicketStep,
  ReviewStep,
} from './ticket.models';

// ---------- UI helpers (server value → what the screen shows) ----------

/** Label + colour for every server status. */
export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: DsTone }> = {
  NEW: { label: 'New', tone: 'neutral' },
  TROUBLESHOOTING: { label: 'Troubleshooting', tone: 'info' },
  WAITING_ON_CUSTOMER: { label: 'Waiting on customer', tone: 'neutral' },
  ESCALATED: { label: 'Escalated', tone: 'sre' },
  WITH_SRE: { label: 'With SRE', tone: 'sre' },
  SRE_FIXED: { label: 'Fixed by SRE · waiting for review', tone: 'sre' },
  IN_REVIEW: { label: 'In review · confirm fix', tone: 'warning' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  REOPENED: { label: 'Reopened', tone: 'info' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
};

/** Button text for each step the frontend can send. Guide and system steps never get a button. */
export const STEP_LABEL: Record<AgentStep | ReviewStep, string> = {
  PICK_UP_TICKET: 'Pick up',
  REQUEST_DETAILS: 'Request details from customer',
  DETAILS_RECEIVED: 'Details received',
  APPLY_FIX: 'Apply fix · resolve',
  ARCHIVE: 'Archive',
  REVIEWER_APPROVES: 'Approve fix',
  REVIEWER_REJECTS: 'Reject fix',
};

const REVIEW_STEPS: TicketStep[] = ['REVIEWER_APPROVES', 'REVIEWER_REJECTS'];
/** Review steps go to /api/review/tickets/{number}/steps; the rest to /api/tickets/{number}/steps. */
export const isReviewStep = (step: TicketStep): step is ReviewStep => REVIEW_STEPS.includes(step);
/** Steps the agent can press. Guide and system steps are taken elsewhere. */
export const isButtonStep = (step: TicketStep): step is AgentStep | ReviewStep => step in STEP_LABEL;

/** Server SLA state → the design-system state. MET has no colour of its own, so it shows as "ok". */
export const SLA_STATE: Record<SlaState, DsSlaState> = {
  ON_TRACK: 'ok',
  AT_RISK: 'at-risk',
  BREACHED: 'breached',
  PAUSED: 'paused',
  MET: 'ok',
};

export const SLA_LABEL: Record<SlaState, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  BREACHED: 'Breached',
  PAUSED: 'Paused',
  MET: 'Met',
};

export const ORIGIN_LABEL: Record<TicketOrigin, string> = {
  MANUAL: 'Agent',
  AUTO_CREATED: 'Auto-created',
  FROM_INCIDENT: 'From incident',
};

/** "HIGH" → "high", for <ds-priority>. */
export const toDsPriority = (p: ApiPriority): DsPriority => p.toLowerCase() as DsPriority;
/** "high" → "HIGH", for the API. */
export const toApiPriority = (p: DsPriority): ApiPriority => p.toUpperCase() as ApiPriority;

/** "#2001" → "2001". URLs use the number without the #. */
export const ticketNo = (number: string): string => number.replace(/^#/, '');

export const isDone = (status: TicketStatus): boolean => status === 'RESOLVED' || status === 'CLOSED';

/** "PREMIUM" → "Premium" */
export const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase().replaceAll('_', ' ');

/** One line for a timeline/audit entry, e.g. "Ticket status changed: New → Troubleshooting". */
export function historyText(h: HistoryItem): string {
  const text = titleCase(h.action);
  const from = readStatus(h.before);
  const to = readStatus(h.after);
  const reason = readField(h.after, 'reason');
  const change = from && to && from !== to ? `: ${TICKET_STATUS[from]?.label ?? from} → ${TICKET_STATUS[to]?.label ?? to}` : '';
  return text + change + (reason ? ` — “${reason}”` : '');
}

/** before/after are JSON text, e.g. after = {status, step, reason}. Read "status" if it is there. */
function readStatus(json?: string | null): TicketStatus | undefined {
  return readField(json, 'status') as TicketStatus | undefined;
}

/** One text field out of a before/after JSON string; undefined when missing or unreadable. */
function readField(json: string | null | undefined, field: string): string | undefined {
  if (!json) return undefined;
  try {
    const value = JSON.parse(json)?.[field];
    return typeof value === 'string' && value ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Any failed request → { status, code, message, fieldErrors } the screen can show. */
export function readApiError(err: unknown) {
  const http = err instanceof HttpErrorResponse ? err : undefined;
  const body = (http?.error ?? {}) as Partial<ApiErrorResponse>;
  const status = http?.status ?? 0;
  const fallback =
    status === 0 ? "We can't reach the server. Check your connection and try again."
    : status === 403 ? "You don't have access to this."
    : status === 404 ? 'Not found.'
    : 'Something went wrong. Please try again.';
  return {
    status,
    code: body.code ?? '',
    message: body.message ?? fallback,
    fieldErrors: body.fieldErrors ?? {},
  };
}

// ---------- API ----------

/**
 * Everything the portal does with tickets, against /api/tickets.
 * The auth interceptor adds the token and refreshes it on 401.
 */
@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/tickets';
  private readonly _openCount = signal<number | null>(null);

  readonly openCount = this._openCount.asReadonly();

  /** Forget the count, e.g. on sign out, so the next user never sees the old number. */
  resetOpenCount() {
    this._openCount.set(null);
  }

  /**ask the server how many of my tickets are open  */
  refreshOpenCount() {
    this.list({view: 'OPEN', q:'', page:0, size:1}).subscribe({
      next: page => this._openCount.set(page.totalItems),
      error: () => {},
    })
  }

  /** Home queue: ordered by the server, with counts for every chip. */
  queue(chip: QueueChip = 'ALL') {
    return this.http.get<QueueResponse>(`${this.base}/queue`, { params: { chip } });
  }

  /** My tickets, one page at a time. */
  list(query: TicketListQuery) {
    let params = new HttpParams().set('view', query.view).set('page', query.page).set('size', query.size);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<PageResponse<TicketListRow>>(this.base, { params });
  }

  get(number: string) {
    return this.http.get<TicketDto>(this.url(number));
  }

  /**
   * Takes one of the ticket's availableSteps and returns the ticket after it.
   * Review steps have their own endpoint. 422 = step not allowed now, 409 = someone else changed the ticket.
   */
  takeStep(number: string, step: TicketStep, reason?: string) {
    const url = isReviewStep(step)
      ? `/api/review/tickets/${encodeURIComponent(ticketNo(number))}/steps`
      : `${this.url(number)}/steps`;
    return this.http
      .post<TicketDto>(url, { step, reason })
      .pipe(tap(() => this.refreshOpenCount())); // resolving or archiving changes the open count
  }

  /** Active categories for the create form. Sub-categories are the rows with a parentCode. */
  categories() {
    return this.http.get<CategoryDto[]>(`${this.base}/categories`);
  }

  timeline(number: string) {
    return this.http.get<HistoryResponse>(`${this.url(number)}/timeline`);
  }

  audit(number: string) {
    return this.http.get<HistoryResponse>(`${this.url(number)}/audit`);
  }

  contacts(number: string) {
    return this.http.get<ContactsResponse>(`${this.url(number)}/contacts`);
  }

  addContact(number: string, note: string) {
    return this.http.post<ContactDto>(`${this.url(number)}/contacts`, { note });
  }

  /** Warns before a duplicate: an open ticket for this customer and category. */
  precheck(body: PrecheckRequest) {
    return this.http.post<PrecheckResponse>(`${this.base}/precheck`, body);
  }

  create(body: CreateTicketRequest) {
    return this.http.post<TicketDto>(this.base, body)
    .pipe(tap(() => this.refreshOpenCount()));
  }

  /** The customer's tickets + the "Repeat caller" note. Needs a verified caller. */
  forCustomer(cif: string) {
    return this.http.get<CustomerTicketsResponse>(`/api/customers/${encodeURIComponent(cif)}/tickets`);
  }

  /** "#2001" or "2001" → /api/tickets/2001 */
  private url(number: string) {
    return `${this.base}/${encodeURIComponent(ticketNo(number))}`;
  }
}