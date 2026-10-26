import type { DsPriority } from '../../shared/ui';

export type DigitalStatus = 'active' | 'locked' | 'inactive';
export type Segment = 'Premier' | 'Retail' | 'Business';
export type Platform = 'mobile' | 'web';

export interface Customer {
  cif: string;
  name: string;
  segment: Segment;
  city: string;
  mobile: string;
  nationalId: string;
  device: string;
  mobileBanking: DigitalStatus;
  webBanking: DigitalStatus;
  openTickets: number;
}

export type TicketStatus = 'open' | 'with-sre' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  cif: string;
  title: string;
  status: TicketStatus;
  priority: DsPriority;
  platform: Platform;
  createdAt: Date;
  report?: string;
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

/** 01022233344 → 010••••3344 */
export function maskMobile(mobile: string): string {
  return `${mobile.slice(0, 3)}••••${mobile.slice(-4)}`;
}

/** 29001011234567 → ••••••••••4567 */
export function maskNationalId(id: string): string {
  return `${'•'.repeat(id.length - 4)}${id.slice(-4)}`;
}
