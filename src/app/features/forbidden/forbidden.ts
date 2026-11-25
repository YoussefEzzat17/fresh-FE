import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/theme/auth/auth.service';
import { ROLE_HOME } from '../../core/theme/auth/role-home';
import { NAV_BY_ROLE } from '../../layout/nav-items';

/**
 * Shown when a signed-in user opens a page that belongs to another role (roleGuard sends them here).
 * The address bar keeps what they typed; the button takes them to their own home page.
 */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto mt-10 w-full max-w-[460px] rounded-[24px] bg-white p-8 text-center shadow-card"
             aria-labelledby="fb-title">
      <span class="mx-auto grid size-14 place-items-center rounded-full bg-warning-tint text-warning">
        <i class="pi pi-lock !text-2xl" aria-hidden="true"></i>
      </span>

      <p class="mt-5 text-xs font-bold uppercase tracking-[.1em] text-ink-3">Error 403</p>
      <h1 id="fb-title" class="mt-1 text-[26px] font-extrabold tracking-tight text-ink">
        Not available for your role
      </h1>
      <p class="mt-2 text-sm text-ink-2">You are signed in as {{ roleLabel() }}.</p>

      <div class="mt-6 flex">
        <a [routerLink]="homeLink()"
           class="flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-brand px-5 text-sm font-bold text-white hover:bg-brand-hover">
          <i class="pi pi-home" aria-hidden="true"></i> Go to home
        </a>
      </div>
    </section>
  `,
})
export class Forbidden {
  private readonly auth = inject(AuthService);

  /** "Agent", "Guide Admin" or "Reviewer": the same text the sidebar shows under the name. */
  protected readonly roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    return role ? NAV_BY_ROLE[role].userRole : '';
  });

  /** The user's own home page: /home for an agent, /review for a guide or reviewer. */
  protected readonly homeLink = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_HOME[role] : '/signin';
  });
}
