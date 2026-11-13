import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Lleva el foco del teclado al dialogo cuando se abre y lo devuelve al
 * elemento que lo abrio cuando se cierra.
 *
 * Asi la tecla Escape (escuchada en el overlay) funciona apenas se abre el
 * modal, sin tener que hacer clic adentro, y los lectores de pantalla quedan
 * dentro del dialogo. Se enfoca el contenedor (tabindex="-1") y no el primer
 * campo para no abrir el teclado del celular sin que el usuario lo pida.
 * Solo presentacion/accesibilidad: no cambia ninguna accion del modal.
 */
@Directive({
  selector: '[appDialogFocus]',
  standalone: true,
})
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private previouslyFocused: HTMLElement | null = null;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const active = document.activeElement;
    this.previouslyFocused = active instanceof HTMLElement ? active : null;
    const host = this.el.nativeElement;
    if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
    // Si el foco ya esta dentro (por ejemplo, un campo con autofocus), no se mueve.
    if (!host.contains(document.activeElement)) {
      host.focus({ preventScroll: true });
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    const target = this.previouslyFocused;
    if (target && document.contains(target)) {
      target.focus({ preventScroll: true });
    }
  }
}
