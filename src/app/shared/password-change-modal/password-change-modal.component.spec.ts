import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PasswordChangeModalComponent } from './password-change-modal.component';
import { AuthenticationService } from '../../auth/auth.service';

describe('PasswordChangeModalComponent', () => {
  let component: PasswordChangeModalComponent;
  let fixture: ComponentFixture<PasswordChangeModalComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;
  const validForm = { invalid: false } as any;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthenticationService', [
      'changePasswordDirect',
    ]);

    await TestBed.configureTestingModule({
      imports: [PasswordChangeModalComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordChangeModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should require the current password', () => {
    component.currentPassword = '';
    component.newPassword = 'Abcdefg1';
    component.confirmPassword = 'Abcdefg1';

    component.onChangePassword(validForm);

    expect(component.currentPasswordError).toContain('contraseña actual');
    expect(authServiceSpy.changePasswordDirect).not.toHaveBeenCalled();
  });

  it('should reject mismatched new passwords', () => {
    component.currentPassword = 'old-pass';
    component.newPassword = 'Abcdefg1';
    component.confirmPassword = 'Different1';

    component.onChangePassword(validForm);

    expect(component.passwordsMismatch).toBeTrue();
    expect(authServiceSpy.changePasswordDirect).not.toHaveBeenCalled();
  });

  it('should reject a new password identical to the current one', () => {
    component.currentPassword = 'Abcdefg1';
    component.newPassword = 'Abcdefg1';
    component.confirmPassword = 'Abcdefg1';

    component.onChangePassword(validForm);

    expect(component.error).toContain('diferente');
    expect(authServiceSpy.changePasswordDirect).not.toHaveBeenCalled();
  });

  it('should call the auth service with the expected payload when everything is valid', () => {
    authServiceSpy.changePasswordDirect.and.returnValue(
      of({ success: true, message: 'Actualizada' })
    );
    component.currentPassword = 'old-pass';
    component.newPassword = 'Abcdefg1';
    component.confirmPassword = 'Abcdefg1';

    component.onChangePassword(validForm);

    expect(authServiceSpy.changePasswordDirect).toHaveBeenCalledWith({
      current_password: 'old-pass',
      new_password: 'Abcdefg1',
      confirm_password: 'Abcdefg1',
    });
    expect(component.successMessage).toBe('Actualizada');
  });

  it('should emit passwordChanged(true) on success', () => {
    authServiceSpy.changePasswordDirect.and.returnValue(
      of({ success: true, message: 'Actualizada' })
    );
    spyOn(component.passwordChanged, 'emit');

    component.currentPassword = 'old-pass';
    component.newPassword = 'Abcdefg1';
    component.confirmPassword = 'Abcdefg1';
    component.onChangePassword(validForm);

    expect(component.passwordChanged.emit).toHaveBeenCalledWith(true);
  });

  it('should surface a wrong-current-password error from the backend', () => {
    authServiceSpy.changePasswordDirect.and.returnValue(
      throwError(() => ({ error: { wrong_current: true } }))
    );
    component.currentPassword = 'old-pass';
    component.newPassword = 'Abcdefg1';
    component.confirmPassword = 'Abcdefg1';

    component.onChangePassword(validForm);

    expect(component.wrongCurrentPassword).toBeTrue();
  });

  it('closeModal should reset the form and emit modalClosed', () => {
    spyOn(component.modalClosed, 'emit');
    component.currentPassword = 'x';
    component.showModal = true;

    component.closeModal();

    expect(component.showModal).toBeFalse();
    expect(component.currentPassword).toBe('');
    expect(component.modalClosed.emit).toHaveBeenCalled();
  });
});
