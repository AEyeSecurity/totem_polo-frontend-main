import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth-pending',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-layout auth-pending">
      <div class="card auth-card">
        <div class="auth-icon">
          <span class="material-symbols-outlined info">person_add</span>
        </div>

        <h2>Cuenta No Registrada</h2>
        <p>Necesitas que te creen una cuenta para acceder al sistema.</p>

        <div class="alert alert--warning">
          <strong>Tu email no está registrado:</strong> {{ userEmail }}
        </div>

        <div class="suggestions">
          <h4>¿Qué podés hacer?</h4>
          <ul>
            <li>Contactar al administrador del Polo 52</li>
            <li>Enviar un correo a <strong>admin&#64;polo52.com</strong></li>
            <li>Esperar la confirmación de creación de tu cuenta</li>
          </ul>
        </div>

        <button class="btn primary" (click)="contactAdmin()">
          <span class="material-symbols-outlined">send</span>
          Enviar Email al Admin
        </button>

        <button class="btn ghost" (click)="goToLogin()">
          <span class="material-symbols-outlined">arrow_back</span>
          Volver al Login
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

      .admin-layout.auth-pending {
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

      /* Card igual a auth-error */
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

      /* Icono */
      .auth-icon {
        margin-bottom: 0.5rem;
      }
      .auth-icon .material-symbols-outlined {
        font-variation-settings: 'FILL' 1, 'wght' 600;
        font-size: 40px;
        color: #4f46e5;
      }

      /* Títulos y textos */
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

      /* Alert aviso email */
      .alert {
        margin-bottom: 0.9rem;
        padding: 0.6rem 0.9rem;
        border-radius: 8px;
        font-weight: 500;
        text-align: left;
        font-size: 0.85rem;
      }
      .alert--warning {
        background: #fff6ed;
        color: #7c4a03;
        border: 1px solid #fcd9a3;
      }

      /* Sugerencias */
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

      /* Botones */
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
      .btn .material-symbols-outlined {
        font-size: 18px;
        line-height: 1;
      }

      .btn.primary {
        background: #a20000;
        color: #fff;
        margin-top: 0.5rem;
      }
      .btn.primary:hover {
        background: #870000;
      }

      .btn.ghost {
        background: #f3f6fb;
        color: #1a284b;
        border: 1px solid #e6e9f3;
        margin-top: 0.5rem;
      }
      .btn.ghost:hover {
        background: #e9ecf7;
      }

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
export class AuthPendingComponent implements OnInit {
  userName = '';
  userEmail = '';

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.userName = params['name'] || 'Usuario';
      this.userEmail = params['email'] || '';
    });
  }

  contactAdmin(): void {
    const subject = encodeURIComponent(
      'Solicitud de creación de cuenta - Polo 52'
    );
    const body = encodeURIComponent(
      `Hola,\n\nSoy ${this.userName} (${this.userEmail}) y necesito que creen mi cuenta en el sistema del Parque Industrial Polo 52.\n\nGracias,\n${this.userName}`
    );
    window.location.href = `mailto:admin@polo52.com?subject=${subject}&body=${body}`;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
