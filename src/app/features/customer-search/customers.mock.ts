import { ActivityEvent, Customer, Incident, Ticket } from './customer.models';

// TODO: remove this file when the customers, tickets and logs APIs are ready.

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

export const CUSTOMERS: Customer[] = [
  { cif: '123456', name: 'Ahmed Ali',     segment: 'Premier',  city: 'Cairo',      mobile: '01012345678', nationalId: '29001011234567', device: 'iPhone 14 · iOS 18.2 · App 6.4.1',     mobileBanking: 'active',   webBanking: 'active',   openTickets: 1 },
  { cif: '445566', name: 'Laila Mostafa', segment: 'Retail',   city: 'Mansoura',   mobile: '01022233344', nationalId: '29505121203344', device: 'Samsung S23 · Android 14 · App 6.4.0', mobileBanking: 'active',   webBanking: 'active',   openTickets: 1 },
  { cif: '889900', name: 'Mai Adel',      segment: 'Business', city: 'Cairo',      mobile: '01099887788', nationalId: '28807230107788', device: 'iPhone 13 · iOS 17.6 · App 6.3.2',     mobileBanking: 'active',   webBanking: 'active',   openTickets: 1 },
  { cif: '223344', name: 'Sara Ibrahim',  segment: 'Retail',   city: 'Alexandria', mobile: '01155566677', nationalId: '29902150206677', device: 'Xiaomi 13 · Android 13 · App 6.2.0',   mobileBanking: 'locked',   webBanking: 'inactive', openTickets: 2 },
  { cif: '667788', name: 'Omar Khaled',   segment: 'Premier',  city: 'Giza',       mobile: '01233344455', nationalId: '28611110104455', device: 'iPhone 15 · iOS 18.1 · App 6.4.1',     mobileBanking: 'active',   webBanking: 'active',   openTickets: 0 },
  { cif: '112233', name: 'Nada Youssef',  segment: 'Retail',   city: 'Tanta',      mobile: '01544455566', nationalId: '30003031605566', device: 'Oppo A78 · Android 13 · App 6.1.4',    mobileBanking: 'inactive', webBanking: 'active',   openTickets: 3 },
  { cif: '554433', name: 'Karim Hassan',  segment: 'Business', city: 'Cairo',      mobile: '01066677788', nationalId: '28409090107788', device: 'Web · Chrome 129 · Windows 11',        mobileBanking: 'active',   webBanking: 'inactive', openTickets: 0 },
  { cif: '998877', name: 'Ahmed Samir',   segment: 'Retail',   city: 'Zagazig',    mobile: '01277788899', nationalId: '29706061307889', device: 'iPhone 12 · iOS 17.2 · App 6.3.0',     mobileBanking: 'active',   webBanking: 'locked',   openTickets: 1 },
];

export const TICKETS: Ticket[] = [
  { id: '2003', cif: '123456', title: 'Login Failed',      status: 'with-sre', priority: 'high',   platform: 'mobile', createdAt: daysAgo(2) },
  { id: '1988', cif: '123456', title: 'OTP Not Received',  status: 'closed',   priority: 'medium', platform: 'mobile', createdAt: daysAgo(12) },
  { id: '2010', cif: '445566', title: 'Transfer Pending',  status: 'open',     priority: 'medium', platform: 'web',    createdAt: daysAgo(1) },
  { id: '2006', cif: '889900', title: 'Card payment declined', status: 'open', priority: 'high',   platform: 'mobile', createdAt: daysAgo(3) },
  { id: '1990', cif: '223344', title: 'Account locked',    status: 'resolved', priority: 'high',   platform: 'mobile', createdAt: daysAgo(9) },
  { id: '2001', cif: '223344', title: 'Password reset',    status: 'open',     priority: 'low',    platform: 'web',    createdAt: daysAgo(4) },
];

export const ACTIVITY: ActivityEvent[] = [
  // Ahmed Ali: three failed logins in the last few minutes, two successful events hidden by "Failures only".
  { cif: '123456', at: minutesAgo(4),   platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '123456', at: minutesAgo(5),   platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '123456', at: minutesAgo(12),  platform: 'mobile', area: 'Authentication', title: 'Login attempt failed', detail: 'Service unavailable', failed: true, errorCode: 'ERR_AUTH_503' },
  { cif: '123456', at: minutesAgo(140), platform: 'web',    area: 'Accounts',       title: 'Balance viewed',       detail: 'Current account',     failed: false },
  { cif: '123456', at: minutesAgo(300), platform: 'mobile', area: 'Authentication', title: 'Login succeeded',      detail: 'Biometric',           failed: false },
  { cif: '123456', at: daysAgo(2),      platform: 'mobile', area: 'Transfers',      title: 'Transfer sent',        detail: 'EGP 2,500 to own account', failed: false },

  { cif: '445566', at: minutesAgo(30),  platform: 'web',    area: 'Transfers',      title: 'Transfer pending',     detail: 'Waiting for the beneficiary bank', failed: true, errorCode: 'ERR_TRF_PENDING' },
  { cif: '445566', at: minutesAgo(95),  platform: 'web',    area: 'Authentication', title: 'Login succeeded',      detail: 'Password + OTP',      failed: false },

  { cif: '889900', at: minutesAgo(50),  platform: 'mobile', area: 'Payments',       title: 'Card payment declined', detail: 'Merchant limit reached', failed: true, errorCode: 'ERR_PAY_LIMIT' },
  { cif: '889900', at: minutesAgo(200), platform: 'mobile', area: 'Authentication', title: 'Login succeeded',      detail: 'Biometric',           failed: false },

  { cif: '223344', at: minutesAgo(20),  platform: 'mobile', area: 'Authentication', title: 'Account locked',       detail: '5 wrong passwords',   failed: true, errorCode: 'ERR_AUTH_LOCKED' },
  { cif: '223344', at: daysAgo(3),      platform: 'web',    area: 'Authentication', title: 'Password reset requested', detail: 'Email link sent', failed: false },

  { cif: '667788', at: minutesAgo(70),  platform: 'mobile', area: 'Accounts',       title: 'Statement downloaded', detail: 'September 2026',      failed: false },
  { cif: '112233', at: minutesAgo(15),  platform: 'web',    area: 'OTP',            title: 'OTP not delivered',    detail: 'SMS gateway timeout', failed: true, errorCode: 'ERR_OTP_TIMEOUT' },
  { cif: '554433', at: daysAgo(1),      platform: 'web',    area: 'Payments',       title: 'Bill paid',            detail: 'Electricity',         failed: false },
  { cif: '998877', at: minutesAgo(45),  platform: 'web',    area: 'Authentication', title: 'Web login blocked',    detail: 'Web banking locked',  failed: true, errorCode: 'ERR_WEB_LOCKED' },
];

export const INCIDENTS: Incident[] = [
  { id: 'INC-301', adoItem: 'ADO-48120', category: 'Authentication', platform: 'mobile' },
];
