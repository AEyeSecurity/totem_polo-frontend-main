import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthenticationService } from './auth.service';
import { environment } from '../../environments/environment';

function makeJwt(expiresInSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  );
  return `${header}.${payload}.signature`;
}

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthenticationService);
    httpMock = TestBed.inject(HttpTestingController);

    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should POST form-encoded credentials and store the token in localStorage when keepLoggedIn is true', () => {
      let result: boolean | undefined;

      service.login('juan', 'secret', true).subscribe((ok) => (result = ok));

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Content-Type')).toBe(
        'application/x-www-form-urlencoded'
      );
      expect(req.request.body).toContain('username=juan');
      expect(req.request.body).toContain('password=secret');
      expect(req.request.body).toContain('grant_type=password');

      req.flush({
        access_token: 'abc123',
        token_type: 'bearer',
        tipo_rol: 'admin_polo',
      });

      expect(result).toBeTrue();
      expect(localStorage.getItem('sessionToken')).toBe('abc123');
      expect(localStorage.getItem('rol')).toBe('admin_polo');
      expect(localStorage.getItem('remember')).toBe('1');
      expect(sessionStorage.getItem('sessionToken')).toBeNull();
    });

    it('should store the token in sessionStorage when keepLoggedIn is false', () => {
      service.login('juan', 'secret', false).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      req.flush({
        access_token: 'xyz789',
        token_type: 'bearer',
        tipo_rol: 'publico',
      });

      expect(sessionStorage.getItem('sessionToken')).toBe('xyz789');
      expect(localStorage.getItem('sessionToken')).toBeNull();
    });

    it('should resolve to false and swallow the error when the request fails', () => {
      let result: boolean | undefined;

      service.login('juan', 'bad', false).subscribe((ok) => (result = ok));

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      req.flush(
        { detail: 'Credenciales inválidas' },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(result).toBeFalse();
    });
  });

  describe('getToken / getUserRole', () => {
    it('should prefer the traditional token over the Google OAuth token', () => {
      localStorage.setItem('sessionToken', 'trad-token');
      localStorage.setItem('access_token', 'google-token');

      expect(service.getToken()).toBe('trad-token');
    });

    it('should fall back to the Google OAuth token when no traditional token exists', () => {
      localStorage.setItem('access_token', 'google-token');

      expect(service.getToken()).toBe('google-token');
    });

    it('should return null when there is no token at all', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should prefer the traditional role over the Google OAuth role', () => {
      localStorage.setItem('rol', 'admin_empresa');
      localStorage.setItem('tipo_rol', 'publico');

      expect(service.getUserRole()).toBe('admin_empresa');
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when there is no token', () => {
      expect(service.isLoggedIn()).toBeFalse();
    });

    it('should return true for a non-expired token', () => {
      localStorage.setItem('sessionToken', makeJwt(3600));
      expect(service.isLoggedIn()).toBeTrue();
    });

    it('should return false and clear the token when it is expired', () => {
      localStorage.setItem('sessionToken', makeJwt(-3600));
      localStorage.setItem('rol', 'publico');

      expect(service.isLoggedIn()).toBeFalse();
      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(localStorage.getItem('rol')).toBeNull();
    });

    it('should return false for a malformed token without throwing', () => {
      localStorage.setItem('sessionToken', 'not-a-valid-jwt');
      expect(service.isLoggedIn()).toBeFalse();
    });
  });

  describe('logout', () => {
    it('should call the logout endpoint with the bearer token and clear the session', () => {
      localStorage.setItem('sessionToken', 'abc123');
      localStorage.setItem('rol', 'publico');

      let result: boolean | undefined;
      service.logout().subscribe((ok) => (result = ok));

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
      req.flush({ message: 'ok' });

      expect(result).toBeTrue();
      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(localStorage.getItem('rol')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should clear the session locally and navigate without an HTTP call when there is no token', () => {
      let result: boolean | undefined;
      service.logout().subscribe((ok) => (result = ok));

      httpMock.expectNone(`${environment.apiUrl}/logout`);
      expect(result).toBeTrue();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should still clear the session and navigate when the logout request fails', () => {
      localStorage.setItem('sessionToken', 'abc123');

      let result: boolean | undefined;
      service.logout().subscribe((ok) => (result = ok));

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(result).toBeFalse();
      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('logoutLocal', () => {
    it('should clear the session and navigate to login without any HTTP call', () => {
      localStorage.setItem('sessionToken', 'abc123');

      service.logoutLocal();

      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('setToken / setUserRole', () => {
    it('should persist the Google OAuth token and role in localStorage', () => {
      service.setToken('google-abc');
      service.setUserRole('admin_polo');

      expect(localStorage.getItem('access_token')).toBe('google-abc');
      expect(localStorage.getItem('tipo_rol')).toBe('admin_polo');
    });
  });

  describe('register', () => {
    it('should POST the new user payload and resolve true on success', () => {
      let result: boolean | undefined;
      service
        .register('juan', 'juan@test.com', 'secret', '20304050607')
        .subscribe((ok) => (result = ok));

      const req = httpMock.expectOne(`${environment.apiUrl}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        nombre: 'juan',
        email: 'juan@test.com',
        password: 'secret',
        cuil: '20304050607',
      });
      req.flush({ message: 'ok' });

      expect(result).toBeTrue();
    });
  });

  describe('password reset flows', () => {
    it('forgotPassword should POST the email to the forgot-password endpoint', () => {
      service.forgotPassword('user@test.com').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/forgot-password`);
      expect(req.request.body).toEqual({ email: 'user@test.com' });
      req.flush({ message: 'sent' });
    });

    it('verifyResetToken should return a normalized error response on failure', () => {
      let result: any;
      service.verifyResetToken('sometoken').subscribe((res) => (result = res));

      const req = httpMock.expectOne((r) =>
        r.url.includes('/password-reset/verify-token')
      );
      req.flush(
        { detail: 'Token expirado' },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(result.valid).toBeFalse();
      expect(result.expired).toBeTrue();
    });

    it('resetPasswordForgotten should POST to forgot-password/confirm without current_password', () => {
      service
        .resetPasswordForgotten({
          token: 't',
          new_password: 'Abcdef12',
          confirm_password: 'Abcdef12',
        })
        .subscribe();

      const req = httpMock.expectOne(
        `${environment.apiUrl}/forgot-password/confirm`
      );
      expect(req.request.body.token).toBe('t');
      req.flush({ message: 'ok' });
    });

    it('resetPasswordSecureLoggedUser should send the bearer token header', () => {
      localStorage.setItem('sessionToken', 'abc123');

      service
        .resetPasswordSecureLoggedUser({
          token: 't',
          current_password: 'old',
          new_password: 'Abcdef12',
          confirm_password: 'Abcdef12',
        })
        .subscribe();

      const req = httpMock.expectOne(
        `${environment.apiUrl}/password-reset/confirm-secure`
      );
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
      req.flush({ message: 'ok' });
    });
  });
});
