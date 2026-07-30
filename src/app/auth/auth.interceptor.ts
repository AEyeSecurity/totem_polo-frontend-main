import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
} from '@angular/common/http';
import { AuthenticationService } from './auth.service';
import { Observable } from 'rxjs';

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
      return next.handle(clone);
    }

    // Requests públicas o sin token → pasan sin Authorization
    return next.handle(nextReq);
  }
}
