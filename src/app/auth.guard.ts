import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthenticationService } from './auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthenticationService);
  private router = inject(Router);


  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (this.authService.isLoggedIn()) {
      return this.checkRoleAndProceed(route);
    }

    this.router.navigate(['/login']);
    return false;
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