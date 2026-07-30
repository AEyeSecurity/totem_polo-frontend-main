import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PasswordResetComponent } from './password-reset.component';
import { AuthenticationService } from '../../auth/auth.service';

describe('PasswordResetComponent', () => {
  let component: PasswordResetComponent;
  let fixture: ComponentFixture<PasswordResetComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;
  let routerSpy: jasmine.SpyObj<Router>;

  function createComponent(token: string | null) {
    TestBed.configureTestingModule({
      imports: [PasswordResetComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(token ? { token } : {}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordResetComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthenticationService', [
      'verifyResetToken',
      'resetPasswordForgotten',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
  });

  it('should show an error when there is no token in the url', () => {
    createComponent(null);
    fixture.detectChanges();

    expect(component.error).toContain('Token no válido');
    expect(authServiceSpy.verifyResetToken).not.toHaveBeenCalled();
  });

  it('should mark the token as valid when the backend confirms it', () => {
    authServiceSpy.verifyResetToken.and.returnValue(
      of({ valid: true, email: 'user@test.com', user_name: 'Juan' })
    );
    createComponent('sometoken');
    fixture.detectChanges();

    expect(component.tokenValid).toBeTrue();
    expect(component.userEmail).toBe('user@test.com');
  });

  it('should mark the token as expired when the backend reports it', () => {
    authServiceSpy.verifyResetToken.and.returnValue(
      of({ valid: false, expired: true })
    );
    createComponent('sometoken');
    fixture.detectChanges();

    expect(component.tokenExpired).toBeTrue();
    expect(component.error).toContain('expirado');
  });

  describe('onResetPassword', () => {
    const validForm = { invalid: false } as any;

    beforeEach(() => {
      authServiceSpy.verifyResetToken.and.returnValue(of({ valid: true }));
      createComponent('sometoken');
      fixture.detectChanges();
    });

    it('should reject mismatched passwords', () => {
      component.newPassword = 'Abcdefg1';
      component.confirmPassword = 'Different1';

      component.onResetPassword(validForm);

      expect(component.passwordsMismatch).toBeTrue();
      expect(authServiceSpy.resetPasswordForgotten).not.toHaveBeenCalled();
    });

    it('should reject a weak password', () => {
      component.newPassword = 'weak';
      component.confirmPassword = 'weak';

      component.onResetPassword(validForm);

      expect(component.error).toBeTruthy();
      expect(authServiceSpy.resetPasswordForgotten).not.toHaveBeenCalled();
    });

    it('should call resetPasswordForgotten with a strong matching password', () => {
      authServiceSpy.resetPasswordForgotten.and.returnValue(
        of({ success: true, message: 'restablecida exitosamente' })
      );
      component.newPassword = 'Abcdefg1';
      component.confirmPassword = 'Abcdefg1';

      component.onResetPassword(validForm);

      expect(authServiceSpy.resetPasswordForgotten).toHaveBeenCalledWith({
        token: 'sometoken',
        new_password: 'Abcdefg1',
        confirm_password: 'Abcdefg1',
      });
      expect(component.resetCompleted).toBeTrue();
    });

    it('should surface a reused-password error from the backend', () => {
      authServiceSpy.resetPasswordForgotten.and.returnValue(
        throwError(() => ({ error: { password_reused: true } }))
      );
      component.newPassword = 'Abcdefg1';
      component.confirmPassword = 'Abcdefg1';

      component.onResetPassword(validForm);

      expect(component.passwordReused).toBeTrue();
      expect(component.tokenValid).toBeTrue();
    });
  });
});
