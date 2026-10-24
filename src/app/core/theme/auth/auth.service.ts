import { computed, Injectable, signal } from "@angular/core";
import { SignInRequest, User } from "./auth.models";
import { delay, Observable, of, throwError } from 'rxjs';


@Injectable({ providedIn: 'root'})
export class AuthService {

    private readonly _user = signal<User | null>(null);
    readonly user = this._user.asReadonly();
    readonly isSignIn = computed(() => this._user() !==null);

    SignIn(req: SignInRequest): Observable<User> {
        const users: Record<string, User>={
            'mona.hassan': {
                username: 'mona.hassan',
                password: 'Mona@123',
                name: 'Mona Hassan',
                role: 'agent' 
            },
            'youssef.adel': { 
                username: 'youssef.adel', 
                password: 'Yous@123',
                name: 'Youssef Adel', 
                role: 'guide' 
            },
            'nour.saleh': { 
                username: 'nour.saleh',
                password: 'Nour@123', 
                name: 'Nour Saleh', 
                role: 'reviewer' 
            },
        };
                
        const user = users[req.username];
        if (!user || req.password.length < 6) {
            return throwError(() => 'invalid').pipe(delay(600));
        }
        this._user.set(user);
        return of(user).pipe(delay(600));
    }

    signOut() {
        this._user.set(null);
    }
}