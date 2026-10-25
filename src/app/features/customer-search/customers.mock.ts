import { Customer } from './customer.models';

export const CUSTOMERS: Customer[] = [
  { cif: '123456', name: 'Ahmed Ali',     segment: 'Premier',  city: 'Cairo',      mobile: '01012345678', mobileBanking: 'active',   webBanking: 'active',   openTickets: 1 },
  { cif: '445566', name: 'Laila Mostafa', segment: 'Retail',   city: 'Mansoura',   mobile: '01022233344', mobileBanking: 'active',   webBanking: 'active',   openTickets: 1 },
  { cif: '889900', name: 'Mai Adel',      segment: 'Business', city: 'Cairo',      mobile: '01099887788', mobileBanking: 'active',   webBanking: 'active',   openTickets: 1 },
  { cif: '223344', name: 'Sara Ibrahim',  segment: 'Retail',   city: 'Alexandria', mobile: '01155566677', mobileBanking: 'locked',   webBanking: 'inactive', openTickets: 2 },
  { cif: '667788', name: 'Omar Khaled',   segment: 'Premier',  city: 'Giza',       mobile: '01233344455', mobileBanking: 'active',   webBanking: 'active',   openTickets: 0 },
  { cif: '112233', name: 'Nada Youssef',  segment: 'Retail',   city: 'Tanta',      mobile: '01544455566', mobileBanking: 'inactive', webBanking: 'active',   openTickets: 3 },
  { cif: '554433', name: 'Karim Hassan',  segment: 'Business', city: 'Cairo',      mobile: '01066677788', mobileBanking: 'active',   webBanking: 'inactive', openTickets: 0 },
  { cif: '998877', name: 'Ahmed Samir',   segment: 'Retail',   city: 'Zagazig',    mobile: '01277788899', mobileBanking: 'active',   webBanking: 'locked',   openTickets: 1 },
];
