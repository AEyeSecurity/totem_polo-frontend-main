import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpErrorResponse,
} from '@angular/common/http';
import { AuthenticationService } from './auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private auth = inject(AuthenticationService);


  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Endpoints públicos (no deben llevar Authorization)
    const PUBLIC_ENDPOINTS = [
      '/forgot-password', // POST (enviar email)
      '/password-reset/verify-token', // POST/GET (verificar token)
      '/forgot-password/confirm', // POST (confirmar con token del mail)
    ];

    const isPublic = PUBLIC_ENDPOINTS.some((p) => req.url.includes(p));
    const token = this.auth.getToken();
    const isNgrokRequest = req.url.includes('.ngrok-free.dev');

    let nextReq = req;

    if (isNgrokRequest) {
      nextReq = nextReq.clone({
        setHeaders: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
    }

    if (!isPublic && token) {
      const clone = nextReq.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      // 401 con nuestro token = la sesión ya no vale (firma inválida, usuario
      // borrado, SECRET_KEY cambiada): se cierra la sesión y se va al login,
      // en vez de dejar la pantalla vacía con errores. /login y /logout se
      // excluyen: ahí el 401 lo maneja quien hizo el pedido.
      const handlesOwn401 = /\/(login|logout)$/.test(req.url);
      return next.handle(clone).pipe(
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401 && !handlesOwn401) {
            this.auth.logoutLocal();
          }
          return throwError(() => err);
        })
      );
    }

    // Requests públicas o sin token → pasan sin Authorization
    return next.handle(nextReq);
  }
}
