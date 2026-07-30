import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  AdminPoloService,
  EmpresaCreate,
  UsuarioCreate,
  UsuarioUpdate,
  ServicioPoloCreate,
  LoteCreate,
  PoloSelfUpdate,
} from './admin-polo.service';
import { environment } from '../../environments/environment';

describe('AdminPoloService', () => {
  let service: AdminPoloService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdminPoloService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getPoloDetails / updatePolo should hit /polo/me with GET and PUT', () => {
    service.getPoloDetails().subscribe();
    expect(httpMock.expectOne(`${base}/polo/me`).request.method).toBe('GET');

    const payload: PoloSelfUpdate = {
      cant_empleados: 5,
      horario_trabajo: '8-17',
    };
    service.updatePolo(payload).subscribe();
    const req = httpMock.expectOne(`${base}/polo/me`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('should create, update and delete an empresa', () => {
    const nueva: EmpresaCreate = {
      cuil: 20111222333,
      nombre: 'ACME',
      rubro: 'Industria',
      cant_empleados: 20,
      horario_trabajo: '9-18',
      estado: true,
    };

    service.createEmpresa(nueva).subscribe();
    httpMock.expectOne(`${base}/empresas`).flush({});

    service.updateEmpresa(nueva.cuil, { nombre: 'ACME SA' }).subscribe();
    const updateReq = httpMock.expectOne(`${base}/empresas/${nueva.cuil}`);
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({});

    service.deleteEmpresa(nueva.cuil).subscribe();
    expect(
      httpMock.expectOne(`${base}/empresas/${nueva.cuil}`).request.method
    ).toBe('DELETE');
  });

  it('activarEmpresa / desactivarEmpresa should PUT to the dedicated endpoints', () => {
    service.activarEmpresa(123).subscribe();
    expect(
      httpMock.expectOne(`${base}/empresas/123/activar`).request.method
    ).toBe('PUT');

    service.desactivarEmpresa(123).subscribe();
    expect(
      httpMock.expectOne(`${base}/empresas/123/desactivar`).request.method
    ).toBe('PUT');
  });

  it('should create, update and delete a usuario', () => {
    const nuevo: UsuarioCreate = {
      email: 'a@b.com',
      nombre: 'Juan',
      estado: true,
      cuil: 1,
      id_rol: 1,
    };
    const update: UsuarioUpdate = { estado: false };

    service.createUser(nuevo).subscribe();
    httpMock.expectOne(`${base}/usuarios`).flush({});

    service.updateUser('u1', update).subscribe();
    const req = httpMock.expectOne(`${base}/usuarios/u1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(update);
    req.flush({});

    service.deleteUser('u1').subscribe();
    expect(httpMock.expectOne(`${base}/usuarios/u1`).request.method).toBe(
      'DELETE'
    );
  });

  it('should create and delete a servicio del polo', () => {
    const nuevo: ServicioPoloCreate = {
      nombre: 'Coworking',
      id_tipo_servicio_polo: 1,
      cuil: 1,
    };

    service.createServicioPolo(nuevo).subscribe();
    httpMock.expectOne(`${base}/serviciopolo`).flush({});

    service.deleteServicioPolo(7).subscribe();
    expect(
      httpMock.expectOne(`${base}/serviciopolo/7`).request.method
    ).toBe('DELETE');
  });

  it('should create and delete a lote', () => {
    const nuevo: LoteCreate = {
      dueno: 'Juan',
      lote: 1,
      manzana: 2,
      id_servicio_polo: 1,
    };

    service.createLote(nuevo).subscribe();
    httpMock.expectOne(`${base}/lotes`).flush({});

    service.deleteLote(9).subscribe();
    expect(httpMock.expectOne(`${base}/lotes/9`).request.method).toBe(
      'DELETE'
    );
  });

  it('getRoles / getUsers / getEmpresas / getServiciosPolo / getLotes should GET their collections', () => {
    service.getRoles().subscribe();
    const rolesReq = httpMock.expectOne(`${base}/roles`);
    expect(rolesReq.request.method).toBe('GET');
    rolesReq.flush([]);

    service.getUsers().subscribe();
    const usersReq = httpMock.expectOne(`${base}/usuarios`);
    expect(usersReq.request.method).toBe('GET');
    usersReq.flush([]);

    service.getEmpresas().subscribe();
    const empresasReq = httpMock.expectOne(`${base}/empresas`);
    expect(empresasReq.request.method).toBe('GET');
    empresasReq.flush([]);

    service.getServiciosPolo().subscribe();
    const serviciosReq = httpMock.expectOne(`${base}/serviciopolo`);
    expect(serviciosReq.request.method).toBe('GET');
    serviciosReq.flush([]);

    service.getLotes().subscribe();
    const lotesReq = httpMock.expectOne(`${base}/lotes`);
    expect(lotesReq.request.method).toBe('GET');
    lotesReq.flush([]);
  });
});
