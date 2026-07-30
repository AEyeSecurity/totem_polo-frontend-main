// app/auth/auth-error.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  selector: 'app-auth-error',
  standalone: true,
  imports: [],
  template: `
    <div class="admin-layout auth-error" [class.dark-mode]="isDarkMode">
      <div class="card auth-card">
        <div class="auth-icon">
          <span class="material-symbols-outlined danger">error</span>
        </div>
        <h2>Error de Autenticación</h2>
        <p>Hubo un problema al autenticarte con Google.</p>
    
        @if (errorMessage) {
          <div class="alert alert--error">
            <strong>Detalle:</strong> {{ errorMessage }}
          </div>
        }
    
        <div class="suggestions">
          <h4>Posibles soluciones:</h4>
          <ul>
            <li>Verifica tu conexión a Internet</li>
            <li>Intenta cerrar y volver a abrir el navegador</li>
            <li>Contacta al administrador si el problema persiste</li>
          </ul>
        </div>
    
        <button class="btn primary" (click)="goToLogin()">
          <span class="material-symbols-outlined">refresh</span>
          Intentar de nuevo
        </button>
      </div>
    </div>
    `,
  styleUrl: './auth-error.component.css',
})
export class AuthErrorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  errorMessage = '';
  isDarkMode = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.errorMessage = params['message'] || 'Error desconocido';
    });

    // Detecta modo oscuro inicial
    this.isDarkMode = document.body.classList.contains('dark-theme');
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-theme', this.isDarkMode);
  }
}
