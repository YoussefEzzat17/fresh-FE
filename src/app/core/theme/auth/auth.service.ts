import { computed, inject, Injectable, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Role, SignInError, SignInRequest, User } from "./auth.models";
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

/** The server enforces the real lockout (5 tries / 15 min). Kept for the countdown UI. */
export const LOCK_MS = 15 * 1_000;

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
            map(res => this.onLoggedIn(res)),
            catchError((err: HttpErrorResponse) => throwError(() => this.toSignInError(err))),
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

    /** 423 (or a lock code) means the account is locked; anything else is wrong credentials. */
    private toSignInError(err: HttpErrorResponse): SignInError {
        const code = err?.error?.code as string | undefined;
        if (err?.status === 423 || code === 'ACCOUNT_LOCKED' || code === 'USER_LOCKED') {
            return 'locked';
        }
        return 'invalid';
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
