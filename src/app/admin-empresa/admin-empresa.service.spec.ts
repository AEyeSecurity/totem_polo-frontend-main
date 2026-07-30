import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  AdminEmpresaService,
  VehiculoCreate,
  ServicioCreate,
  ServicioUpdate,
  ContactoCreate,
  EmpresaSelfUpdate,
} from './admin-empresa.service';
import { environment } from '../../environments/environment';

describe('AdminEmpresaService', () => {
  let service: AdminEmpresaService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdminEmpresaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getMyCompanyDetails should GET /me', () => {
    service.getMyCompanyDetails().subscribe();
    const req = httpMock.expectOne(`${base}/me`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updateMyCompany should PUT the company payload to /companies/me', () => {
    const payload: EmpresaSelfUpdate = {
      cant_empleados: 10,
      observaciones: 'ok',
      horario_trabajo: '9 a 18',
    };
    service.updateMyCompany(payload).subscribe();
    const req = httpMock.expectOne(`${base}/companies/me`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('should fetch the four "tipos" catalogs from their own endpoints', () => {
    service.getTiposVehiculo().subscribe();
    const vehiculoReq = httpMock.expectOne(`${base}/tipos/vehiculo`);
    expect(vehiculoReq.request.method).toBe('GET');
    vehiculoReq.flush([]);

    service.getTiposServicio().subscribe();
    const servicioReq = httpMock.expectOne(`${base}/tipos/servicio`);
    expect(servicioReq.request.method).toBe('GET');
    servicioReq.flush([]);

    service.getTiposContacto().subscribe();
    const contactoReq = httpMock.expectOne(`${base}/tipos/contacto`);
    expect(contactoReq.request.method).toBe('GET');
    contactoReq.flush([]);

    service.getTiposServicioPolo().subscribe();
    const servicioPoloReq = httpMock.expectOne(`${base}/tipos/servicio-polo`);
    expect(servicioPoloReq.request.method).toBe('GET');
    servicioPoloReq.flush([]);
  });

  it('should create, update and delete a vehiculo against /vehiculos', () => {
    const nuevo: VehiculoCreate = {
      id_tipo_vehiculo: 1,
      horarios: '08-18',
      frecuencia: 'diaria',
      datos: {},
    };

    service.createVehiculo(nuevo).subscribe();
    const createReq = httpMock.expectOne(`${base}/vehiculos`);
    expect(createReq.request.method).toBe('POST');
    createReq.flush({});

    service.updateVehiculo(5, nuevo).subscribe();
    const updateReq = httpMock.expectOne(`${base}/vehiculos/5`);
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({});

    service.deleteVehiculo(5).subscribe();
    const deleteReq = httpMock.expectOne(`${base}/vehiculos/5`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({});
  });

  it('should create, update and delete a servicio against /servicios', () => {
    const nuevo: ServicioCreate = { datos: {}, id_tipo_servicio: 1 };
    const update: ServicioUpdate = { datos: { m2: 20 } };

    service.createServicio(nuevo).subscribe();
    httpMock.expectOne(`${base}/servicios`).flush({});

    service.updateServicio(3, update).subscribe();
    const req = httpMock.expectOne(`${base}/servicios/3`);
    expect(req.request.method).toBe('PUT');
    req.flush({});

    service.deleteServicio(3).subscribe();
    expect(httpMock.expectOne(`${base}/servicios/3`).request.method).toBe(
      'DELETE'
    );
  });

  it('should create, update and delete a contacto against /contactos', () => {
    const nuevo: ContactoCreate = {
      id_tipo_contacto: 1,
      nombre: 'Juan',
      id_servicio_polo: 1,
    };

    service.createContacto(nuevo).subscribe();
    httpMock.expectOne(`${base}/contactos`).flush({});

    service.updateContacto(9, nuevo).subscribe();
    const req = httpMock.expectOne(`${base}/contactos/9`);
    expect(req.request.method).toBe('PUT');
    req.flush({});

    service.deleteContacto(9).subscribe();
    expect(httpMock.expectOne(`${base}/contactos/9`).request.method).toBe(
      'DELETE'
    );
  });

  it('changePasswordRequest should POST to password-reset/request-logged-user', () => {
    service.changePasswordRequest().subscribe();
    const req = httpMock.expectOne(
      `${base}/password-reset/request-logged-user`
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
