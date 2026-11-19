import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith,timer } from 'rxjs';
import { AuthService } from '../core/theme/auth/auth.service';
import { TicketService } from '../features/my-tickets/ticket.service';
import { DsAppShell, DsSidebarItem, DsSidebarUser } from '../shared/ui';
import { NAV_BY_ROLE } from './nav-items';

/**
 * The frame of every signed-in page: one `ds-app-shell` with the page projected inside it.
 * It is the only place that knows the user and the navigation; pages render their own content only.
 * Every route except `/signin` is a child of this layout (see app.routes.ts).
 */
@Component({
  selector: 'app-main-layout',
  imports: [DsAppShell, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ds-app-shell
      [subtitle]="nav()?.subtitle ?? ''"
      [sectionLabel]="nav()?.sectionLabel ?? ''"
      [items]="items()"
      [phoneItems]="phoneItems()"
      [activeId]="activeId()"
      [user]="user()"
      [notificationCount]="3"
      (itemSelect)="go($event)"
      (notificationsClick)="go({ id: 'alerts' })"
      (signOutClick)="signOut()"
      (avatarClick)="accountOpen.set(true)"
    >
      <router-outlet />
    </ds-app-shell>

    <!-- Phone: tapping the avatar opens this account sheet -->
    @if (accountOpen()) {
      <div class="fixed inset-0 z-40 bg-ink/40" (click)="accountOpen.set(false)" aria-hidden="true"></div>
      <section role="dialog" aria-modal="true" aria-labelledby="account-title"
               class="fixed inset-x-3 bottom-3 z-50 rounded-[20px] bg-white p-5 shadow-card"
               style="margin-bottom: env(safe-area-inset-bottom, 0px)">
        <p id="account-title" class="text-sm font-bold text-ink">{{ user()?.name }}</p>
        <p class="text-xs text-ink-3">{{ user()?.role }}</p>
        <div class="mt-4 flex gap-2">
          <button type="button" (click)="signOut()" [disabled]="signingOut()"
                  class="h-11 flex-1 rounded-control bg-brand text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50">
            <i class="pi pi-sign-out me-1.5" aria-hidden="true"></i>{{ signingOut() ? 'Signing out…' : 'Sign out' }}
          </button>
          <button type="button" (click)="accountOpen.set(false)"
                  class="h-11 rounded-control border border-line-2 px-4 text-sm font-bold text-ink hover:bg-page">
            Cancel
          </button>
        </div>
      </section>
    }
  `,
})
export class MainLayout {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly tickets = inject(TicketService);

  constructor() {
    // Agents only: refresh the "My tickets" badge now, then every minute.
    // takeUntilDestroyed stops the timer when the user signs out and the layout goes away.
    timer(0, 60_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.auth.user()?.role === 'agent') this.tickets.refreshOpenCount();
      });
  }

  protected readonly nav = computed(() => {
    const role = this.auth.user()?.role;
    return role ? NAV_BY_ROLE[role] : null;
  });
  
    /** The role's items, with the real open-ticket count on "My tickets". */
    protected readonly items = computed(() => withTicketCount(this.nav()?.items ?? [], this.tickets.openCount()));
    protected readonly phoneItems = computed(() => {
      const items = this.nav()?.phoneItems;
      return items ? withTicketCount(items, this.tickets.openCount()) : null;
    });

  protected readonly user = computed<DsSidebarUser | null>(() => {
    const u = this.auth.user();
    if (!u) return null;
    const initials = u.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return { name: u.name, role: NAV_BY_ROLE[u.role].userRole, initials };
  });

  /** First URL segment, e.g. `/tickets/42` gives `tickets`. */
  protected readonly activeId = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url.split(/[/?#]/)[1] ?? null),
    ),
    { initialValue: null },
  );

  protected go(item: Pick<DsSidebarItem, 'id'>) {
    this.router.navigate(['/', item.id]);
  }

  // ---------- sign out ----------
  protected readonly accountOpen = signal(false);
  protected readonly signingOut = signal(false);

  /** Ends the session on the server, forgets the badge, and goes to the sign-in page. */
  protected signOut() {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.auth.logout().subscribe({
      complete: () => {
        this.tickets.resetOpenCount();
        this.accountOpen.set(false);
        this.signingOut.set(false);
        this.router.navigateByUrl('/signin');
      },
    });
  }
}


/** Copies the items and puts `count` on the "tickets" item. No badge while unknown (null) or zero. */
function withTicketCount(items: DsSidebarItem[], count: number | null): DsSidebarItem[] {
  return items.map(item =>
    item.id !== 'tickets' ? item : { ...item, badge: count ? { count, tone: 'open' } : undefined },
  );
}
