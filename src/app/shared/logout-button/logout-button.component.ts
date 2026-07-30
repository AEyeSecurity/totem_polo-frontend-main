import { Component, inject } from '@angular/core';

import { AuthenticationService } from '../../auth/auth.service';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  imports: [],
  template: `
    <!-- Botón igual al de "Nuevo vehículo / Editar datos" -->
    <button
      class="btn primary"
      type="button"
      (click)="showModal = true"
      [disabled]="loading"
      >
      <span class="material-symbols-outlined">
        {{ loading ? 'hourglass_top' : 'logout' }}
      </span>
      <span>{{ loading ? 'Saliendo…' : 'Cerrar sesión' }}</span>
    </button>
    
    <!-- Modal de confirmación con el mismo look & feel -->
    @if (showModal) {
      <div
        class="overlay"
        tabindex="-1"
        (click)="cancelLogout()"
        (keydown.escape)="cancelLogout()"
        >
        <div class="modal modal--sm" role="presentation" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>¿Cerrar sesión?</h3>
            <button
              type="button"
              class="icon-btn"
              (click)="cancelLogout()"
              aria-label="Cerrar"
              >
              ✕
            </button>
          </div>
          <div class="modal-body">
            <p>¿Estás seguro de que querés cerrar tu sesión actual?</p>
          </div>
          <div class="modal-actions">
            <button class="btn ghost" type="button" (click)="cancelLogout()">
              <span class="material-symbols-outlined">close</span>
              Cancelar
            </button>
            <button
              class="btn danger"
              type="button"
              (click)="confirmLogout()"
              [disabled]="loading"
              >
              <span class="material-symbols-outlined">logout</span>
              Salir
            </button>
          </div>
        </div>
      </div>
    }
    `,
  styleUrl: './logout-button.component.css',
})
export class LogoutButtonComponent {
  private authService = inject(AuthenticationService);

  loading = false;
  showModal = false;

  private doLogout(): void {
    if (this.loading) return;
    this.loading = true;
    this.authService.logout().subscribe({
      next: () => {
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  cancelLogout(): void {
    this.showModal = false;
  }
  confirmLogout(): void {
    this.showModal = false;
    this.doLogout();
  }
}
