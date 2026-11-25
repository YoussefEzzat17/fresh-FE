import { Component, computed, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CustomerSearchResult, VerificationCheck } from '../../customer.models';
import { CustomerService } from '../../customer.service';
import { readApiError, titleCase } from '../../../my-tickets/ticket.service';

/** The identity checks the API knows (Swagger: VerificationCheck), with what the agent asks. */
const CHECKS: { id: VerificationCheck; label: string }[] = [
  { id: 'DATE_OF_BIRTH', label: 'Date of birth matches' },
  { id: 'NATIONAL_ID_LAST4', label: 'Last 4 digits of the national ID match' },
  { id: 'MOBILE_ON_FILE', label: 'Calling from the mobile number on file' },
  { id: 'RECENT_TRANSACTION', label: 'Describes a recent transaction correctly' },
];

@Component({
  selector: 'app-verify-caller-dialog',
  templateUrl: './verify-caller-dialog.html',
  host: { '(document:keydown.escape)': 'closed.emit()' }, // Esc closes the popup
})
export class VerifyCallerDialog {
  private service = inject(CustomerService);

  customer = input.required<CustomerSearchResult>();
  /** The server accepted the checks: the caller is verified. */
  confirmed = output<CustomerSearchResult>();
  /** The caller failed, and the server recorded it. */
  failed = output<CustomerSearchResult>();
  closed = output<void>();

  checks = CHECKS;
  /** The checks the caller passed. */
  passed = signal<VerificationCheck[]>([]);
  checkedCount = computed(() => this.passed().length);
  /** The server needs at least two different checks (422 TOO_FEW_CHECKS). */
  canConfirm = computed(() => this.checkedCount() >= 2 && !this.busy());

  busy = signal(false);
  error = signal('');

  firstName = computed(() => this.customer().fullName.split(' ')[0]);
  segment = computed(() => titleCase(this.customer().segment));

  isChecked(id: VerificationCheck) {
    return this.passed().includes(id);
  }

  toggle(id: VerificationCheck) {
    this.passed.update(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
    this.error.set('');
  }

  confirm() {
    if (!this.canConfirm()) return;
    this.busy.set(true);
    this.service
      .verify(this.customer().cif, this.passed())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.confirmed.emit(this.customer()),
        error: err => this.error.set(readApiError(err).message),
      });
  }

  callerFailed() {
    if (this.busy()) return;
    this.busy.set(true);
    this.service
      .verificationFailed(this.customer().cif)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.failed.emit(this.customer()),
        error: err => this.error.set(readApiError(err).message),
      });
  }
}
