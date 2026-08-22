// map-location-view.component.ts
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../google-maps-loader.service';

// Mini mapa de solo lectura: muestra un pin fijo en la ubicacion cargada
// para un lote/empresa, sin controles (no se puede mover ni hacer zoom).
// Se usa en listados (tabla de lotes, directorio de empresas) para dar un
// vistazo rapido de donde esta cada una dentro del parque.
@Component({
  selector: 'app-map-location-view',
  standalone: true,
  imports: [GoogleMapsModule],
  templateUrl: './map-location-view.component.html',
  styleUrl: './map-location-view.component.css',
})
export class MapLocationViewComponent implements OnInit, OnChanges {
  @Input() lat: number | null | undefined = null;
  @Input() lng: number | null | undefined = null;
  @Input() zoom = 18;

  ready = false;
  loadError = '';
  expanded = false;
  center: google.maps.LatLngLiteral | null = null;
  markerPosition: google.maps.LatLngLiteral | null = null;

  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
    disableDefaultUI: true,
    gestureHandling: 'none',
    keyboardShortcuts: false,
    clickableIcons: false,
    zoomControl: false,
  };

  // Mapa grande al expandir: interactivo (arrastrar, hacer zoom, cambiar a
  // Street View) para poder explorar bien la zona alrededor del pin.
  expandedZoom = 19;
  expandedMapOptions: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
    streetViewControl: true,
    fullscreenControl: true,
    mapTypeControl: true,
    zoomControl: true,
  };

  private loaded = false;

  constructor(private loader: GoogleMapsLoaderService) {}

  ngOnInit(): void {
    this.maybeLoad();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.maybeLoad();
    if (this.ready) this.applyPosition();
  }

  private maybeLoad(): void {
    if (this.loaded || this.lat == null || this.lng == null) return;
    this.loaded = true;

    this.loader
      .load()
      .then(() => {
        this.ready = true;
        this.applyPosition();
      })
      .catch((err) => {
        this.loadError = err?.message || 'No se pudo cargar el mapa.';
      });
  }

  private applyPosition(): void {
    if (this.lat != null && this.lng != null) {
      this.center = { lat: this.lat, lng: this.lng };
      this.markerPosition = this.center;
    }
  }

  open(): void {
    if (this.lat == null || this.lng == null) return;
    this.expanded = true;
  }

  close(): void {
    this.expanded = false;
  }
}
