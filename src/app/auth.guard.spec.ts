import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { AuthenticationService } from './auth/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;
  let routerSpy: jasmine.SpyObj<Router>;

  function routeWithRole(role?: string): ActivatedRouteSnapshot {
    return { data: role ? { role } : {} } as unknown as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthenticationService', [
      'isLoggedIn',
      'getUserRole',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthenticationService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('should redirect to /login and deny access when the user is not logged in', () => {
    authServiceSpy.isLoggedIn.and.returnValue(false);

    const result = guard.canActivate(routeWithRole('publico'));

    expect(result).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should allow access when logged in and no specific role is required', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue('publico');

    const result = guard.canActivate(routeWithRole());

    expect(result).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should allow access when the user role matches the required role', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue('admin_polo');

    const result = guard.canActivate(routeWithRole('admin_polo'));

    expect(result).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should redirect admin_empresa users to /me when the role does not match', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue('admin_empresa');

    const result = guard.canActivate(routeWithRole('admin_polo'));

    expect(result).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/me']);
  });

  it('should redirect publico users to /chat when the role does not match', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue('publico');

    const result = guard.canActivate(routeWithRole('admin_polo'));

    expect(result).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/chat']);
  });

  it('should redirect admin_polo users to /empresas when the role does not match', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue('admin_polo');

    const result = guard.canActivate(routeWithRole('admin_empresa'));

    expect(result).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/empresas']);
  });

  it('should redirect unknown roles to /login', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue(null);

    const result = guard.canActivate(routeWithRole('admin_polo'));

    expect(result).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });
});
