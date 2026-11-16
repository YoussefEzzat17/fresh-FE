export type Role = 'agent' | 'guide' | 'reviewer';

export interface User {
    username: string;
    password: string;
    name: string;
    role: Role;
}

export interface SignInRequest {
    username: string;
    password: string;
}

/** Body of every 4xx from POST /api/auth/login (see Swagger). */
export interface SignInErrorResponse {
    code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | string;
    message: string;
    fieldErrors: Record<string, string>;
    path: string;
    timestamp: string;
    attemptsLeft?: number;
    retryAt?: string;
    retryAfterSeconds?: number;
}

export type SignInError =
    | { type: 'invalid'; message: string; attemptsLeft: number | null }
    | { type: 'locked'; message: string }
    | { type: 'expired'; message: string }
    | { type: 'unavailable'; message: string }
    | null;
