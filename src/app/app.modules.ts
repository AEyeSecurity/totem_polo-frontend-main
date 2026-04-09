import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AuthInterceptor } from './auth/auth.interceptor';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot([
      {
        path: 'login',
        loadComponent: () =>
          import('./auth/login/login.component').then((m) => m.LoginComponent),
      },

      // ✅ AGREGAR ESTAS RUTAS PARA GOOGLE AUTH
      {
        path: 'auth/success',
        loadComponent: () =>
          import('../app/auth/auth-success.component').then(
            (m) => m.AuthSuccessComponent
          ),
      },
      {
        path: 'auth/pending',
        loadComponent: () =>
          import('../app/auth/auth-pending.component').then(
            (m) => m.AuthPendingComponent
          ),
      },
      {
        path: 'auth/error',
        loadComponent: () =>
          import('../app/auth/auth-error.component').then(
            (m) => m.AuthErrorComponent
          ),
      },

      {
        path: 'reset-password',
        loadComponent: () =>
          import('./shared/password-reset/password-reset.component').then(
            (m) => m.ResetPasswordComponent
          ),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: '**', redirectTo: 'login' },
    ]),
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
