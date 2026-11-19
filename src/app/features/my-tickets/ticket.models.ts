export type TicketStatus =
  | 'NEW'
  | 'TROUBLESHOOTING'
  | 'WAITING_ON_CUSTOMER'
  | 'ESCALATED'
  | 'WITH_SRE'
  | 'SRE_FIXED'
  | 'IN_REVIEW'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED';

export type ApiPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApiPlatform = 'MOBILE' | 'WEB' | 'BRANCH';
export type TicketOrigin = 'MANUAL' | 'AUTO_CREATED' | 'FROM_INCIDENT';
export type SlaState = 'ON_TRACK' |  'AT_RISK' | 'BREACHED' | 'PAUSED' | 'MET';
export type Segment = 'RETAIL' | 'PREMIUM' | 'VIP' | 'BUSINESS';
/** A hint for the next action. Shown as text; the buttons come from availableSteps. */
export type NextAction =
  | 'START_GUIDE'
  | 'PICK_UP_TICKET'
  | 'ESCALATE'
  | 'RESUME'
  | 'WAIT_FOR_SRE'
  | 'ASK_SRE_FOR_UPDATE'
  | 'WAIT_FOR_REVIEW'
  | 'CONFIRM_FIX'
  | 'ARCHIVE';

/**
 * A step moves a ticket from one status to another (Swagger: TicketStep).
 * Agent steps go to POST /api/tickets/{number}/steps, review steps to POST /api/review/tickets/{number}/steps.
 * Guide and system steps are never sent by the frontend.
 */
export type AgentStep = 'PICK_UP_TICKET' | 'REQUEST_DETAILS' | 'DETAILS_RECEIVED' | 'APPLY_FIX' | 'ARCHIVE';
export type ReviewStep = 'REVIEWER_APPROVES' | 'REVIEWER_REJECTS';
export type TicketStep =
  | AgentStep
  | ReviewStep
  | 'GUIDE_SOLVED'
  | 'GUIDE_FOLLOW_UP'
  | 'GUIDE_HAND_OVER'
  | 'HAND_OVER'
  | 'SRE_ACCEPTS'
  | 'DEPLOY_FIX'
  | 'SEND_TO_REVIEW'
  | 'FIX_FAILED';

/** IN_REVIEW is the screen's "Confirm fix" chip. */
export type QueueChip = 'ALL' | 'AT_RISK' | 'IN_REVIEW' | 'AUTO_CREATED';
export type TicketView = 'ALL' | 'OPEN' | 'RESOLVED_CLOSED';

export interface TicketDto {
    id: number;
    number: string;
    title: string;
    description: string;
    /** null for a Reviewer: Guide Admin roles never see customer data. */
    customerCif: string | null;
    customerName: string | null;
    category: string;
    categoryCode: string;
    priority: ApiPriority;
    status: TicketStatus;
    origin: TicketOrigin;
    platform: ApiPlatform;
    errorCode?: string;
    reference?: string;
    assignedAgent: string;
    slaState: SlaState;
    slaDueAt: string;
    /** The steps the current user can take now: the action buttons. */
    availableSteps: TicketStep[];
    reopenCount: number;
    createdAt: string;
    slaPercentUsed: number;
    slaLabel: string;
    /** null when the ticket is CLOSED. */
    nextAction: NextAction | null;
    nextActionLabel: string | null;
    /** An unfinished guide run on this ticket, or null. */
    activeGuideRunId: number | null;
}

export interface QueueTicket {
    id: number;
    number: string;
    title: string;
    customerCif: string;
    customerName: string;
    segment: Segment;
    category: string;
    platform: ApiPlatform;
    errorCode?: string;
    origin: TicketOrigin;
    priority: ApiPriority;
    status: TicketStatus;
    assignedAgent: string;
    slaState: SlaState;
    slaLabel: string;
    slaDueAt: string;
    percentUsed: number;
    remainingSeconds: number;
    paused: boolean;
    nextAction: NextAction;
    nextActionLabel: string;
}

export interface QueueResponse {
    chip: QueueChip;
    counts: Record<QueueChip, number>;
    tickets: QueueTicket[];
}

export interface TicketListRow {
    number: string;
    title: string;
    customerCif: string;
    customerName: string;
    status: TicketStatus;
    priority: ApiPriority;
    origin: TicketOrigin;
    slaState: SlaState;
    createdAt: string;
}

export interface PageResponse<T> {
    items: T[];
    page: number;
    size: number;
    totalItems: number;
    totalPages: number;
}

export interface TicketListQuery {
    view: TicketView;
    q: string;
    page: number;
    size: number;
}

/** Body of POST .../steps. reason is required for REVIEWER_REJECTS, max 500 characters. */
export interface TakeStepRequest {
    step: TicketStep;
    reason?: string;
}

/** GET /api/tickets/categories: a row with a parentCode is a sub-category a ticket can use. */
export interface CategoryDto {
    code: string;
    name: string;
    parentCode: string | null;
    defaultPriority: ApiPriority;
    referenceRequired: boolean;
    referenceHint: string | null;
}
  
export interface HistoryItem {
    id: number;
    time: string;
    userId: number;
    username: string;
    role: 'AGENT' | 'GUIDE_ADMIN' | 'REVIEWER';
    action: string;
    entity: string;
    entityId: string;
    before?: string;
    after?: string;
    endpoint?: string;
    httpMethod?: string;
    ipAddress?: string;
}
  
export interface HistoryResponse {
    count: number;
    items: HistoryItem[];
}
  
export interface ContactDto {
    id: number;
    note: string;
    author: string;
    time: string;
}
  
export interface ContactsResponse {
    count: number;
    items: ContactDto[];
}
  
export interface PrecheckRequest {
    cif: string;
    categoryCode: string;
}
  
export interface PrecheckWarning {
    code: string;
    message: string;
    existingTicketNumber?: string;
}
  
export interface PrecheckResponse {
    warnings: PrecheckWarning[];
}
  
export interface CreateTicketRequest {
    cif: string;
    categoryCode: string;
    priority: ApiPriority;
    description: string;
    platform: ApiPlatform;
    title?: string;
    reference?: string;
    errorCode?: string;
    allowDuplicate?: boolean;
}
  
export interface CustomerTicketRow {
    number: string;
    title: string;
    category: string;
    origin: TicketOrigin;
    status: TicketStatus;
    priority: ApiPriority;
    slaState: SlaState;
    createdAt: string;
}
  
export interface CustomerTicketsResponse {
    repeatCaller: boolean;
    repeatCallerNote?: string;
    tickets: CustomerTicketRow[];
}
  
export interface ApiErrorResponse {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
    path?: string;
    timestamp?: string;
}
