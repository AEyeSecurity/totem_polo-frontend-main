import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  selector: 'app-auth-pending',
  standalone: true,
  imports: [],
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
  styleUrl: './auth-pending.component.css',
})
export class AuthPendingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  userName = '';
  userEmail = '';

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
