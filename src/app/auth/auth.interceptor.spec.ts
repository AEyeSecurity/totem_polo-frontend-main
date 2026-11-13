import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  HttpClient,
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthenticationService } from './auth.service';

describe('AuthInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthenticationService', [
      'getToken',
      'logoutLocal',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: AuthenticationService, useValue: authServiceSpy },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true,
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach the bearer token on private endpoints when a token exists', () => {
    authServiceSpy.getToken.and.returnValue('my-token');

    httpClient.get('https://api.test.com/empresas').subscribe();

    const req = httpMock.expectOne('https://api.test.com/empresas');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('should not attach any Authorization header when there is no token', () => {
    authServiceSpy.getToken.and.returnValue(null);

    httpClient.get('https://api.test.com/empresas').subscribe();

    const req = httpMock.expectOne('https://api.test.com/empresas');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should not attach the Authorization header on public endpoints even with a token', () => {
    authServiceSpy.getToken.and.returnValue('my-token');

    httpClient
      .post('https://api.test.com/forgot-password', { email: 'a@b.com' })
      .subscribe();

    const req = httpMock.expectOne('https://api.test.com/forgot-password');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should not attach Authorization on the verify-token endpoint', () => {
    authServiceSpy.getToken.and.returnValue('my-token');

    httpClient
      .post('https://api.test.com/password-reset/verify-token', {})
      .subscribe();

    const req = httpMock.expectOne(
      'https://api.test.com/password-reset/verify-token'
    );
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should add the ngrok-skip-browser-warning header for ngrok requests', () => {
    authServiceSpy.getToken.and.returnValue(null);

    httpClient.get('https://my-app.ngrok-free.dev/api/data').subscribe();

    const req = httpMock.expectOne('https://my-app.ngrok-free.dev/api/data');
    expect(req.request.headers.get('ngrok-skip-browser-warning')).toBe(
      'true'
    );
    req.flush({});
  });

  it('should attach both the ngrok header and the Authorization header when applicable', () => {
    authServiceSpy.getToken.and.returnValue('my-token');

    httpClient.get('https://my-app.ngrok-free.dev/api/data').subscribe();

    const req = httpMock.expectOne('https://my-app.ngrok-free.dev/api/data');
    expect(req.request.headers.get('ngrok-skip-browser-warning')).toBe(
      'true'
    );
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('should log out locally when an authenticated request gets a 401', () => {
    authServiceSpy.getToken.and.returnValue('stale-token');
    let status: number | undefined;

    httpClient.get('https://api.test.com/empresas').subscribe({ error: (e) => (status = e.status) });

    httpMock.expectOne('https://api.test.com/empresas').flush(
      { detail: 'Token inválido' },
      { status: 401, statusText: 'Unauthorized' }
    );
    expect(authServiceSpy.logoutLocal).toHaveBeenCalled();
    expect(status).toBe(401); // el error igual llega a quien hizo el pedido
  });

  it('should not log out on other errors (403, 500)', () => {
    authServiceSpy.getToken.and.returnValue('my-token');

    httpClient.get('https://api.test.com/me').subscribe({ error: () => {} });
    httpMock.expectOne('https://api.test.com/me').flush({}, { status: 403, statusText: 'Forbidden' });
    httpClient.get('https://api.test.com/empresas').subscribe({ error: () => {} });
    httpMock.expectOne('https://api.test.com/empresas').flush({}, { status: 500, statusText: 'Server Error' });

    expect(authServiceSpy.logoutLocal).not.toHaveBeenCalled();
  });

  it('should not log out on a 401 from /login or /logout (handled by the caller)', () => {
    authServiceSpy.getToken.and.returnValue('my-token');

    httpClient.post('https://api.test.com/login', {}).subscribe({ error: () => {} });
    httpMock.expectOne('https://api.test.com/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpClient.post('https://api.test.com/logout', {}).subscribe({ error: () => {} });
    httpMock.expectOne('https://api.test.com/logout').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logoutLocal).not.toHaveBeenCalled();
  });

  it('should not log out on a 401 from a request sent without our token', () => {
    authServiceSpy.getToken.and.returnValue(null);

    httpClient.get('https://api.test.com/empresas').subscribe({ error: () => {} });
    httpMock.expectOne('https://api.test.com/empresas').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logoutLocal).not.toHaveBeenCalled();
  });
});
