import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { EmpresaMeComponent } from './admin-empresa.component';
import { environment } from '../../environments/environment';
import { Vehiculo } from './admin-empresa.service';

describe('AdminEmpresaComponent', () => {
  let component: EmpresaMeComponent;
  let fixture: ComponentFixture<EmpresaMeComponent>;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmpresaMeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmpresaMeComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    // ngOnInit fires loadTipos() (4 catalogs), loadEmpresaData() (/me) y
    // loadComercialInfo() (/companies/me/comercial)
    httpMock.expectOne(`${base}/tipos/vehiculo`).flush([]);
    httpMock.expectOne(`${base}/tipos/servicio`).flush([]);
    httpMock.expectOne(`${base}/tipos/contacto`).flush([]);
    httpMock.expectOne(`${base}/tipos/servicio-polo`).flush([]);
    httpMock.expectOne(`${base}/me`).flush({
      cuil: 1,
      nombre: 'ACME',
      rubro: 'Industria',
      cant_empleados: 5,
      fecha_ingreso: '2024-01-01',
      horario_trabajo: '9 a 18',
      vehiculos: [],
      contactos: [],
      servicios: [],
      servicios_polo: [],
    });
    // Empresa sin ficha comercial cargada todavia: el backend devuelve 404.
    httpMock
      .expectOne(`${base}/companies/me/comercial`)
      .flush(null, { status: 404, statusText: 'Not Found' });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the company details returned by the backend', () => {
    expect(component.empresaData?.nombre).toBe('ACME');
    expect(component.loading).toBeFalse();
  });

  describe('filterVehiculos', () => {
    const vehiculos: Vehiculo[] = [
      {
        id_vehiculo: 1,
        id_tipo_vehiculo: 1,
        horarios: '08-18',
        frecuencia: 'diaria',
        datos: { patente: 'AB123CD' },
      },
      {
        id_vehiculo: 2,
        id_tipo_vehiculo: 2,
        horarios: '09-17',
        frecuencia: 'semanal',
        datos: { patente: 'ZZ999YY' },
      },
    ];

    beforeEach(() => {
      component.empresaData = { ...(component.empresaData as any), vehiculos };
    });

    it('should return every vehiculo when there is no search term', () => {
      component.vehiculoSearchTerm = '';
      component.filterVehiculos();
      expect(component.filteredVehiculos.length).toBe(2);
    });

    it('should filter vehiculos by patente', () => {
      component.vehiculoSearchTerm = 'ab123cd';
      component.filterVehiculos();
      expect(component.filteredVehiculos.length).toBe(1);
      expect(component.filteredVehiculos[0].id_vehiculo).toBe(1);
    });

    it('clearVehiculoSearch should reset the search term and the filtered list', () => {
      component.vehiculoSearchTerm = 'ab123cd';
      component.filterVehiculos();
      component.clearVehiculoSearch();

      expect(component.vehiculoSearchTerm).toBe('');
      expect(component.filteredVehiculos.length).toBe(2);
    });
  });

  describe('formatBoolean', () => {
    it('should translate truthy/falsy-like values to Si/No', () => {
      expect(component.formatBoolean(true)).toBe('Si');
      expect(component.formatBoolean('si')).toBe('Si');
      expect(component.formatBoolean(false)).toBe('No');
      expect(component.formatBoolean('0')).toBe('No');
      expect(component.formatBoolean(null)).toBe('');
    });
  });

  describe('esTipoComercial', () => {
    it('should return true only for tipo_contacto 1', () => {
      component.contactoForm.id_tipo_contacto = 1;
      expect(component.esTipoComercial()).toBeTrue();

      component.contactoForm.id_tipo_contacto = 2;
      expect(component.esTipoComercial()).toBeFalse();
    });
  });
});
