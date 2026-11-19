import { computed, inject, Injectable, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Role, SignInError, SignInRequest, User, SignInErrorResponse } from "./auth.models";
import { Observable, catchError, finalize, from, map, of, switchMap, throwError } from 'rxjs';

/** Lock policy: 5 wrong passwords in 15 minutes → locked for 15 minutes. The server enforces it; this drives the progress bar. */
export const LOCK_MS = 15 * 60 * 1_000;

/** localStorage keys, so a refresh or a new tab keeps the session and the lock. */
const LOCK_KEY = 'dsp.signin.lock';
const ACCESS_KEY = 'dsp.auth.accessToken';
const REFRESH_KEY = 'dsp.auth.refreshToken';

export interface AccountLock {
    username: string;
    until: Date;
}

/** What POST /api/auth/login returns. */
interface LoginResponse {
    accessToken: string;
    refreshToken: string;
}

@Injectable({ providedIn: 'root'})
export class AuthService {

    private readonly http = inject(HttpClient);

    private readonly _user = signal<User | null>(this.restoreUser());
    readonly user = this._user.asReadonly();
    readonly isSignIn = computed(() => this._user() !==null);

    /** The account that is locked right now (null = nothing locked). */
    private readonly _lock = signal<AccountLock | null>(this.readLock());
    readonly lock = this._lock.asReadonly();

    SignIn(req: SignInRequest): Observable<User> {
        const username = req.username.trim();
        return from(this.sha256Hex(req.password)).pipe(
            switchMap(passwordHash => this.http.post<LoginResponse>('/api/auth/login', {
                username,
                password: passwordHash,
            })),
            map(res => {
                this.clearLock();
                return this.onLoggedIn(res);
            }),
            catchError((err: HttpErrorResponse) => throwError(() => this.toSignInError(err, username))),
        );
    }

    private async sha256Hex(password: string): Promise<string> {
        const data = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /** Stores the tokens, builds the user from the access token, and marks us signed in. */
    private onLoggedIn(res: LoginResponse): User {
        this.saveToken(ACCESS_KEY, res.accessToken);
        this.saveToken(REFRESH_KEY, res.refreshToken);
        const user = this.userFromToken(res.accessToken);
        this._user.set(user);
        return user;
    }

    /** The access token for the HTTP interceptor to attach (null = not signed in). */
    accessToken(): string | null {
        try {
            return localStorage.getItem(ACCESS_KEY);
        } catch {
            return null;
        }
    }

    /** True when the stored access token has a user and has not expired yet. Reads the token only; the server still checks it. */
    hasValidAccessToken(): boolean {
        const token = this.accessToken();
        const payload = token ? this.decodeJwt(token) : null;
        if (!payload?.sub) return false;
        return !payload.exp || payload.exp * 1000 > Date.now();
    }

    /** The refresh token from the last login (null = none stored). */
    refreshToken(): string | null {
        try {
            return localStorage.getItem(REFRESH_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Trades the refresh token for a new access token and stores it.
     * Errors (no token, or the backend rejected it) are left to the caller, which signs out.
     */
    refresh(): Observable<string> {
        const refreshToken = this.refreshToken();
        if (!refreshToken) return throwError(() => new Error('No refresh token'));

        return this.http.post<LoginResponse>('/api/auth/refresh', { refreshToken }).pipe(
            map(res => {
                this.onLoggedIn(res);
                return res.accessToken;
            }),
        );
    }

    /** On startup, bring the session back from a stored access token. */
    private restoreUser(): User | null {
        const token = this.accessToken();
        if (!token) return null;

        const payload = this.decodeJwt(token);
        if (!payload) return null;


        if (payload.exp && payload.exp * 1000 <= Date.now() && !this.refreshToken()) {
            this.saveToken(ACCESS_KEY, null);
            return null;
        }
        return this.userFromToken(token);
    }

    /** Called when the lock timer ended and the user goes back to the form. */
    clearLock() {
        this._lock.set(null);
        this.save(LOCK_KEY, null);
    }

    /**
     * Ends the session on the server (every token stops working), then forgets it here.
     * We sign out locally even if the call fails (offline, token already expired), so the button always works.
     */
    logout(): Observable<void> {
        if (!this.accessToken()) {
            this.signOut();
            return of(undefined);
        }
        return this.http.post<void>('/api/auth/logout', {}).pipe(
            catchError(() => of(undefined)),
            finalize(() => this.signOut()),
        );
    }

    signOut() {
        this._user.set(null);
        this.saveToken(ACCESS_KEY, null);
        this.saveToken(REFRESH_KEY, null);
    }

    /** The JWT payload carries the username (sub) and the role. */
    private userFromToken(token: string): User {
        const payload = this.decodeJwt(token);
        return {
            username: payload?.sub ?? '',
            password: '',
            name: payload?.sub ?? '',
            role: this.mapRole(payload?.role),
        };
    }

    /** Reads the middle part of the JWT (base64url) without verifying it. */
    private decodeJwt(token: string): { sub?: string; role?: string; exp?: number } | null {
        try {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(base64));
        } catch {
            return null;
        }
    }

    /** Backend roles (AGENT / GUIDE_ADMIN / REVIEWER) → the frontend Role. */
    private mapRole(role: string | undefined): Role {
        switch (role) {
            case 'GUIDE_ADMIN': return 'guide';
            case 'REVIEWER': return 'reviewer';
            default: return 'agent';
        }
    }

    /** Maps the backend contract: 423 → lock screen, 401 → wrong credentials, anything else → server problem. */
    private toSignInError(err: HttpErrorResponse, username: string): SignInError {
        const body = (err.error ?? {}) as Partial<SignInErrorResponse>;

        if (err.status === 423 || body.code === 'ACCOUNT_LOCKED' || body.code === 'USER_LOCKED') {
            this.startLock(username, body);
            return {
                type: 'locked',
                message: body.message ?? 'Your account is locked. Try again in 15 minutes.',
            };
        }

        if (err.status === 401 || body.code === 'INVALID_CREDENTIALS') {
            return {
                type: 'invalid',
                message: body.message ?? 'Username or password is incorrect.',
                attemptsLeft: body.attemptsLeft ?? null,
            };
        }

        return {
            type: 'unavailable',
            message: err.status === 0
                ? "We can't reach the server. Check your connection and try again."
                : 'Something went wrong on our side. Please try again.',
        };
    }

    /**
     * Starts the lock screen countdown.
     * retryAfterSeconds is relative, so a wrong PC clock can't break it; then retryAt; then the 15-minute policy.
     */
    private startLock(username: string, body: Partial<SignInErrorResponse>) {
        const ms =
            body.retryAfterSeconds != null ? body.retryAfterSeconds * 1000
            : body.retryAt ? Math.max(0, Date.parse(body.retryAt) - Date.now())
            : LOCK_MS;

        const lock: AccountLock = { username, until: new Date(Date.now() + ms) };
        this._lock.set(lock);
        this.save(LOCK_KEY, { username, until: lock.until.toISOString() });
    }

    /** The saved lock stays until the user presses "Sign in" after the timer, even if it already ran out. */
    private readLock(): AccountLock | null {
        const saved = this.read<{ username: string; until: string }>(LOCK_KEY);
        return saved ? { username: saved.username, until: new Date(saved.until) } : null;
    }

    private read<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null; // private window or blocked storage
        }
    }

    private save(key: string, value: unknown) {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // storage unavailable: the lock still works until the page is refreshed
        }
    }

    /** Tokens are stored raw (not JSON) so the interceptor can read them directly. */
    private saveToken(key: string, value: string | null) {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch {
            // storage unavailable
        }
    }
}
