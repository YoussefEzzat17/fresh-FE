import { Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, finalize, map, of, switchMap } from 'rxjs';
import { DsCallout, DsPriority, DsPriorityBadge, PRIORITY_META } from '../../shared/ui';
import { CustomerService } from '../customer-search/customer.service';
import { TicketService, readApiError, ticketNo, toApiPriority, toDsPriority } from '../my-tickets/ticket.service';
import { ApiPlatform, CategoryDto, PrecheckWarning } from '../my-tickets/ticket.models';
import { Platform } from '../customer-search/customer.models';

/** TRX-2026-01111 */
const REFERENCE_PATTERN = /^TRX-\d{4}-\d{5}$/;

@Component({
  selector: 'app-new-ticket',
  imports: [ReactiveFormsModule, RouterLink, DsCallout, DsPriorityBadge],
  templateUrl: './new-ticket.html',
})
export class NewTicket {
  private service = inject(CustomerService);
  private api = inject(TicketService);
  private router = inject(Router);

  /** From the URL /customer-search/:cif/new-ticket. */
  cif = input.required<string>();

  customer = computed(() => this.service.getByCif(this.cif()));
  verified = computed(() => this.service.isVerified(this.cif()));

  /** Latest failed event (mock logs). The server attaches the real error code itself. */
  latestError = computed(() => this.service.activityFor(this.cif()).find(e => e.failed));

  // ---------- categories (GET /api/tickets/categories) ----------
  /** Every active category: top-level rows (parentCode null) and their sub-categories. */
  categories = signal<CategoryDto[]>([]);
  categoriesError = signal('');
  /** The "Category" select. */
  parents = computed(() => this.categories().filter(c => !c.parentCode));
  priorities: DsPriority[] = ['critical', 'high', 'medium', 'low'];
  platforms: { id: ApiPlatform; label: string; icon: string }[] = [
    { id: 'MOBILE', label: 'Mobile', icon: 'pi pi-mobile' },
    { id: 'WEB', label: 'Web', icon: 'pi pi-desktop' },
    { id: 'BRANCH', label: 'Branch', icon: 'pi pi-building' },
  ];

  form = inject(NonNullableFormBuilder).group({
    platform: ['MOBILE' as ApiPlatform],
    priority: ['high' as DsPriority],
    /** The parent category's code. */
    category: [''],
    /** The sub-category's code: what the API calls categoryCode. */
    categoryCode: [''],
    reference: ['', [Validators.pattern(REFERENCE_PATTERN)]],
    report: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  /** The form value as a signal, so the preview and the callouts update while the agent types. */
  value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** The "Issue" select: the sub-categories of the chosen category. */
  issues = computed(() => this.categories().filter(c => c.parentCode === this.value().category));
  /** The chosen sub-category, for referenceRequired and referenceHint. */
  issue = computed(() => this.categories().find(c => c.code === this.value().categoryCode));
  private parentName = computed(() => this.parents().find(p => p.code === this.value().category)?.name ?? '');
  sla = computed(() => PRIORITY_META[this.value().priority].slaHours);
  incident = computed(() =>
    this.service.incidentFor(this.parentName(), this.value().platform.toLowerCase() as Platform),
  );

  // ---------- precheck: is there already an open ticket for this problem? ----------
  private precheckKey = computed(() => ({ cif: this.cif(), categoryCode: this.value().categoryCode }));
  /** Warnings from the server. A failed precheck shows nothing — create still validates. */
  warnings = signal<PrecheckWarning[]>([]);

  // ---------- submit ----------
  saving = signal(false);
  submitError = signal('');
  /** Set by 409 DUPLICATE_OPEN_TICKET: offer "Create anyway". */
  duplicate = signal<string | null>(null);
  /** Server-side messages for single fields (fieldErrors or REFERENCE_*). */
  serverErrors = signal<Record<string, string>>({});

  no = ticketNo;

  constructor() {
    // Load the categories, then select the first category (which selects its first issue below).
    this.api.categories().subscribe({
      next: list => {
        this.categories.set(list);
        this.form.controls.category.setValue(this.parents()[0]?.code ?? '');
      },
      error: err => this.categoriesError.set(readApiError(err).message),
    });

    // A new category → pick its first issue.
    this.form.controls.category.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(code => {
        const first = this.categories().find(c => c.parentCode === code);
        this.form.controls.categoryCode.setValue(first?.code ?? '');
      });

    // A new issue → start from its default priority, and ask for a reference only when it needs one.
    this.form.controls.categoryCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(code => {
        const issue = this.categories().find(c => c.code === code);
        if (!issue) return;
        this.form.controls.priority.setValue(toDsPriority(issue.defaultPriority));
        const reference = this.form.controls.reference;
        reference.setValidators(
          issue.referenceRequired
            ? [Validators.required, Validators.pattern(REFERENCE_PATTERN)]
            : [Validators.pattern(REFERENCE_PATTERN)],
        );
        reference.updateValueAndValidity();
      });

    // Customer or issue changed → ask the server for duplicate warnings.
    toObservable(this.precheckKey)
      .pipe(
        distinctUntilChanged((a, b) => a.cif === b.cif && a.categoryCode === b.categoryCode),
        switchMap(body =>
          body.categoryCode
            ? this.api.precheck(body).pipe(
                map(r => r.warnings),
                catchError(() => of([])),
              )
            : of([]),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(w => this.warnings.set(w));

    // Editing a field clears the server's message for it.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverErrors()).length) this.serverErrors.set({});
      this.duplicate.set(null);
    });
  }

  reportInvalid() {
    const c = this.form.controls.report;
    return (c.invalid && (c.dirty || c.touched)) || !!this.serverErrors()['description'];
  }

  referenceInvalid() {
    const c = this.form.controls.reference;
    return (c.invalid && (c.dirty || c.touched)) || !!this.serverErrors()['reference'];
  }

  submit(allowDuplicate = false) {
    if (this.form.invalid || !this.form.controls.categoryCode.value) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.submitError.set('');
    this.duplicate.set(null);

    this.api
      .create({
        cif: this.cif(),
        categoryCode: v.categoryCode,
        priority: toApiPriority(v.priority),
        platform: v.platform,
        description: v.report.trim(),
        reference: v.reference.trim() || undefined,
        allowDuplicate: allowDuplicate || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ticket => this.router.navigate(['/tickets', ticketNo(ticket.number)]),
        error: err => this.showError(err),
      });
  }

  cancel() {
    this.router.navigate(['/customer-search', this.cif()]);
  }

  /** Turn the server's error code into the right message in the right place. */
  private showError(err: unknown) {
    const e = readApiError(err);
    switch (e.code) {
      case 'DUPLICATE_OPEN_TICKET':
        this.duplicate.set(e.message);
        return;
      case 'REFERENCE_REQUIRED':
      case 'REFERENCE_FORMAT':
        this.serverErrors.set({ reference: e.message });
        return;
      case 'VALIDATION_FAILED':
        if (Object.keys(e.fieldErrors).length) {
          this.serverErrors.set(e.fieldErrors);
          return;
        }
        break;
    }
    // CALLER_NOT_VERIFIED, CUSTOMER_NOT_FOUND, CATEGORY_*, network, 5xx …
    this.submitError.set(e.message);
  }
}