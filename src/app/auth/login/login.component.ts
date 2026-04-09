// src/app/auth/login.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  keepLoggedIn = false; // <- se pisa en ngOnInit con el flag guardado

  // Validación
  usernameError = false;
  passwordError = false;
  usernameErrorMessage = '';
  passwordErrorMessage = '';

  // UI
  loginMessage = '';
  successMessage = '';
  loading = false;
  showPassword = false;

  // Reset pass
  showResetPassword = false;
  resetEmail = '';
  resetMessage = '';
  resetError = '';
  resetLoading = false;

  // Bloqueo
  loginAttempts = 0;
  maxAttempts = 5;
  isBlocked = false;
  blockTimeRemaining = 0;

  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Restaurar el estado del check
    this.keepLoggedIn = localStorage.getItem('remember') === '1';

    if (this.authService.isLoggedIn()) {
      this.redirectByRole();
    }
    this.checkBlockStatus();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // --- validaciones (igual que tenías) ---
  validateUsername(): void {
    this.usernameError = false;
    this.usernameErrorMessage = '';
    if (!this.username.trim()) {
      this.usernameError = true;
      this.usernameErrorMessage = 'El usuario o email es requerido';
      return;
    }
    if (this.username.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.username)) {
        this.usernameError = true;
        this.usernameErrorMessage = 'Formato de email inválido';
      }
    } else if (this.username.length < 3) {
      this.usernameError = true;
      this.usernameErrorMessage = 'El usuario debe tener al menos 3 caracteres';
    }
  }

  validatePassword(): void {
    this.passwordError = false;
    this.passwordErrorMessage = '';
    if (!this.password) {
      this.passwordError = true;
      this.passwordErrorMessage = 'La contraseña es requerida';
      return;
    }
    if (this.password.length < 6) {
      this.passwordError = true;
      this.passwordErrorMessage =
        'La contraseña debe tener al menos 6 caracteres';
    }
  }

  onLogin(): void {
    if (this.isBlocked) {
      this.loginMessage = `Demasiados intentos fallidos. Intenta en ${this.blockTimeRemaining} segundos.`;
      return;
    }

    this.validateUsername();
    this.validatePassword();
    this.loginMessage = '';
    this.successMessage = '';
    if (this.usernameError || this.passwordError) {
      this.loginMessage = 'Por favor, corrige los errores antes de continuar.';
      return;
    }

    this.loading = true;

    this.authService
      .login(this.username.trim(), this.password, this.keepLoggedIn)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (ok) => {
          if (ok) {
            // ✅ Guardar la preferencia para próximos inicios
            localStorage.setItem('remember', this.keepLoggedIn ? '1' : '0');

            this.successMessage = '¡Inicio de sesión exitoso! Redirigiendo...';
            this.loginAttempts = 0;
            setTimeout(() => this.redirectByRole(), 1200);
          } else {
            this.handleLoginError();
          }
        },
        error: (err) => {
          console.error('Error de login:', err);
          this.handleLoginError();
          if (err.status === 429)
            this.loginMessage = 'Demasiados intentos. Intenta más tarde.';
          else if (err.status === 0)
            this.loginMessage =
              'Error de conexión. Verifica tu conexión a internet.';
        },
      });
  }

  private handleLoginError(): void {
    this.loginAttempts++;
    this.usernameError = true;
    this.passwordError = true;
    const remaining = this.maxAttempts - this.loginAttempts;
    if (remaining <= 0) this.blockUser();
    else
      this.loginMessage = `Usuario o contraseña incorrectos. Te quedan ${remaining} intentos.`;
  }

  private blockUser(): void {
    this.isBlocked = true;
    this.blockTimeRemaining = 300;
    this.loginMessage = `Demasiados intentos fallidos. Intenta en ${this.blockTimeRemaining} segundos.`;
    localStorage.setItem(
      'loginBlock',
      (Date.now() + this.blockTimeRemaining * 1000).toString()
    );
    const timer = setInterval(() => {
      this.blockTimeRemaining--;
      this.loginMessage = `Demasiados intentos fallidos. Intenta en ${this.blockTimeRemaining} segundos.`;
      if (this.blockTimeRemaining <= 0) {
        this.isBlocked = false;
        this.loginAttempts = 0;
        this.loginMessage = '';
        localStorage.removeItem('loginBlock');
        clearInterval(timer);
      }
    }, 1000);
  }

  private checkBlockStatus(): void {
    const blockUntil = localStorage.getItem('loginBlock');
    if (!blockUntil) return;
    const remaining = Math.ceil((parseInt(blockUntil) - Date.now()) / 1000);
    if (remaining > 0) {
      this.isBlocked = true;
      this.blockTimeRemaining = remaining;
      this.blockUser();
    } else localStorage.removeItem('loginBlock');
  }

  private redirectByRole(): void {
    const rol = this.authService.getUserRole();
    switch (rol) {
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
        this.loginMessage = 'Rol no reconocido. Contacta al administrador.';
        this.authService.logoutLocal();
        break;
    }
  }

  // --- resto de métodos (reset password, utilidades) igual que tenías ---
  openResetModal(): void {
    this.showResetPassword = true;
    this.resetEmail = '';
    this.resetMessage = '';
    this.resetError = '';
  }
  closeResetModal(): void {
    this.showResetPassword = false;
    this.resetEmail = '';
    this.resetMessage = '';
    this.resetError = '';
  }
  validateResetEmail(): boolean {
    if (!this.resetEmail.trim()) {
      this.resetError = 'El email es requerido';
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.resetEmail)) {
      this.resetError = 'Formato de email inválido';
      return false;
    }
    this.resetError = '';
    return true;
  }
  requestPasswordReset(): void {
    if (this.resetLoading) return;

    // Validación rápida del email
    if (!this.validateResetEmail()) return;

    this.resetLoading = true;
    this.resetMessage = '';
    this.resetError = '';

    this.authService
      .requestPasswordReset(this.resetEmail.trim())
      .pipe(finalize(() => (this.resetLoading = false)))
      .subscribe({
        next: (res) => {
          // Backend (FastAPI) devuelve message y expires_in_minutes
          this.resetMessage =
            res?.message ||
            'Te enviamos un email con el enlace de recuperación.';
          // Si querés, podés cerrar el modal después de unos segundos
          // setTimeout(() => this.closeResetModal(), 3000);
        },
        error: (err) => {
          console.error('❌ Error forgot-password:', err);
          // Mensajes claros según status
          if (err.status === 404) {
            this.resetError = 'Ese email no está registrado.';
          } else if (err.status === 403) {
            this.resetError =
              'La cuenta está deshabilitada. Contactá al administrador.';
          } else if (err.status === 500) {
            // El back puede devolver "Error enviando email: ..."
            this.resetError = err.error?.detail || 'Error enviando el email.';
          } else {
            this.resetError =
              'No pudimos procesar tu solicitud. Intentá nuevamente.';
          }
        },
      });
  }

  clearErrors(): void {
    this.usernameError = false;
    this.passwordError = false;
    this.usernameErrorMessage = '';
    this.passwordErrorMessage = '';
    this.loginMessage = '';
  }
  onUsernameChange(): void {
    if (this.usernameError) this.validateUsername();
  }
  onPasswordChange(): void {
    if (this.passwordError) this.validatePassword();
  }
  onResetEmailChange(): void {
    if (this.resetError) this.resetError = '';
  }

  loginWithGoogle(): void {
    // Si querés, podés forzar recordar para Google:
    localStorage.setItem('remember', '1');
    const baseApi = environment.apiUrl.replace(/\/$/, '');
    window.location.href = `${baseApi}/auth/google/login`;
  }
}
