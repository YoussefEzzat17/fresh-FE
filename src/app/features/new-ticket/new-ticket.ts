import { Component, computed, inject, input, signal } from '@angular/core';
import { ValidatorFn } from '@angular/forms';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, distinctUntilChanged, filter, finalize, map, of, switchMap, tap } from 'rxjs';
import { DsCallout, DsPriority, DsPriorityBadge, PRIORITY_META } from '../../shared/ui';
import { CustomerService } from '../customer-search/customer.service';
import { TicketService, readApiError, ticketNo, toApiPriority, toDsPriority } from '../my-tickets/ticket.service';
import { ApiPlatform, CategoryDto, PrecheckWarning, PrioritySuggestionDto, SubCategoryDto } from '../my-tickets/ticket.models';
import { CustomerDetail, Platform } from '../customer-search/customer.models';

/** TRX-2026-01111. Used when the sub-category doesn't send its own referencePattern. */
const REFERENCE_PATTERN = /^TRX-\d{4}-\d{5}$/;

/** The server's pattern as a RegExp; the default one if it is missing or not valid in JavaScript. */
function referenceRegex(pattern: string | null): RegExp {
  if (!pattern) return REFERENCE_PATTERN;
  try {
    return new RegExp(pattern);
  } catch {
    return REFERENCE_PATTERN;
  }
}

/** Nested (subCategories) or the older flat list (rows with parentCode) → one tree of usable categories. */
function toTree(list: CategoryDto[]): CategoryDto[] {
  type Row = CategoryDto & { parentCode?: string | null };
  const rows = list as Row[];
  const isOn = (x: { active?: boolean }) => x.active !== false; // a missing "active" counts as active
  const nested = rows.some(c => Array.isArray(c.subCategories));
  const parents = rows.filter(c => !c.parentCode);
  const tree: CategoryDto[] = nested
    ? parents
    : parents.map(p => ({
        ...p,
        subCategories: rows.filter(s => s.parentCode === p.code) as unknown as SubCategoryDto[],
      }));
  return tree
    .filter(isOn)
    .map(c => ({ ...c, subCategories: (c.subCategories ?? []).filter(isOn) }))
    .filter(c => c.subCategories.length > 0);
}

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

  // ---------- the customer (GET /api/customers/{cif}): needs a verified caller ----------
  customer = signal<CustomerDetail | null>(null);
  state = signal<'loading' | 'ready' | 'not-verified' | 'not-found' | 'error'>('loading');
  loadError = signal('');

  /** The top failure of the last 6 hours (GET /diagnosis). The server attaches the latest error code itself. */
  latestErrorCode = signal<string | null>(null);

  // ---------- categories (GET /api/tickets/categories) ----------
  /** The "Category" select: active top-level categories, each with its sub-categories inside. */
  categories = signal<CategoryDto[]>([]);
  categoriesError = signal('');
  /** True once the list arrived, so an empty list says so instead of "Loading…". */
  categoriesLoaded = signal(false);

  // ---------- priority suggestion (GET .../suggested-priority) ----------
  suggestion = signal<PrioritySuggestionDto | null>(null);
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

  /** The chosen top-level category. */
  private parent = computed(() => this.categories().find(c => c.code === this.value().category));
  /** The "Issue" select: the active sub-categories of the chosen category (toTree already dropped the others). */
  issues = computed(() => this.parent()?.subCategories ?? []);
  /** The chosen sub-category, for referenceRequired, referenceHint and referencePattern. */
  issue = computed(() => this.issues().find(s => s.code === this.value().categoryCode));
  private parentName = computed(() => this.parent()?.name ?? '');
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
    // The customer first: the server only shows them to a verified caller.
    toObservable(this.cif)
      .pipe(
        tap(() => this.state.set('loading')),
        switchMap(cif =>
          this.service.get(cif).pipe(
            catchError(err => {
              const e = readApiError(err);
              this.state.set(
                e.code === 'CALLER_NOT_VERIFIED' ? 'not-verified' : e.status === 404 ? 'not-found' : 'error',
              );
              this.loadError.set(e.message);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(c => {
        this.customer.set(c);
        this.state.set('ready');
        this.service
          .diagnosis(c.cif)
          .pipe(catchError(() => of(null)))
          .subscribe(d => this.latestErrorCode.set(d?.topFailure?.errorCode ?? null));
      });

    // Load the categories, then select the first one (which selects its first issue below).
    this.api.categories().subscribe({
      next: list => {
        this.categories.set(toTree(list));
        this.categoriesLoaded.set(true);
        this.form.controls.category.setValue(this.categories()[0]?.code ?? '');
      },
      error: err => this.categoriesError.set(readApiError(err).message),
    });

    // A new category → pick its first issue.
    this.form.controls.category.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(code => {
        const parent = this.categories().find(c => c.code === code);
        const first = parent?.subCategories[0];
        this.form.controls.categoryCode.setValue(first?.code ?? '');
      });

    // A new issue → its default priority now, the reference rules, then the server's suggestion.
    this.form.controls.categoryCode.valueChanges
      .pipe(
        map(code => this.findIssue(code)),
        tap(issue => {
          this.suggestion.set(null);
          if (!issue) return;
          this.form.controls.priority.setValue(toDsPriority(issue.defaultPriority));
          this.setReferenceRules(issue);
        }),
        filter((issue): issue is SubCategoryDto => !!issue),
        switchMap(issue => this.api.suggestedPriority(issue.code).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe(s => {
        if (!s) return;
        this.suggestion.set(s);
        this.form.controls.priority.setValue(toDsPriority(s.suggestedPriority));
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

  private findIssue(code: string): SubCategoryDto | undefined {
    for (const c of this.categories()) {
      const found = c.subCategories.find(s => s.code === code);
      if (found) return found;
    }
    return undefined;
  }

  /** Required only when the sub-category says so; the format comes from its referencePattern. */
  private setReferenceRules(issue: SubCategoryDto) {
    const rules: ValidatorFn[] = [Validators.pattern(referenceRegex(issue.referencePattern))];
    if (issue.referenceRequired) rules.unshift(Validators.required);
    const reference = this.form.controls.reference;
    reference.setValidators(rules);
    reference.updateValueAndValidity();
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