import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/theme/auth/auth.service';
import { ROLE_HOME } from '../../core/theme/auth/role-home';

/**
 * Shown for any URL that matches no route (the `**` route in app.routes.ts).
 * Signed in → the button goes to the user's home page. Signed out → to the sign-in page.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="grid min-h-screen place-items-center bg-page px-4 py-10">
      <section class="w-full max-w-[460px] rounded-[24px] bg-white p-8 text-center shadow-card" aria-labelledby="nf-title">
        <span class="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-brand">
          <i class="pi pi-compass !text-2xl" aria-hidden="true"></i>
        </span>

        <p class="mt-5 text-xs font-bold uppercase tracking-[.1em] text-ink-3">Error 404</p>
        <h1 id="nf-title" class="mt-1 text-[26px] font-extrabold tracking-tight text-ink">Page not found</h1>

        <div class="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <a [routerLink]="home().link"
             class="flex h-11 items-center sm:flex-1 justify-center gap-2 rounded-control bg-brand px-5 text-sm font-bold text-white hover:bg-brand-hover">
            <i class="pi pi-home" aria-hidden="true"></i> {{ home().label }}
          </a>
        </div>
      </section>
    </main>
  `,
})
export class NotFound {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  constructor() {
    // Name the browser tab while this page is open, and put the old name back when it closes
    // (the other routes have no title of their own to replace it).
    const title = inject(Title);
    const previous = title.getTitle();
    title.setTitle('Page not found');
    inject(DestroyRef).onDestroy(() => title.setTitle(previous));
  }

  /** The wrong address, e.g. /tikets. */
  protected readonly url = computed(() => this.router.url);

  /** Signed in → their home page; signed out → sign in (home would send them there anyway). */
  protected readonly home = computed(() => {
    const user = this.auth.user();
    return user
      ? { link: ROLE_HOME[user.role], label: 'Go to home' }
      : { link: '/signin', label: 'Go to sign in' };
  });

  /** Back to the previous page; if this page was opened directly, go home instead. */
  protected back() {
    if (window.history.length > 1) this.location.back();
    else this.router.navigateByUrl(this.home().link);
  }
}
