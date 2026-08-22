// map-location-picker.component.ts
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../google-maps-loader.service';

// Centro del Parque Industrial Polo 52 (Cordoba Capital), sobre la
// Autopista Cordoba - Rosario. Se usa como vista inicial cuando el lote
// todavia no tiene una ubicacion cargada.
const POLO_52_CENTER: google.maps.LatLngLiteral = {
  lat: -31.42153,
  lng: -64.10269,
};

@Component({
  selector: 'app-map-location-picker',
  standalone: true,
  imports: [GoogleMapsModule],
  templateUrl: './map-location-picker.component.html',
  styleUrl: './map-location-picker.component.css',
})
export class MapLocationPickerComponent implements OnInit, OnChanges {
  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Output() locationChange = new EventEmitter<{ lat: number; lng: number }>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  ready = false;
  loadError = '';

  center: google.maps.LatLngLiteral = POLO_52_CENTER;
  zoom = 16;
  markerPosition: google.maps.LatLngLiteral | null = null;

  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
  };

  private autocomplete?: google.maps.places.Autocomplete;

  constructor(private loader: GoogleMapsLoaderService) {}

  ngOnInit(): void {
    this.loader
      .load()
      .then(() => {
        this.ready = true;
        this.applyInputPosition();
        setTimeout(() => this.initAutocomplete());
      })
      .catch((err) => {
        this.loadError = err?.message || 'No se pudo cargar el mapa.';
      });
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.ready) this.applyInputPosition();
  }

  private applyInputPosition(): void {
    if (this.lat != null && this.lng != null) {
      this.markerPosition = { lat: this.lat, lng: this.lng };
      this.center = this.markerPosition;
      this.zoom = 18;
    }
  }

  private initAutocomplete(): void {
    if (this.autocomplete || !this.searchInput) return;

    // Sesga (sin restringir) los resultados hacia la zona del parque para
    // que buscar una empresa instalada ahi devuelva resultados relevantes
    // primero.
    const bias = new google.maps.Circle({
      center: POLO_52_CENTER,
      radius: 3000,
    });

    this.autocomplete = new google.maps.places.Autocomplete(
      this.searchInput.nativeElement,
      { fields: ['geometry'], bounds: bias.getBounds() ?? undefined }
    );

    this.autocomplete.addListener('place_changed', () => {
      const place = this.autocomplete!.getPlace();
      const location = place.geometry?.location;
      if (!location) return;

      const lat = location.lat();
      const lng = location.lng();
      this.center = { lat, lng };
      this.zoom = 18;
      this.markerPosition = { lat, lng };
      this.locationChange.emit({ lat, lng });
    });
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    this.markerPosition = { lat, lng };
    this.locationChange.emit({ lat, lng });
  }
}
