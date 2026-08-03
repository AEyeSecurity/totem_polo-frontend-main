import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-update-reminder-modal',
  standalone: true,
  imports: [],
  template: `
    @if (showModal) {
      <div
        class="overlay"
        tabindex="-1"
        (click)="dismiss()"
        (keydown.escape)="dismiss()"
      >
        <div
          class="modal modal--sm"
          role="presentation"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <h3>Actualizá los datos de tu empresa</h3>
            <button
              type="button"
              class="icon-btn"
              (click)="dismiss()"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div class="modal-body">
            <span class="material-symbols-outlined reminder-icon"
              >update</span
            >
            <p>
              Hace más de 6 meses que no se actualizan los datos de tu
              empresa. Te recomendamos revisarlos para que el asistente
              virtual del Polo 52 siga respondiendo con información al día.
            </p>
          </div>
          <div class="modal-actions">
            <button class="btn ghost" type="button" (click)="dismiss()">
              Ahora no
            </button>
            <button class="btn primary" type="button" (click)="update()">
              <span class="material-symbols-outlined">edit</span>
              Actualizar ahora
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './update-reminder-modal.component.css',
})
export class UpdateReminderModalComponent {
  @Input() showModal = false;
  @Output() closed = new EventEmitter<void>();
  @Output() goToUpdate = new EventEmitter<void>();

  dismiss(): void {
    this.closed.emit();
  }

  update(): void {
    this.goToUpdate.emit();
  }
}
