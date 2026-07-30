import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AdminPoloComponent } from './admin-polo.component';
import { environment } from '../../environments/environment';
import { Empresa } from './admin-polo.service';

describe('AdminPoloComponent', () => {
  let component: AdminPoloComponent;
  let fixture: ComponentFixture<AdminPoloComponent>;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPoloComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPoloComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    // ngOnInit triggers loadRoles(), loadPoloData() and loadData() (dashboard forkJoin)
    httpMock.expectOne(`${base}/roles`).flush([]);
    httpMock.expectOne(`${base}/polo/me`).flush({
      cuil: 1,
      nombre: 'Polo 52',
      rubro: 'Parque industrial',
      cant_empleados: 3,
      fecha_ingreso: '2024-01-01',
      horario_trabajo: '9 a 18',
      empresas: [],
      servicios_polo: [],
      usuarios: [],
      lotes: [],
    });
    httpMock.expectOne(`${base}/empresas`).flush([]);
    httpMock.expectOne(`${base}/usuarios`).flush([]);
    httpMock.expectOne(`${base}/serviciopolo`).flush([]);
    httpMock.expectOne(`${base}/lotes`).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the polo details returned by the backend', () => {
    expect(component.poloData?.nombre).toBe('Polo 52');
    expect(component.loading).toBeFalse();
  });

  describe('filterEmpresas', () => {
    const empresas: Empresa[] = [
      {
        cuil: 20111222333,
        nombre: 'ACME',
        rubro: 'Industria',
        cant_empleados: 10,
        fecha_ingreso: '2024-01-01',
        horario_trabajo: '9-18',
        estado: true,
      },
      {
        cuil: 20444555666,
        nombre: 'Beta SRL',
        rubro: 'Logistica',
        cant_empleados: 4,
        fecha_ingreso: '2024-02-01',
        horario_trabajo: '9-18',
        estado: false,
      },
    ];

    beforeEach(() => {
      component.empresas = empresas;
    });

    it('should return every empresa when there is no search term', () => {
      component.empresaSearchTerm = '';
      component.filterEmpresas();
      expect(component.filteredEmpresas.length).toBe(2);
    });

    it('should filter empresas by nombre', () => {
      component.empresaSearchTerm = 'beta';
      component.filterEmpresas();
      expect(component.filteredEmpresas.length).toBe(1);
      expect(component.filteredEmpresas[0].nombre).toBe('Beta SRL');
    });

    it('should expose empresasActivas / empresasInactivas counts', () => {
      expect(component.empresasActivas).toBe(1);
      expect(component.empresasInactivas).toBe(1);
      expect(component.totalEmpresas).toBe(2);
    });
  });

  describe('getEmpresaNombre', () => {
    it('should return a dash for a nullish cuil', () => {
      expect(component.getEmpresaNombre(null)).toBe('—');
      expect(component.getEmpresaNombre(undefined)).toBe('—');
    });

    it('should return the cuil as a string when there is no matching empresa', () => {
      expect(component.getEmpresaNombre(999)).toBe('999');
    });
  });
});
