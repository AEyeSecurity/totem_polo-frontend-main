// shared/password-change-modal/password-change-modal.component.ts
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthenticationService } from '../../auth/auth.service';
import {
  validatePassword,
  getPasswordRequirements,
  doPasswordsMatch,
  PasswordValidationResult,
} from '../password-validation';

@Component({
  selector: 'app-password-change-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-change-modal.component.html',
  styleUrls: ['./password-change-modal.component.css'],
})
export class PasswordChangeModalComponent {
  private authService = inject(AuthenticationService);

  // Campos del formulario - INCLUYE contraseña actual (usuario logueado)
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  @Input() showModal = false;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() passwordChanged = new EventEmitter<boolean>();

  // Estados
  message = '';
  error = '';
  loading = false;

  // Validaciones específicas
  currentPasswordError = '';
  passwordReused = false;
  validatingPassword = false;
  successMessage = '';

  // Propiedades para mostrar errores específicos
  wrongCurrentPassword = false;
  passwordsMismatch = false;

  openModal() {
    this.showModal = true;
    this.clearForm();
    this.clearMessages();
  }

  closeModal() {
    this.showModal = false;
    this.clearForm();
    this.clearMessages();
    this.modalClosed.emit();
  }

  clearMessages() {
    this.error = '';
    this.message = '';
    this.successMessage = '';
    this.currentPasswordError = '';
    this.passwordReused = false;
    this.wrongCurrentPassword = false;
    this.passwordsMismatch = false;
  }

  onNewPasswordChange() {
    this.passwordReused = false;
    this.error = '';
    this.currentPasswordError = '';
    this.wrongCurrentPassword = false;
    this.passwordsMismatch = false;
  }

  onCurrentPasswordChange() {
    this.currentPasswordError = '';
    this.wrongCurrentPassword = false;
    this.error = '';
  }

  onConfirmPasswordChange() {
    this.passwordsMismatch = false;
    this.error = '';
  }

  // MÉTODO PRINCIPAL - Cambio de contraseña para usuarios LOGUEADOS
  onChangePassword(form: NgForm) {
    this.clearMessages();

    // Validaciones del formulario
    if (form.invalid) {
      this.error = 'Por favor, completa todos los campos correctamente.';
      return;
    }

    // Validación contraseña actual obligatoria
    if (!this.currentPassword || this.currentPassword.trim() === '') {
      this.currentPasswordError = 'Debes ingresar tu contraseña actual.';
      this.error = 'La contraseña actual es obligatoria.';
      return;
    }

    // Validar que las contraseñas nuevas coincidan
    if (this.newPassword !== this.confirmPassword) {
      this.passwordsMismatch = true;
      this.error = 'Las contraseñas nuevas no coinciden.';
      return;
    }

    // Validaciones de seguridad de la nueva contraseña
    const passwordValidation = this.validatePassword(this.newPassword);
    if (!passwordValidation.isValid) {
      this.error = passwordValidation.message;
      return;
    }

    // Verificar que no sea igual a la contraseña actual
    if (this.currentPassword === this.newPassword) {
      this.error = 'La nueva contraseña debe ser diferente a la actual.';
      return;
    }

    this.loading = true;

    // DTO para usuarios logueados - CON current_password obligatorio
    const changeData = {
      current_password: this.currentPassword,
      new_password: this.newPassword,
      confirm_password: this.confirmPassword,
    };

    // Llamada al endpoint para usuarios logueados
    this.authService.changePasswordDirect(changeData).subscribe({
      next: (response) => {
        this.loading = false;

        if (response.success) {
          this.successMessage =
            response.message || 'Contraseña actualizada correctamente.';
          this.message = this.successMessage;

          this.passwordChanged.emit(true);
          this.clearForm();

          setTimeout(() => {
            this.closeModal();
          }, 2000);
        } else {
          this.handleChangeError(response);
        }
      },
      error: (err) => {
        console.error('Error en cambio de contraseña:', err);
        this.loading = false;
        this.handleChangeError(err.error || err);
      },
    });
  }

  // Manejar errores específicos basados en tu backend
  handleChangeError(errorResponse: any) {
    // Contraseña actual incorrecta
    if (
      errorResponse.wrong_current ||
      (errorResponse.error &&
        errorResponse.error.includes('contraseña actual')) ||
      (errorResponse.detail && errorResponse.detail.includes('incorrecta'))
    ) {
      this.wrongCurrentPassword = true;
      this.currentPasswordError = 'La contraseña actual es incorrecta.';
      this.error = 'Contraseña actual incorrecta.';
    }
    // Contraseña reutilizada
    else if (
      errorResponse.password_reused ||
      (errorResponse.error &&
        errorResponse.error.includes('utilizado anteriormente')) ||
      (errorResponse.detail &&
        errorResponse.detail.includes('utilizado anteriormente'))
    ) {
      this.passwordReused = true;
      this.error =
        'No puedes usar una contraseña que ya hayas utilizado anteriormente.';
    }
    // Contraseñas no coinciden
    else if (
      errorResponse.passwords_mismatch ||
      (errorResponse.error && errorResponse.error.includes('no coinciden')) ||
      (errorResponse.detail && errorResponse.detail.includes('no coinciden'))
    ) {
      this.passwordsMismatch = true;
      this.error = 'Las contraseñas no coinciden.';
    }
    // Errores generales
    else if (errorResponse.detail) {
      this.error = errorResponse.detail;
    } else if (errorResponse.error) {
      this.error = errorResponse.error;
    } else {
      this.error = 'Error al cambiar la contraseña. Inténtalo nuevamente.';
    }
  }

  clearForm() {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.currentPasswordError = '';
    this.passwordReused = false;
    this.validatingPassword = false;
    this.wrongCurrentPassword = false;
    this.passwordsMismatch = false;
  }

  // Validaciones de contraseña según tu backend
  validatePassword(password: string): PasswordValidationResult {
    return validatePassword(password);
  }

  isPasswordValid(): boolean {
    return validatePassword(this.newPassword).isValid;
  }

  doPasswordsMatch(): boolean {
    return doPasswordsMatch(this.newPassword, this.confirmPassword);
  }

  getPasswordRequirements() {
    return getPasswordRequirements(this.newPassword, this.passwordReused);
  }

  isFormValid(): boolean {
    return (
      this.currentPassword.trim() !== '' &&
      this.isPasswordValid() &&
      this.doPasswordsMatch() &&
      !this.passwordReused &&
      !this.validatingPassword &&
      this.currentPassword !== this.newPassword
    );
  }

  // Métodos públicos para uso externo
  public open() {
    this.openModal();
  }

  public close() {
    this.closeModal();
  }
}
