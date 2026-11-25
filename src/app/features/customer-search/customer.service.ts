import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  ActivityEvent,
  CustomerActivityQuery,
  CustomerActivityResponse,
  CustomerDetail,
  CustomerDiagnosis,
  CustomerSearchResponse,
  Incident,
  RevealedField,
  SensitiveField,
  VerificationCheck,
  VerificationStatus,
} from './customer.models';
import { ACTIVITY, INCIDENTS } from './customers.mock';

/**
 * Customers and caller verification, against /api/customers.
 * The server is the one that decides who is verified: every Customer 360 call answers
 * 403 CALLER_NOT_VERIFIED until the caller passes. We also keep a small local note of the
 * CIFs verified on this call, so other screens (e.g. a ticket's breadcrumb) can show a link.
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/customers';

  /** CIF → when this agent verified the caller (local note; the server is the source of truth). */
  private readonly verifiedAt = signal(new Map<string, Date>());

  /** Last search, so going back to Customer search shows the same results. */
  readonly lastQuery = signal('');

  // ---------- search ----------
  /** One box: CIF (100245 or CIF-100245), national ID, mobile (01…, 20…, +20…) or ticket number (#2001). */
  search(q: string) {
    return this.http.get<CustomerSearchResponse>(`${this.base}/search`, { params: { q } });
  }

  /** The Customer 360 header. 403 CALLER_NOT_VERIFIED until the caller passes, 404 for an unknown CIF. */
  get(cif: string) {
    return this.http
      .get<CustomerDetail>(this.url(cif))
      .pipe(tap(c => this.remember(cif, c.verifiedAt ? new Date(c.verifiedAt) : new Date())));
  }

  // ---------- verification ----------
  /** At least two checks must pass (422 TOO_FEW_CHECKS). Valid 30 minutes or until end-call. */
  verify(cif: string, passedChecks: VerificationCheck[]) {
    return this.http
      .post<VerificationStatus>(`${this.url(cif)}/verify`, { passedChecks })
      .pipe(tap(v => v.verified && this.remember(cif, v.verifiedAt ? new Date(v.verifiedAt) : new Date())));
  }

  /** The caller failed: ends any verification and writes CALLER_VERIFICATION_FAILED to the audit log. */
  verificationFailed(cif: string) {
    return this.http.post<void>(`${this.url(cif)}/verification-failed`, {}).pipe(tap(() => this.forget(cif)));
  }

  /** Ends the verification: the customer is locked again until verified again. */
  endCall(cif: string) {
    return this.http.post<void>(`${this.url(cif)}/end-call`, {}).pipe(tap(() => this.forget(cif)));
  }

  /** Is the caller verified right now, according to the server? */
  verification(cif: string) {
    return this.http.get<VerificationStatus>(`${this.url(cif)}/verification`);
  }

  /** Asks the server and updates the local note, e.g. after a reload. */
  checkVerification(cif: string) {
    return this.verification(cif).pipe(
      tap(v => (v.verified ? this.remember(cif, v.verifiedAt ? new Date(v.verifiedAt) : new Date()) : this.forget(cif))),
    );
  }

  /** Local note only: was this CIF verified on this call (since the page loaded)? */
  isVerified(cif: string): boolean {
    return this.verifiedAt().has(cif);
  }

  // ---------- Customer 360 ----------
  /** The full value of one masked field. Audited as CUSTOMER_FIELD_REVEALED. */
  reveal(cif: string, field: SensitiveField) {
    return this.http.post<RevealedField>(`${this.url(cif)}/reveal`, { field });
  }

  activity(cif: string, query: CustomerActivityQuery) {
    let params = new HttpParams().set('range', query.range).set('failuresOnly', query.failuresOnly);
    if (query.platform) params = params.set('platform', query.platform);
    return this.http.get<CustomerActivityResponse>(`${this.url(cif)}/activity`, { params });
  }

  /** The top failure of the last 6 hours, e.g. for the New ticket "Latest error" box. */
  diagnosis(cif: string) {
    return this.http.get<CustomerDiagnosis>(`${this.url(cif)}/diagnosis`);
  }

  // ---------- still mock (no API used yet) ----------
  /** Mock logs; real customers have none here. The ticket page uses it for "Recent failed activity". */
  activityFor(cif: string): ActivityEvent[] {
    return ACTIVITY.filter(e => e.cif === cif).sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  incidentFor(category: string, platform: string): Incident | undefined {
    return INCIDENTS.find(i => i.category === category && i.platform === platform);
  }

  incidentById(id: string): Incident | undefined {
    return INCIDENTS.find(i => i.id === id);
  }

  activeIncidents(): Incident[] {
    return INCIDENTS;
  }

  // ---------- helpers ----------
  private url(cif: string) {
    return `${this.base}/${encodeURIComponent(cif)}`;
  }

  private remember(cif: string, at: Date) {
    // New Map, so the signal sees a new reference.
    this.verifiedAt.update(map => new Map(map).set(cif, at));
  }

  private forget(cif: string) {
    this.verifiedAt.update(map => {
      const next = new Map(map);
      next.delete(cif);
      return next;
    });
  }
}
