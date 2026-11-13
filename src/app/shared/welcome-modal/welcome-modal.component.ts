import { DialogFocusDirective } from '../dialog-focus.directive';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-welcome-modal',
  standalone: true,
  imports: [DialogFocusDirective],
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
          appDialogFocus
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <h3>¡Bienvenido a Polo 52!</h3>
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
              >waving_hand</span
            >
            <p>
              Le recomendamos completar la información comercial de su empresa para que el asistente virtual del Polo pueda responder consultas sobre ella.
            </p>
          </div>
          <div class="modal-actions">
            <button class="btn primary" type="button" (click)="update()">
              <span class="material-symbols-outlined">edit_note</span>
              Completar información comercial
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './welcome-modal.component.css',
})
export class WelcomeModalComponent {
  @Input() showModal = false;
  @Output() closed = new EventEmitter<void>();
  @Output() goToComercial = new EventEmitter<void>();

  dismiss(): void {
    this.closed.emit();
  }

  update(): void {
    this.goToComercial.emit();
  }
}
