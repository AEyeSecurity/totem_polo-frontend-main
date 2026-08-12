// src/app/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ==== Tipos de respuesta ====
interface LoginResponse {
  access_token: string;
  token_type: string;
  tipo_rol: string;
}
interface RegisterResponse {
  message: string;
}
interface LogoutResponse {
  message: string;
}
interface PasswordResetResponse {
  message: string;
  success?: boolean;
  error?: string;
  expired?: boolean;
}
interface TokenVerificationResponse {
  valid: boolean;
  message?: string;
  email_hint?: string;
  error?: string;
  expired?: boolean;
  used?: boolean;
  email?: string;
  user_name?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private loginUrl = `${environment.apiUrl}/login`;
  private registerUrl = `${environment.apiUrl}/register`;
  private logoutUrl = `${environment.apiUrl}/logout`;
  private sessionKey = 'sessionToken';

  // -------------------- LOGIN --------------------
  login(username: string, password: string): Observable<boolean> {
    const body = new HttpParams()
      .set('grant_type', 'password')
      .set('username', username)
      .set('password', password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http
      .post<LoginResponse>(this.loginUrl, body.toString(), { headers })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.sessionKey, res.access_token);
          localStorage.setItem('rol', res.tipo_rol);
        }),
        map(() => true),
        catchError((err) => {
          console.error('Login fallido', err);
          return of(false);
        })
      );
  }

  // -------------------- LOGOUT --------------------
  logout(): Observable<boolean> {
    const token = this.getToken();

    if (!token) {
      this.clearSession();
      this.router.navigate(['/login']);
      return of(true);
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http
      .post<LogoutResponse>(this.logoutUrl, {}, { headers })
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        }),
        map(() => true),
        catchError((err) => {
          console.error('Error en logout:', err);
          this.clearSession();
          this.router.navigate(['/login']);
          return of(false);
        })
      );
  }

  logoutLocal(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private clearSession(): void {
    // Tradicional
    localStorage.removeItem(this.sessionKey);
    localStorage.removeItem('rol');

    // Google OAuth (si lo usaste)
    localStorage.removeItem('access_token');
    localStorage.removeItem('tipo_rol');
  }

  // -------------------- LECTURAS --------------------
  getToken(): string | null {
    // 1) Token tradicional (prioridad)
    const localToken = localStorage.getItem(this.sessionKey);
    if (localToken) {
      return localToken;
    }
    // 2) Google OAuth (si aplica)
    const googleToken = localStorage.getItem('access_token');
    if (googleToken) {
      return googleToken;
    }
    return null;
  }

  getUserRole(): string | null {
    // 1) Rol tradicional (prioridad)
    const localRole = localStorage.getItem('rol');
    if (localRole) {
      return localRole;
    }
    // 2) Rol Google OAuth
    const googleRole = localStorage.getItem('tipo_rol');
    if (googleRole) {
      return googleRole;
    }
    return null;
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = Date.now() >= payload.exp * 1000;
      if (isExpired) {
        // Limpiamos solo el token tradicional, sin tocar Google ni navegar
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem('rol');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error al verificar el token:', error);
      // Limpieza mínima sin navegar
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem('rol');
      return false;
    }
  }

  passwordResetRequest(email: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/forgot-password`, {
      email,
    });
  }

  // Cambiar contraseña del usuario logueado (envía email)
  changePasswordRequest(): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/password-reset/request-logged-user`,
      {}
    );
  }

  // 🆕 NUEVO MÉTODO - Verificar token de reset sin hacer cambios
  // 2. Corregir el método verifyResetToken para usar el cuerpo en lugar de params
  verifyResetToken(token: string): Observable<TokenVerificationResponse> {
    return this.http
      .post<TokenVerificationResponse>(
        `${
          environment.apiUrl
        }/password-reset/verify-token?token=${encodeURIComponent(token)}`,
        {} // 👈 body vacío porque el back no lo espera en JSON
      )
      .pipe(
        catchError((err) => {
          console.error('Error verificando token de reset:', err);

          const errorResponse: TokenVerificationResponse = {
            valid: false,
            error: err.error?.detail || err.message || 'Token inválido',
            expired:
              err.status === 400 ||
              (err.error?.detail && err.error.detail.includes('expirado')),
            used:
              err.status === 400 ||
              (err.error?.detail && err.error.detail.includes('utilizado')),
          };

          return of(errorResponse);
        })
      );
  }

  requestPasswordReset(email: string): Observable<any> {
    // ✅ Tu método forgotPassword ya hace esto, pero agregamos alias para los componentes
    return this.forgotPassword(email);
  }
  cleanupResetTokensCache(): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http
      .post(
        `${environment.apiUrl}/password-reset/cleanup-cache`,
        {},
        { headers }
      )
      .pipe(
        catchError((err) => {
          console.error('Error limpiando cache de tokens:', err);
          return throwError(() => err);
        })
      );
  }

  // 5. Método para obtener estado del cache (para admin - opcional)
  getCacheStatus(): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http
      .get(`${environment.apiUrl}/password-reset/cache-status`, { headers })
      .pipe(
        catchError((err) => {
          console.error('Error obteniendo estado del cache:', err);
          return throwError(() => err);
        })
      );
  }

  // - Ahora retorna el response completo para manejar errores
  resetPassword(
    token: string,
    newPassword: string
  ): Observable<PasswordResetResponse> {
    const body = { token, new_password: newPassword };

    return this.http
      .post<PasswordResetResponse>(
        `${environment.apiUrl}/password-reset/confirm`,
        body
      )
      .pipe(
        catchError((err) => {
          console.error('Error en reset password:', err);
          // Re-lanzar el error para que el componente pueda manejarlo
          return throwError(() => err);
        })
      );
  }

  register(
    username: string,
    email: string,
    password: string,
    cuil: string
  ): Observable<boolean> {
    return this.http
      .post<RegisterResponse>(this.registerUrl, {
        nombre: username,
        email,
        password,
        cuil,
      })
      .pipe(
        map(() => true),
        catchError((err) => {
          console.error('Registro fallido', err);
          return of(false);
        })
      );
  }

  setToken(token: string): void {
    localStorage.setItem('access_token', token);
  }

  // Guardar rol para Google OAuth
  setUserRole(role: string): void {
    localStorage.setItem('tipo_rol', role);
  }

  /**
   * Validar si una contraseña fue utilizada anteriormente (validación en tiempo real)
   */
  validatePasswordReset(data: {
    token: string;
    current_password: string;
    new_password: string;
    confirm_password: string;
    validate_only?: boolean;
  }): Observable<any> {
    return this.http
      .post(`${environment.apiUrl}/password-reset/validate`, data)
      .pipe(
        catchError((err) => {
          console.error('Error validando contraseña:', err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Reset de contraseña con validación completa (método seguro)
   */
  /**
   * Cambio directo de contraseña para usuarios YA logueados
   * Requiere contraseña actual para validación
   */
  changePasswordDirect(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http
      .post(`${environment.apiUrl}/change-password-direct`, data, { headers })
      .pipe(
        catchError((err) => {
          console.error('Error en cambio de contraseña directo:', err);
          return throwError(() => err);
        })
      );
  }

  /**
   * ACTUALIZAR TU MÉTODO EXISTENTE resetPasswordSecure para que sea flexible:
   * - Con current_password: Para usuarios logueados
   * - Sin current_password: Para usuarios NO logueados (via email token)
   */
  // Reemplazar tu resetPasswordSecure existente con esta versión mejorada:
  resetPasswordSecure(data: {
    token: string;
    current_password?: string; // <- Opcional para usuarios NO logueados
    new_password: string;
    confirm_password: string;
  }): Observable<any> {
    const isLoggedUser = !!data.current_password;

    return this.http
      .post(`${environment.apiUrl}/password-reset/confirm-secure`, data)
      .pipe(
        catchError((err) => {
          console.error(
            `Error en reset password ${
              isLoggedUser ? 'logueado' : 'público'
            }:`,
            err
          );
          return throwError(() => err);
        })
      );
  }

  /**
   * Solicitar reset de contraseña via email (usuarios NO logueados)
   */
  forgotPassword(email: string): Observable<any> {
    return this.http
      .post(`${environment.apiUrl}/forgot-password`, { email })
      .pipe(
        catchError((err) => {
          console.error('Error enviando solicitud de reset:', err);
          return throwError(() => err);
        })
      );
  }

  // Add/Update this method in your AuthenticationService

  /**
   * Reset de contraseña para usuarios NO logueados (solo con token de email)
   * Usa el endpoint /forgot-password/confirm (sin current_password)
   */
  resetPasswordForgotten(data: {
    token: string;
    new_password: string;
    confirm_password: string;
  }): Observable<any> {
    return this.http
      .post(`${environment.apiUrl}/forgot-password/confirm`, data)
      .pipe(
        catchError((err) => {
          console.error('Error en reset password (usuario no logueado):', err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Método actualizado para reset seguro (CON current_password - usuarios logueados)
   * Usa el endpoint /password-reset/confirm-secure
   */
  resetPasswordSecureLoggedUser(data: {
    token: string;
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json',
    });

    return this.http
      .post(`${environment.apiUrl}/password-reset/confirm-secure`, data, {
        headers,
      })
      .pipe(
        catchError((err) => {
          console.error('Error en reset password (logueado con token):', err);
          return throwError(() => err);
        })
      );
  }
}
