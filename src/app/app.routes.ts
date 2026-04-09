import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { ChatbotComponent } from './chat/chat.component';
import { LoginComponent } from './auth/login/login.component';
import { PasswordResetComponent } from './shared/password-reset/password-reset.component';
import { AuthSuccessComponent } from './auth/auth-success.component';
import { AuthPendingComponent } from './auth/auth-pending.component';
import { AuthErrorComponent } from './auth/auth-error.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'auth/success',
    loadComponent: () =>
      import('./auth/auth-success.component').then(
        (m) => m.AuthSuccessComponent
      ),
  },
  { path: 'auth/pending', component: AuthPendingComponent },
  { path: 'auth/error', component: AuthErrorComponent },

  {
    path: 'reset-password',
    component: PasswordResetComponent,
  },
  {
    path: 'chat',
    component: ChatbotComponent,
    canActivate: [AuthGuard],
    data: { role: 'publico' },
  },
  {
    path: 'empresas',
    loadComponent: () =>
      import('./admin-polo/admin-polo.component').then(
        (m) => m.AdminPoloComponent
      ),
    canActivate: [AuthGuard],
    data: { role: 'admin_polo' },
  },
  {
    path: 'me',
    loadComponent: () =>
      import('./admin-empresa/admin-empresa.component').then(
        (m) => m.EmpresaMeComponent
      ),
    canActivate: [AuthGuard],
    data: { role: 'admin_empresa' },
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
