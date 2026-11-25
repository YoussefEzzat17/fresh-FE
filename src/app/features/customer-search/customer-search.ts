import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, catchError, filter, switchMap, tap } from 'rxjs';
import { CustomerService } from './customer.service';
import { CustomerSearchResult, EnrollmentStatus } from './customer.models';
import { VerifyCallerDialog } from './components/verify-caller-dialog/verify-caller-dialog';
import { readApiError, titleCase } from '../my-tickets/ticket.service';

/**
 * What the API can search by: CIF (100245 or CIF-100245), national ID, mobile (01…, 20…, +20…)
 * or ticket number (#2001). Spaces are ignored. Names are not searchable.
 */
const SEARCH_PATTERN = /^(CIF-|#|\+)?\d+$/i;

@Component({
  selector: 'app-customer-search',
  imports: [ReactiveFormsModule, VerifyCallerDialog],
  templateUrl: './customer-search.html',
  styleUrl: './customer-search.css',
})
export class CustomerSearch {
  private service = inject(CustomerService);
  private router = inject(Router);

  // Start from the last search, so "back" from Customer 360 keeps the results.
  search = new FormControl(this.service.lastQuery(), { nonNullable: true });
  /** Changes only when the user presses Search. */
  query = signal(this.service.lastQuery());

  invalidQuery = computed(() => !!this.query() && !SEARCH_PATTERN.test(this.query()));

  // ---------- results (GET /api/customers/search) ----------
  results = signal<CustomerSearchResult[]>([]);
  /** The server's "No match…" text when nothing matched. */
  noMatchMessage = signal('');
  loading = signal(false);
  error = signal('');

  /** Customer the verify popup is open for. */
  verifying = signal<CustomerSearchResult | null>(null);

  enrollment: Record<EnrollmentStatus, { label: string; style: string }> = {
    ENROLLED: { label: 'Digital banking active', style: 'bg-success-tint text-success' },
    SUSPENDED: { label: 'Digital banking suspended', style: 'bg-danger-tint text-danger' },
    NOT_ENROLLED: { label: 'Not enrolled', style: 'bg-page text-ink-3' },
  };
  titleCase = titleCase;

  constructor() {
    // Every new valid query → ask the server. switchMap drops a slower older search.
    toObservable(this.query)
      .pipe(
        filter(q => !!q && SEARCH_PATTERN.test(q)),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(q =>
          this.service.search(q).pipe(
            catchError(err => {
              // e.g. 429 TOO_MANY_SEARCHES: "More than 30 searches in 10 minutes"
              this.error.set(readApiError(err).message);
              this.results.set([]);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        this.results.set(res.results);
        this.noMatchMessage.set(res.message ?? '');
        this.loading.set(false);
        // After a reload we don't know who is verified: ask the server for each match.
        for (const c of res.results) this.service.checkVerification(c.cif).subscribe({ error: () => {} });
      });
  }

  onSearch() {
    const q = this.search.value.replace(/\s+/g, '');
    this.query.set(q);
    this.service.lastQuery.set(q);
  }

  isVerified(c: CustomerSearchResult) {
    return this.service.isVerified(c.cif);
  }

  /** The dialog already told the server; just close it and open the customer. */
  onConfirmed(c: CustomerSearchResult) {
    this.verifying.set(null);
    this.open360(c);
  }

  onFailed() {
    this.verifying.set(null);
  }

  open360(c: CustomerSearchResult) {
    this.router.navigate(['/customer-search', c.cif]);
  }
}
