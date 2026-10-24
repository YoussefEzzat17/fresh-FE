import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CustomerService } from '../../core/theme/auth/customer.service';
import { Customer, DigitalStatus, maskMobile } from './customer.models';
import { VerifyCallerDialog } from './components/verify-caller-dialog/verify-caller-dialog';

/** Only digits (CIF) OR only letters and spaces (name), never mixed. */
const SEARCH_PATTERN = /^(\d+|[A-Za-z؀-ۿ\s]+)$/;

@Component({
  selector: 'app-customer-search',
  imports: [ReactiveFormsModule, VerifyCallerDialog],
  templateUrl: './customer-search.html',
  styleUrl: './customer-search.css',
})
export class CustomerSearch {
  private service = inject(CustomerService);

  search = new FormControl('', { nonNullable: true });
  /** Changes only when the user presses Search. */
  query = signal('');

  invalidQuery = computed(() => !!this.query() && !SEARCH_PATTERN.test(this.query()));
  results = computed(() => (this.invalidQuery() ? [] : this.service.search(this.query())));

  /** CIFs whose caller passed verification (Ahmed starts verified, as in the design). */
  verified = signal(new Set<string>(['123456']));
  /** Customer the verify popup is open for. */
  verifying = signal<Customer | null>(null);

  examples = [
    { cif: '123456', name: 'Ahmed Ali' },
    { cif: '889900', name: 'Mai Adel' },
    { cif: '445566', name: 'Laila Mostafa' },
  ];

  statusStyle: Record<DigitalStatus, string> = {
    active: 'bg-success-tint text-success',
    locked: 'bg-danger-tint text-danger',
    inactive: 'bg-page text-ink-3',
  };

  mask = maskMobile;

  onSearch() {
    this.query.set(this.search.value.trim());
  }

  useExample(cif: string) {
    this.search.setValue(cif);
    this.onSearch();
  }

  isVerified(c: Customer) {
    return this.verified().has(c.cif);
  }

  onConfirmed(c: Customer) {
    // A new Set, so the signal sees a new reference and the view updates.
    this.verified.update(set => new Set(set).add(c.cif));
    this.verifying.set(null);
  }

  onFailed() {
    this.verifying.set(null);
  }

  open360(c: Customer) {
    // TODO: navigate to the Customer 360 page
    console.log('open 360', c.cif);
  }
}
