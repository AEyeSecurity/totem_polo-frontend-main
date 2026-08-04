import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthenticationService } from './auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthenticationService);
  private router = inject(Router);


  canActivate(route: ActivatedRouteSnapshot): boolean | Observable<boolean> {
    if (this.authService.isLoggedIn()) {
      return this.checkRoleAndProceed(route);
    }

    // No hay token válido en storage (ej: se cerró el navegador). Antes de
    // mandar al login, probamos si hay una sesión "recordada" (cookie
    // remember_token, 30 días) que el backend pueda restaurar.
    return this.authService.tryRestoreSessionFromRememberCookie().pipe(
      map((restored) => {
        if (!restored) {
          this.router.navigate(['/login']);
          return false;
        }
        return this.checkRoleAndProceed(route);
      })
    );
  }

  private checkRoleAndProceed(route: ActivatedRouteSnapshot): boolean {
    const userRole = this.authService.getUserRole();
    const requiredRole = route.data['role'];

    if (requiredRole && userRole !== requiredRole) {
      // Redirigir según el rol del usuario
      this.redirectByRole(userRole);
      return false;
    }

    return true;
  }

  private redirectByRole(role: string | null): void {
    switch (role) {
      case 'admin_polo':
        this.router.navigate(['/empresas']);
        break;
      case 'admin_empresa':
        this.router.navigate(['/me']);
        break;
      case 'publico':
        this.router.navigate(['/chat']);
        break;
      default:
        this.router.navigate(['/login']);
        break;
    }
  }
}