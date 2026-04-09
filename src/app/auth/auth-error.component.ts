// app/auth/auth-error.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth-error',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-layout auth-error" [class.dark-mode]="isDarkMode">
      <div class="card auth-card">
        <div class="auth-icon">
          <span class="material-symbols-outlined danger">error</span>
        </div>
        <h2>Error de Autenticación</h2>
        <p>Hubo un problema al autenticarte con Google.</p>

        <div class="alert alert--error" *ngIf="errorMessage">
          <strong>Detalle:</strong> {{ errorMessage }}
        </div>

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
  styles: [
    `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');

      :host,
      .admin-layout,
      .auth-card,
      .alert,
      .btn {
        font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto,
          sans-serif;
      }

      .admin-layout.auth-error {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: radial-gradient(
            1000px 500px at 10% 5%,
            #eef2ff 0%,
            transparent 60%
          ),
          radial-gradient(1000px 500px at 90% 95%, #eef2ff 0%, transparent 60%),
          #f7f9ff;
      }

      /* Card más compacta */
      .card.auth-card {
        width: min(420px, 92vw);
        background: #fff;
        border-radius: 12px;
        padding: 1.75rem;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        text-align: center;
        transition: box-shadow 0.2s ease;
      }
      .card.auth-card:hover {
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      }

      /* Icono visible y centrado */
      .auth-icon {
        margin-bottom: 0.5rem;
      }
      .auth-icon .material-symbols-outlined {
        font-variation-settings: 'FILL' 1, 'wght' 600;
        font-size: 40px;
        color: #a20000;
      }

      /* Títulos y textos más chicos */
      .auth-card h2 {
        font-size: 1rem;
        font-weight: 600;
        color: #1a284b;
        margin: 0 0 0.35rem 0;
      }
      .auth-card p {
        margin: 0 0 1rem 0;
        font-size: 0.88rem;
        color: #53618d;
        line-height: 1.35;
      }

      /* Detalle */
      .alert {
        margin-bottom: 0.9rem;
        padding: 0.6rem 0.9rem;
        border-radius: 8px;
        font-weight: 500;
        text-align: left;
        font-size: 0.85rem;
      }
      .alert--error {
        background: #fdecea;
        color: #b71c1c;
        border: 1px solid #f5c6cb;
      }

      /* Sugerencias más chicas */
      .suggestions {
        text-align: left;
        background: #f3f5fb;
        border: 1px solid rgba(83, 97, 141, 0.12);
        border-radius: 10px;
        padding: 0.8rem 0.9rem;
        margin: 0 auto 1.1rem auto;
        font-size: 0.85rem;
      }
      .suggestions h4 {
        margin: 0 0 0.4rem 0;
        font-size: 0.9rem;
        font-weight: 600;
        color: #1a284b;
      }
      .suggestions ul {
        margin: 0;
        padding-left: 1rem;
        color: #53618d;
      }
      .suggestions li {
        margin: 0.2rem 0;
      }

      /* Botón primario igual que el login */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        font-size: 0.85rem;
        transition: 0.2s ease;
      }
      .btn.primary {
        background: #a20000;
        color: #fff;
      }
      .btn.primary:hover {
        background: #870000;
      }

      .btn .material-symbols-outlined {
        font-size: 18px;
        line-height: 1;
      }

      /* Responsive */
      @media (max-width: 480px) {
        .card.auth-card {
          padding: 1.25rem;
        }
        .btn {
          width: 100%;
        }
      }
    `,
  ],
})
export class AuthErrorComponent implements OnInit {
  errorMessage = '';
  isDarkMode = false;

  constructor(private route: ActivatedRoute, private router: Router) {}

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
