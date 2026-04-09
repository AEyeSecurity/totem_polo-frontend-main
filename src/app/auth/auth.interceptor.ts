import { Injectable } from '@angular/core';
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
  constructor(private auth: AuthenticationService) {}

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

    console.log('🌐 INTERCEPTOR - URL:', req.url);
    console.log('🔑 INTERCEPTOR - Token:', token ? 'EXISTS' : 'NOT FOUND');
    console.log('🛡️ INTERCEPTOR - Endpoint público:', isPublic ? 'YES' : 'NO');

    if (!isPublic && token) {
      const clone = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ INTERCEPTOR - Token añadido a la request');
      return next.handle(clone);
    }

    // Requests públicas o sin token → pasan sin Authorization
    if (isPublic)
      console.log('🟢 INTERCEPTOR - Público: no adjunto Authorization');
    else console.log('❌ INTERCEPTOR - No token, request sin autorización');

    return next.handle(req);
  }
}
