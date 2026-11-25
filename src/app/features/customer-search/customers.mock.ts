import { ActivityEvent, Incident, ServiceHealth, Ticket } from './customer.models';

// TODO: remove this file when the incidents and service-health screens use their APIs.
// Customers now come from /api/customers (CustomerService).

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

/** Builds a ticket with the parts every mock ticket shares. */
function ticket(t: Omit<Ticket, 'assignee' | 'notes' | 'timeline'> & Partial<Pick<Ticket, 'notes' | 'timeline'>>): Ticket {
  const timeline = t.timeline ?? [
    { at: t.createdAt, actor: t.origin === 'monitor' ? 'Monitor job' : 'Rwan Albagory', text: t.origin === 'monitor' ? `Auto-created from ${t.errorCode}` : 'Ticket created' },
    ...(t.adoItem ? [{ at: new Date(t.createdAt.getTime() + 2 * 60_000), actor: 'System', text: `Escalated to SRE as ${t.adoItem}` }] : []),
  ];
  return { assignee: 'rwan.albagory', notes: [], ...t, timeline };
}

const LOGIN_FAILED = {
  title: 'Login Failed', category: 'Authentication', priority: 'critical', platform: 'mobile',
  origin: 'monitor', errorCode: 'ERR_AUTH_503', status: 'with-sre', adoItem: 'ADO-48120',
  sreOwner: 'Omar Nabil', incidentId: 'INC-301',
} as const;

export const TICKETS: Ticket[] = [
  ticket({ id: '2001', cif: '334455', title: 'OTP Not Received', category: 'OTP', status: 'new', priority: 'medium', platform: 'mobile', origin: 'monitor', errorCode: 'OTP_TIMEOUT', createdAt: minutesAgo(1) }),
  ticket({ id: '2002', cif: '889900', title: 'Debited Not Credited', category: 'Transfers', status: 'with-sre', priority: 'high', platform: 'web', origin: 'monitor', errorCode: 'TRX_DEBIT_NO_CREDIT', adoItem: 'ADO-48121', sreOwner: 'Omar Nabil', transactionRef: 'TRX-2026-00981', createdAt: minutesAgo(9 * 60 + 30) }),
  ticket({ ...LOGIN_FAILED, id: '2003', cif: '123456', createdAt: minutesAgo(70) }),
  ticket({ ...LOGIN_FAILED, id: '2004', cif: '776655', createdAt: minutesAgo(66) }),
  ticket({ ...LOGIN_FAILED, id: '2005', cif: '445566', createdAt: minutesAgo(60) }),
  ticket({ ...LOGIN_FAILED, id: '2006', cif: '221100', createdAt: minutesAgo(52) }),
  ticket({ ...LOGIN_FAILED, id: '2007', cif: '667788', createdAt: minutesAgo(45) }),
  ticket({ ...LOGIN_FAILED, id: '2008', cif: '112233', createdAt: minutesAgo(30) }),
  ticket({ id: '2009', cif: '554433', title: 'Bill payment failed', category: 'Payments', status: 'fixed', priority: 'medium', platform: 'web', origin: 'agent', adoItem: 'ADO-48102', sreOwner: 'Laila Samy', report: 'Electricity bill payment fails with a timeout.', createdAt: minutesAgo(19 * 60) }),
  ticket({ id: '1990', cif: '223344', title: 'Account locked', category: 'Authentication', status: 'resolved', priority: 'high', platform: 'mobile', origin: 'agent', report: 'Locked after 5 wrong passwords.', createdAt: daysAgo(9), resolvedAt: daysAgo(9) }),
  ticket({ id: '1988', cif: '123456', title: 'OTP Not Received', category: 'OTP', status: 'closed', priority: 'medium', platform: 'mobile', origin: 'monitor', errorCode: 'OTP_TIMEOUT', createdAt: daysAgo(12), resolvedAt: daysAgo(11) }),
];

export const ACTIVITY: ActivityEvent[] = [
  // Ahmed Ali: three failed logins in the last few minutes, two successful events hidden by "Failures only".
  { cif: '123456', at: minutesAgo(4),   platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '123456', at: minutesAgo(5),   platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '123456', at: minutesAgo(12),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '123456', at: minutesAgo(140), platform: 'web',    area: 'Accounts',       title: 'Balance viewed',       detail: 'Current account',     failed: false },
  { cif: '123456', at: minutesAgo(300), platform: 'mobile', area: 'Authentication', title: 'Login succeeded',      detail: 'Biometric',           failed: false },
  { cif: '123456', at: daysAgo(2),      platform: 'mobile', area: 'Transfers',      title: 'Transfer sent',        detail: 'EGP 2,500 to own account', failed: false },

  { cif: '445566', at: minutesAgo(61),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '445566', at: minutesAgo(95),  platform: 'web',    area: 'Authentication', title: 'Login succeeded',      detail: 'Password + OTP',      failed: false },

  { cif: '889900', at: minutesAgo(9 * 60 + 31), platform: 'web', area: 'Transfers', title: 'Transfer debited, not credited', detail: 'EGP 18,000 · TRX-2026-00981', failed: true, errorCode: 'TRX_DEBIT_NO_CREDIT' },
  { cif: '889900', at: minutesAgo(200), platform: 'mobile', area: 'Authentication', title: 'Login succeeded',      detail: 'Biometric',           failed: false },

  { cif: '223344', at: daysAgo(9),      platform: 'mobile', area: 'Authentication', title: 'Account locked',       detail: '5 wrong passwords',   failed: true, errorCode: 'ERR_AUTH_LOCKED' },
  { cif: '667788', at: minutesAgo(46),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '112233', at: minutesAgo(31),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '554433', at: daysAgo(1),      platform: 'web',    area: 'Payments',       title: 'Bill payment failed',  detail: 'Electricity · timeout', failed: true, errorCode: 'PAY_TIMEOUT' },
  { cif: '334455', at: minutesAgo(2),   platform: 'mobile', area: 'OTP',            title: 'OTP not delivered',    detail: 'SMS gateway timeout', failed: true, errorCode: 'OTP_TIMEOUT' },
  { cif: '776655', at: minutesAgo(67),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '221100', at: minutesAgo(53),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
];

export const INCIDENTS: Incident[] = [
  {
    id: 'INC-301',
    adoItem: 'ADO-48120',
    category: 'Authentication',
    platform: 'mobile',
    summary: 'Authentication returning ERR_AUTH_503 on mobile',
    errorCode: 'ERR_AUTH_503',
    sreState: 'Active',
    customerScript:
      "We know about a problem logging in to the mobile app and our team is fixing it now. Your money and data are safe. You can use web banking meanwhile, and we'll send you an SMS when the app works again.",
  },
];

export const SERVICE_HEALTH: ServiceHealth[] = [
  { name: 'Authentication', errorsPerHour: 8, state: 'bad' },
  { name: 'OTP Service', errorsPerHour: 1, state: 'warn' },
  { name: 'Transfers', errorsPerHour: 1, state: 'warn' },
  { name: 'Mobile App', errorsPerHour: 0, state: 'ok' },
];
