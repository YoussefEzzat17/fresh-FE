export type DigitalStatus = 'active' | 'locked' | 'inactive';
export type Segment = 'Premier' | 'Retail' | 'Business';

export interface Customer {
  cif: string;
  name: string;
  segment: Segment;
  city: string;
  mobile: string;
  mobileBanking: DigitalStatus;
  webBanking: DigitalStatus;
  openTickets: number;
}

/** 01022233344 → 010••••3344 */
export function maskMobile(mobile: string): string {
  return `${mobile.slice(0, 3)}••••${mobile.slice(-4)}`;
}
