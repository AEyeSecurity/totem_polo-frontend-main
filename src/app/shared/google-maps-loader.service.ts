// google-maps-loader.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

// Carga el script de la Google Maps JavaScript API una sola vez (aunque se
// pida desde varios componentes a la vez), inyectandolo dinamicamente para
// poder usar la API key de `environment` en vez de fijarla en index.html.
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadPromise?: Promise<void>;

  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    if ((window as any).google?.maps) {
      this.loadPromise = Promise.resolve();
      return this.loadPromise;
    }

    if (!environment.googleMapsApiKey) {
      this.loadPromise = Promise.reject(
        new Error(
          'Falta configurar googleMapsApiKey en el environment del frontend.'
        )
      );
      return this.loadPromise;
    }

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      // `libraries=places` habilita el buscador de direcciones (Autocomplete)
      // del picker de ubicacion.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('No se pudo cargar Google Maps.'));
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
