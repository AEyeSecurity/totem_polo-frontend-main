import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthenticationService } from '../auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthenticationService', [
      'isLoggedIn',
      'getUserRole',
      'login',
      'logoutLocal',
      'requestPasswordReset',
    ]);
    authServiceSpy.isLoggedIn.and.returnValue(false);

    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should redirect immediately when the user is already logged in', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    authServiceSpy.getUserRole.and.returnValue('admin_polo');

    component.ngOnInit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/empresas']);
  });

  describe('validateUsername', () => {
    it('should flag an empty username as required', () => {
      component.username = '';
      component.validateUsername();
      expect(component.usernameError).toBeTrue();
      expect(component.usernameErrorMessage).toContain('requerido');
    });

    it('should flag an invalid email format', () => {
      component.username = 'not-an-email@';
      component.validateUsername();
      expect(component.usernameError).toBeTrue();
    });

    it('should flag a non-email username shorter than 3 characters', () => {
      component.username = 'ab';
      component.validateUsername();
      expect(component.usernameError).toBeTrue();
    });

    it('should accept a valid email', () => {
      component.username = 'user@empresa.com';
      component.validateUsername();
      expect(component.usernameError).toBeFalse();
    });

    it('should accept a valid non-email username', () => {
      component.username = 'usuario';
      component.validateUsername();
      expect(component.usernameError).toBeFalse();
    });
  });

  describe('validatePassword', () => {
    it('should flag an empty password as required', () => {
      component.password = '';
      component.validatePassword();
      expect(component.passwordError).toBeTrue();
    });

    it('should flag a password shorter than 6 characters', () => {
      component.password = '123';
      component.validatePassword();
      expect(component.passwordError).toBeTrue();
    });

    it('should accept a password with 6 or more characters', () => {
      component.password = '123456';
      component.validatePassword();
      expect(component.passwordError).toBeFalse();
    });
  });

  describe('onLogin', () => {
    beforeEach(() => {
      component.username = 'usuario@empresa.com';
      component.password = '123456';
    });

    it('should not call the auth service when validation fails', () => {
      component.username = '';
      component.onLogin();
      expect(authServiceSpy.login).not.toHaveBeenCalled();
      expect(component.loginMessage).toContain('corrige los errores');
    });

    it('should redirect according to the role on a successful login', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of(true));
      authServiceSpy.getUserRole.and.returnValue('admin_empresa');

      component.onLogin();
      tick(1200);

      expect(authServiceSpy.login).toHaveBeenCalledWith(
        'usuario@empresa.com',
        '123456',
        false
      );
      expect(component.successMessage).toContain('exitoso');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/me']);
    }));

    it('should show an error message when the credentials are wrong', () => {
      authServiceSpy.login.and.returnValue(of(false));

      component.onLogin();

      expect(component.usernameError).toBeTrue();
      expect(component.passwordError).toBeTrue();
      expect(component.loginMessage).toContain('Te quedan 4 intentos');
    });

    it('should block the user after 5 failed attempts', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of(false));

      for (let i = 0; i < 5; i++) {
        component.onLogin();
      }

      expect(component.isBlocked).toBeTrue();
      expect(component.blockTimeRemaining).toBe(300);
      expect(localStorage.getItem('loginBlock')).toBeTruthy();

      discardPeriodicTasks();
    }));

    it('should not attempt to log in while blocked', () => {
      component.isBlocked = true;
      component.blockTimeRemaining = 42;

      component.onLogin();

      expect(authServiceSpy.login).not.toHaveBeenCalled();
      expect(component.loginMessage).toContain('42 segundos');
    });

    it('should show a connection error message when the request fails with status 0', () => {
      authServiceSpy.login.and.returnValue(
        throwError(() => ({ status: 0 }))
      );

      component.onLogin();

      expect(component.loginMessage).toContain('Error de conexión');
    });
  });

  describe('password reset modal', () => {
    it('should validate that the reset email is required', () => {
      component.resetEmail = '';
      expect(component.validateResetEmail()).toBeFalse();
      expect(component.resetError).toContain('requerido');
    });

    it('should validate the reset email format', () => {
      component.resetEmail = 'invalid';
      expect(component.validateResetEmail()).toBeFalse();
    });

    it('should call the auth service when the email is valid', () => {
      component.resetEmail = 'user@empresa.com';
      authServiceSpy.requestPasswordReset.and.returnValue(
        of({ message: 'Enviado' })
      );

      component.requestPasswordReset();

      expect(authServiceSpy.requestPasswordReset).toHaveBeenCalledWith(
        'user@empresa.com'
      );
      expect(component.resetMessage).toBe('Enviado');
    });

    it('should not call the auth service when the email is invalid', () => {
      component.resetEmail = 'invalid';

      component.requestPasswordReset();

      expect(authServiceSpy.requestPasswordReset).not.toHaveBeenCalled();
    });
  });
});
