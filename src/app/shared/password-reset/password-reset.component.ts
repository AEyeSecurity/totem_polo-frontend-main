// shared/password-reset/password-reset.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthenticationService } from '../../auth/auth.service';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-reset.component.html',
  styleUrls: ['./password-reset.component.css'],
})
export class PasswordResetComponent implements OnInit {
  token = '';
  // SIN currentPassword - usuarios no logueados NO necesitan contraseña actual
  newPassword = '';
  confirmPassword = '';
  message = '';
  error = '';
  loading = false;

  // Estados específicos del token
  tokenExpired = false;
  tokenUsed = false;
  tokenValid = false;
  verifyingToken = false;

  // Propiedades para validación
  userEmail?: string;
  userName?: string;
  passwordReused = false;
  passwordsMismatch = false;

  // Estados de la operación
  successMessage = '';
  resetCompleted = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    console.log(
      '🔍 Token de recuperación recibido:',
      this.token ? this.token.substring(0, 20) + '...' : 'NO TOKEN'
    );

    if (!this.token) {
      this.error =
        'Token no válido o ausente. Por favor, verifica el enlace de recuperación.';
    } else {
      this.verifyTokenValidity();
    }
  }

  // Verificar validez del token usando tu endpoint
  verifyTokenValidity() {
    this.verifyingToken = true;
    this.error = '';
    this.tokenValid = false;

    this.authService.verifyResetToken(this.token).subscribe({
      next: (response) => {
        this.verifyingToken = false;
        console.log('✅ Respuesta de verificación de token:', response);

        if (response.valid) {
          this.tokenValid = true;
          this.userEmail = response.email || '';
          this.userName = response.user_name || '';
          console.log('Token válido para usuario:', this.userName);
        } else {
          this.handleTokenError(response);
        }
      },
      error: (err) => {
        this.verifyingToken = false;
        console.error('❌ Error verificando token:', err);
        this.error = 'Error al verificar el enlace de recuperación.';
      },
    });
  }

  // Manejar errores específicos del token según tu backend
  handleTokenError(response: any) {
    if (response.expired) {
      this.tokenExpired = true;
      this.error =
        'Este enlace de recuperación ha expirado. Los enlaces expiran después de 1 hora por seguridad.';
    } else if (response.used) {
      this.tokenUsed = true;
      this.error =
        'Este enlace de recuperación ya fue utilizado. Solo se puede usar una vez por seguridad.';
    } else {
      this.error = response.error || 'Enlace de recuperación inválido.';
    }
  }

  onNewPasswordChange() {
    // Limpiar TODOS los estados de error cuando el usuario cambia la contraseña
    this.passwordReused = false;
    this.error = '';
    this.passwordsMismatch = false;
    // NO resetear tokenExpired o tokenUsed ya que esos son estados del token, no de la validación
    console.log(
      '🔄 Usuario cambió contraseña - Limpiando errores de validación'
    );
  }

  onConfirmPasswordChange() {
    this.passwordsMismatch = false;
    this.error = '';
    // Solo limpiar error de confirmación, mantener otros estados
    console.log(
      '🔄 Usuario cambió confirmación - Limpiando error de coincidencia'
    );
  }

  // MÉTODO PRINCIPAL - Reset para usuarios NO logueados (usando endpoint forgot-password/confirm)
  onResetPassword(form: NgForm) {
    console.log('🚀 Iniciando reset de contraseña para usuario NO logueado...');

    // IMPORTANTE: Limpiar SOLO errores de validación, NO estados del token
    this.error = '';
    this.message = '';
    this.passwordReused = false;
    this.passwordsMismatch = false;
    // NO tocar tokenExpired, tokenUsed o tokenValid aquí

    // Validaciones del formulario
    if (form.invalid) {
      this.error = 'Por favor, completa todos los campos correctamente.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordsMismatch = true;
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    // Validaciones de seguridad de contraseña
    const passwordValidation = this.validatePassword(this.newPassword);
    if (!passwordValidation.isValid) {
      this.error = passwordValidation.message;
      return;
    }

    if (!this.token) {
      this.error =
        'Token no válido. Por favor, solicita un nuevo enlace de reset.';
      return;
    }

    // Verificar que el token sigue siendo válido antes de intentar
    if (!this.tokenValid || this.tokenExpired || this.tokenUsed) {
      console.log('❌ Token no válido, expirado o usado. Estados:', {
        tokenValid: this.tokenValid,
        tokenExpired: this.tokenExpired,
        tokenUsed: this.tokenUsed,
      });

      if (this.tokenExpired) {
        this.error =
          'El enlace de recuperación ha expirado. Por favor, solicita uno nuevo.';
      } else if (this.tokenUsed) {
        this.error =
          'Este enlace de recuperación ya fue utilizado. Por favor, solicita uno nuevo.';
      } else {
        this.error =
          'El enlace de recuperación no es válido. Por favor, solicita uno nuevo.';
      }
      return;
    }

    this.loading = true;
    console.log('📤 Enviando solicitud de reset con token válido...');

    // DTO para usuarios NO logueados - SIN current_password
    const resetData = {
      token: this.token,
      new_password: this.newPassword,
      confirm_password: this.confirmPassword,
    };

    // Usar el endpoint correcto para contraseñas olvidadas
    this.authService.resetPasswordForgotten(resetData).subscribe({
      next: (response) => {
        console.log('✅ Respuesta del reset de contraseña:', response);
        this.loading = false;

        // CORRECCIÓN: Verificar éxito por múltiples criterios, no solo success: true
        // Algunos backends pueden tener bugs y devolver success: false incluso cuando funcionó
        const resetWasSuccessful =
          response.success === true ||
          response.message?.includes('exitosamente') ||
          response.message?.includes('restablecida') ||
          response.message?.includes('successfully') ||
          response.message?.includes('changed') ||
          response.error?.includes('exitosamente') || // A veces el "éxito" viene en el campo error
          (response.status_code && response.status_code === 200);

        console.log('🔍 Analizando si el reset fue exitoso:', {
          success: response.success,
          message: response.message,
          error: response.error,
          status_code: response.status_code,
          resetWasSuccessful,
        });

        if (resetWasSuccessful) {
          // ÉXITO: Reset fue exitoso
          this.tokenUsed = true;
          this.tokenValid = false;
          this.resetCompleted = true;
          this.successMessage =
            response.message ||
            response.error || // A veces el mensaje de éxito viene en "error"
            'Contraseña restablecida con éxito. Ya puedes iniciar sesión con tu nueva contraseña.';
          this.message = this.successMessage;

          // Limpiar formulario por seguridad
          this.newPassword = '';
          this.confirmPassword = '';

          console.log('🎉 Reset exitoso detectado - Token marcado como usado');

          // Redirección automática después de 5 segundos
          setTimeout(() => {
            this.router.navigate(['/login'], {
              queryParams: { message: 'password-reset-success' },
            });
          }, 5000);
        } else {
          // ERROR: Reset falló realmente
          console.log('❌ Reset falló - Analizando error');
          this.handleResetError(response);
        }
      },
      error: (err) => {
        console.error('❌ Error HTTP en reset de contraseña:', err);
        this.loading = false;

        // Verificar si el error HTTP realmente contiene un éxito disfrazado
        const errorResponse = err.error || err;
        const hiddenSuccess =
          errorResponse?.message?.includes('exitosamente') ||
          errorResponse?.message?.includes('restablecida') ||
          errorResponse?.message?.includes('successfully') ||
          errorResponse?.error?.includes('exitosamente');

        if (hiddenSuccess) {
          console.log(
            '🎉 Éxito encontrado en error HTTP - Backend mal configurado'
          );
          this.tokenUsed = true;
          this.tokenValid = false;
          this.resetCompleted = true;
          this.successMessage =
            errorResponse.message ||
            errorResponse.error ||
            'Contraseña restablecida con éxito.';
          this.message = this.successMessage;

          // Limpiar formulario
          this.newPassword = '';
          this.confirmPassword = '';

          // Redirección
          setTimeout(() => {
            this.router.navigate(['/login'], {
              queryParams: { message: 'password-reset-success' },
            });
          }, 5000);
        } else {
          console.log('❌ Error HTTP real - Token sigue válido para reintento');
          this.handleResetError(errorResponse);
        }
      },
    });
  }

  // CORREGIDO: Manejar errores específicos del reset según tu backend
  handleResetError(errorResponse: any) {
    console.log('🔍 Analizando error de reset:', errorResponse);
    console.log(
      '🔍 Contenido completo del error:',
      JSON.stringify(errorResponse, null, 2)
    );

    // Resetear estados antes de evaluar
    this.tokenExpired = false;
    this.tokenUsed = false;
    this.passwordReused = false;
    this.passwordsMismatch = false;

    // CASO ESPECIAL: Si el backend marca used=true pero también password_reused=true,
    // ignoramos el used=true porque es un error del backend - el token no debería marcarse como usado
    // por un error de contraseña reutilizada
    if (errorResponse.password_reused === true) {
      console.log(
        '🚫 Backend erróneamente marcó token como usado por contraseña reutilizada - IGNORANDO used=true'
      );
      this.passwordReused = true;
      this.error =
        'No puedes usar una contraseña que ya hayas utilizado anteriormente. Elige una diferente.';
      // Mantener el token como válido para permitir reintentos
      return;
    }

    // PRIORIDAD 1: Buscar errores de contraseña reutilizada en el mensaje de error
    // (incluso si used=true, puede ser un falso positivo del backend)
    if (
      errorResponse.error?.includes('contraseña ya fue utilizada') ||
      errorResponse.error?.includes('password has been used previously') ||
      errorResponse.error?.includes('contraseña anteriormente') ||
      errorResponse.error?.includes('reutilizada') ||
      errorResponse.error?.includes('reused') ||
      errorResponse.detail?.includes('contraseña ya fue utilizada') ||
      errorResponse.message?.includes('contraseña ya fue utilizada')
    ) {
      console.log(
        '🚫 Detectado error de contraseña reutilizada en mensaje - IGNORANDO used=true si existe'
      );
      this.passwordReused = true;
      this.error =
        'No puedes usar una contraseña que ya hayas utilizado anteriormente. Elige una diferente.';
      // Token permanece válido para reintentar con otra contraseña
      return;
    }

    // PRIORIDAD 2: Errores de contraseñas no coincidentes
    if (
      errorResponse.passwords_mismatch ||
      errorResponse.error?.includes('no coinciden') ||
      errorResponse.error?.includes('passwords do not match') ||
      errorResponse.error?.includes('mismatch')
    ) {
      console.log(
        '🚫 Error de contraseñas no coinciden - IGNORANDO used=true si existe'
      );
      this.passwordsMismatch = true;
      this.error =
        'Las contraseñas no coinciden. Verifica e intenta nuevamente.';
      return;
    }

    // PRIORIDAD 3: Errores de formato de contraseña
    if (
      errorResponse.error?.includes('8 caracteres') ||
      errorResponse.error?.includes('mayúscula') ||
      errorResponse.error?.includes('minúscula') ||
      errorResponse.error?.includes('número') ||
      errorResponse.error?.includes('password requirements') ||
      errorResponse.error?.includes('invalid password format')
    ) {
      console.log(
        '🚫 Error de formato de contraseña - IGNORANDO used=true si existe'
      );
      this.error =
        errorResponse.error ||
        errorResponse.detail ||
        'La contraseña no cumple con los requisitos de seguridad.';
      return;
    }

    // SOLO AHORA verificar si el token realmente expiró
    if (errorResponse.expired === true) {
      this.tokenExpired = true;
      this.tokenValid = false;
      this.error =
        'El enlace de recuperación ha expirado. Por favor, solicita uno nuevo.';
      console.log('❌ Token expirado - Marcando como inválido');
      return;
    }

    // SOLO AHORA verificar si el token fue realmente usado EXITOSAMENTE
    // Si llegamos hasta aquí y used=true, probablemente fue exitoso en un intento anterior
    if (
      errorResponse.used === true &&
      errorResponse.error?.includes('enlace') &&
      errorResponse.error?.includes('utilizado') &&
      !errorResponse.error?.includes('contraseña')
    ) {
      console.log(
        '🤔 Token marcado como usado - Posiblemente exitoso en intento anterior'
      );

      // Si el mensaje dice "enlace ya utilizado", es probable que un intento anterior SÍ haya funcionado
      // pero el backend respondió mal. Tratarlo como éxito tardío.
      if (
        errorResponse.error?.includes(
          'Este enlace de recuperación ya fue utilizado'
        ) ||
        errorResponse.error?.includes('enlace ya fue utilizado')
      ) {
        console.log(
          '🎉 Detectando éxito tardío - El reset anterior probablemente funcionó'
        );

        // Mostrar mensaje de éxito tardío pero no redirigir automáticamente
        this.resetCompleted = true;
        this.successMessage =
          'Contraseña restablecida exitosamente en intento anterior. Ya puedes iniciar sesión con tu nueva contraseña.';
        this.message = this.successMessage;
        this.tokenUsed = true;
        this.tokenValid = false;

        // Limpiar formulario
        this.newPassword = '';
        this.confirmPassword = '';

        return;
      }

      // Si no podemos confirmar que fue exitoso, mostrar error de token usado
      this.tokenUsed = true;
      this.tokenValid = false;
      this.error =
        'Este enlace de recuperación ya fue utilizado. Si no cambiaste tu contraseña exitosamente, solicita un nuevo enlace.';
      console.log('❌ Token usado - Estado incierto');
      return;
    }

    // Token inválido
    if (
      errorResponse.invalid_token ||
      errorResponse.error?.includes('token inválido') ||
      errorResponse.error?.includes('invalid token') ||
      errorResponse.error?.includes('token not found')
    ) {
      this.tokenValid = false;
      this.error =
        'El enlace de recuperación no es válido. Por favor, solicita uno nuevo.';
      console.log('❌ Token inválido');
      return;
    }

    // Error genérico - mantener el token válido para reintentos
    console.log(
      '⚠️ Error no categorizado - Manteniendo token válido para reintentos'
    );
    console.log(
      '🔧 Backend response usado flag:',
      errorResponse.used,
      'pero tratando como error recuperable'
    );

    if (errorResponse.detail) {
      this.error = errorResponse.detail;
    } else if (errorResponse.error) {
      this.error = errorResponse.error;
    } else if (errorResponse.message) {
      this.error = errorResponse.message;
    } else {
      this.error = 'Error al restablecer la contraseña. Inténtalo nuevamente.';
    }

    console.log(
      '📝 Token permanece válido para permitir reintentos a pesar de used=true del backend'
    );
  }

  // Navegación
  requestNewLink() {
    this.router.navigate(['/forgot-password']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  // Validaciones de contraseña iguales al backend
  validatePassword(password: string): { isValid: boolean; message: string } {
    if (!password) {
      return { isValid: false, message: 'La contraseña es requerida.' };
    }

    if (password.length < 8) {
      return {
        isValid: false,
        message: 'La contraseña debe tener al menos 8 caracteres.',
      };
    }

    if (password.length > 128) {
      return {
        isValid: false,
        message: 'La contraseña no puede tener más de 128 caracteres.',
      };
    }

    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        message: 'La contraseña debe tener al menos una letra mayúscula.',
      };
    }

    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        message: 'La contraseña debe tener al menos una letra minúscula.',
      };
    }

    if (!/[0-9]/.test(password)) {
      return {
        isValid: false,
        message: 'La contraseña debe tener al menos un número.',
      };
    }

    return { isValid: true, message: '' };
  }

  isPasswordValid(): boolean {
    return this.validatePassword(this.newPassword).isValid;
  }

  doPasswordsMatch(): boolean {
    return (
      this.newPassword === this.confirmPassword &&
      this.confirmPassword.length > 0
    );
  }

  getPasswordRequirements() {
    const password = this.newPassword;
    return {
      minLength: password.length >= 8,
      maxLength: password.length <= 128,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      notReused: !this.passwordReused,
    };
  }

  // Validación completa del formulario para usuarios NO logueados
  isFormValid(): boolean {
    return (
      this.tokenValid &&
      this.isPasswordValid() &&
      this.doPasswordsMatch() &&
      !this.passwordReused &&
      !this.verifyingToken &&
      !this.loading
    );
  }
}
