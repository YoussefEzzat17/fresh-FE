import type { DsPriority } from '../../shared/ui';
import type { ApiPlatform } from '../my-tickets/ticket.models';

// =====================================================================
// Customers API (Swagger: /api/customers/...). Mirrors the server exactly.
// =====================================================================

export type CustomerSegment = 'RETAIL' | 'PREMIUM' | 'VIP' | 'BUSINESS';
/** Whether the customer uses digital banking. SUSPENDED = enrolled, but access is blocked. */
export type EnrollmentStatus = 'ENROLLED' | 'NOT_ENROLLED' | 'SUSPENDED';
/** An identity check the agent asks the caller. At least two must pass. */
export type VerificationCheck = 'DATE_OF_BIRTH' | 'NATIONAL_ID_LAST4' | 'MOBILE_ON_FILE' | 'RECENT_TRANSACTION';
/** A field that stays masked after verification; revealed one at a time, and audited. */
export type SensitiveField = 'NATIONAL_ID' | 'MOBILE';
export type ActivityRange = 'LAST_6_HOURS' | 'TODAY' | 'LAST_7_DAYS' | 'CUSTOM';

/** GET /api/customers/search?q= : one row. National ID and mobile come masked. */
export interface CustomerSearchResult {
  cif: string;
  fullName: string;
  segment: CustomerSegment;
  maskedMobile: string;
  enrollmentStatus: EnrollmentStatus;
  openTicketCount: number;
  /** Which identifier matched: CIF, NATIONAL_ID, MOBILE or TICKET. */
  matchedBy: string;
}

export interface CustomerSearchResponse {
  results: CustomerSearchResult[];
  /** Set only when nothing matched, e.g. "No match. Check the digits and the ID type." */
  message?: string;
}

/** GET /api/customers/{cif} : the Customer 360 header. Needs a verified caller (else 403 CALLER_NOT_VERIFIED). */
export interface CustomerDetail {
  cif: string;
  fullName: string;
  segment: CustomerSegment;
  maskedNationalId: string;
  maskedMobile: string;
  enrollmentStatus: EnrollmentStatus;
  preferredLanguage: string;
  /** When this agent verified the caller. */
  verifiedAt: string;
}

/** POST /verify and GET /verification. Verification lasts 30 minutes or until end-call. */
export interface VerificationStatus {
  cif: string;
  verified: boolean;
  passedChecks: VerificationCheck[];
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface RevealedField {
  field: SensitiveField;
  value: string;
}

/** GET /api/customers/{cif}/activity : one event. */
export interface CustomerActivityEvent {
  time: string;
  eventType: string;
  platform: ApiPlatform;
  service: string;
  result: 'SUCCESS' | 'FAILURE';
  errorCode?: string;
  /** True for failures, which the screen marks red. */
  failure: boolean;
}

export interface CustomerActivityResponse {
  range: ActivityRange;
  from: string;
  to: string;
  failuresOnly: boolean;
  /** For the time range and result filter, before the platform and service chips. */
  counts: { total: number; failures: number; byPlatform: Record<string, number>; byService: Record<string, number> };
  /** Newest first. */
  events: CustomerActivityEvent[];
  /** Set only when no event matches. */
  emptyMessage?: string;
}

export interface CustomerActivityQuery {
  range: ActivityRange;
  failuresOnly: boolean;
  /** Omit for every platform. */
  platform?: ApiPlatform;
}

/** GET /api/customers/{cif}/diagnosis : what the logs already say (last 6 hours). */
export interface CustomerDiagnosis {
  windowHours: number;
  hasFailures: boolean;
  topFailure: { count: number; eventType: string; errorCode: string; service: string; firstAt: string; lastAt: string } | null;
  summary: string;
  servicesWithoutFailures: string[];
}

// =====================================================================
// Still mock (no API yet): incidents banner, service health, old ticket types.
// =====================================================================

export type Platform = 'mobile' | 'web';

/**
 * new      → created, nobody worked it yet
 * open     → the agent is working it
 * with-sre → escalated to SRE (Azure DevOps work item)
 * fixed    → SRE says it's fixed; the agent must confirm with the customer
 * resolved / closed → done
 */
export type TicketStatus = 'new' | 'open' | 'with-sre' | 'fixed' | 'resolved' | 'closed';

export interface TicketNote {
  at: Date;
  author: string;
  text: string;
}

export interface TicketEvent {
  at: Date;
  actor: string;
  text: string;
}

export interface Ticket {
  id: string;
  cif: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: DsPriority;
  platform: Platform;
  createdAt: Date;
  /** Username of the agent who owns the ticket. */
  assignee: string;
  /** "monitor" = auto-created by the log monitor job. */
  origin: 'monitor' | 'agent';
  errorCode?: string;
  adoItem?: string;
  sreOwner?: string;
  incidentId?: string;
  transactionRef?: string;
  device?: string;
  report?: string;
  lastSreAskAt?: Date;
  resolvedAt?: Date;
  notes: TicketNote[];
  timeline: TicketEvent[];
}

/** One event from the customer's digital banking logs. */
export interface ActivityEvent {
  cif: string;
  at: Date;
  platform: Platform;
  area: string;
  title: string;
  detail: string;
  failed: boolean;
  errorCode?: string;
}

/** An open incident that new tickets join instead of escalating again. */
export interface Incident {
  id: string;
  adoItem: string;
  category: string;
  platform: Platform;
  summary: string;
  errorCode: string;
  sreState: string;
  /** What the agent can say to callers. */
  customerScript: string;
}

export interface ServiceHealth {
  name: string;
  errorsPerHour: number;
  state: 'ok' | 'warn' | 'bad';
}

/** What the New ticket form sends to the service. */
export interface NewTicketDraft {
  cif: string;
  platform: Platform;
  priority: DsPriority;
  category: string;
  issue: string;
  report: string;
}
