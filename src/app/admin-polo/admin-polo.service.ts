import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
// 1) Interfaz Empresa con estado
export interface Empresa {
  cuil: number;
  nombre: string;
  rubro: string;
  cant_empleados: number;
  observaciones?: string;
  fecha_ingreso: string;
  horario_trabajo: string;
  estado: boolean; // ← NUEVO
  estado_solicitud: 'pendiente' | 'aprobada' | 'rechazada';
}

export interface SolicitudRegistro {
  cuil: number;
  nombre: string;
  rubro: string;
  cant_empleados: number;
  horario_trabajo: string;
  observaciones?: string;
  fecha_ingreso: string;
  estado_solicitud: string;
  usuario: { nombre: string; email: string } | null;
}

export interface EmpresaUpdate {
  nombre?: string;
  rubro?: string;
  estado?: boolean;
  cant_empleados?: number;
  observaciones?: string;
  horario_trabajo?: string;
}

export interface Usuario {
  id_usuario: string;
  email: string;
  nombre: string;
  estado: boolean;
  fecha_registro: string;
  cuil: number;
  roles?: Rol[];
}

export interface UsuarioCreate {
  email: string;
  nombre: string;
  password?: string; // Opcional para creación automática
  estado: boolean;
  cuil: number;
  id_rol: number;
}
export interface UsuarioUpdate {
  password?: string;
  estado?: boolean;
}

export interface Rol {
  id_rol: number;
  tipo_rol: string;
}

export interface ServicioPolo {
  id_servicio_polo: number;
  nombre: string;
  horario?: string;
  datos?: any;
  propietario?: string;
  id_tipo_servicio_polo: number;
  cuil: number;
  tipo_servicio_polo?: string;
}

export interface ServicioPoloCreate {
  nombre: string;
  horario?: string;
  datos?: any;
  propietario?: string;
  id_tipo_servicio_polo: number;
  cuil: number;
}

export interface Lote {
  id_lotes: number;
  dueno: string;
  lote: number;
  manzana: number;
  id_servicio_polo: number;
}

export interface LoteCreate {
  dueno: string;
  lote: number;
  manzana: number;
  id_servicio_polo: number;
}

// 🔥 NUEVAS INTERFACES PARA EL PERFIL DEL POLO
export interface PoloDetail {
  cuil: number;
  nombre: string;
  rubro: string;
  cant_empleados: number;
  fecha_ingreso: string;
  horario_trabajo: string;
  observaciones?: string;
  empresas: Empresa[];
  servicios_polo: ServicioPolo[];
  usuarios: Usuario[];
  lotes: Lote[];
}

export interface PoloSelfUpdate {
  cant_empleados: number;
  observaciones?: string;
  horario_trabajo: string;
}

// Informacion comercial del Polo (misma ficha que usan las empresas)
export interface InfoComercial {
  productos_servicios?: string | null;
  publico_objetivo?: string | null;
  atiende_publico?: boolean | null;
  horario_atencion_comercial?: string | null;
  rango_precios?: string | null;
  modalidad_venta?: string | null;
  marcas_representadas?: string | null;
  certificaciones?: string | null;
  observaciones_comerciales?: string | null;
  completado: boolean;
}

export interface InfoComercialUpdate {
  productos_servicios?: string | null;
  publico_objetivo?: string | null;
  atiende_publico?: boolean | null;
  horario_atencion_comercial?: string | null;
  rango_precios?: string | null;
  modalidad_venta?: string | null;
  marcas_representadas?: string | null;
  certificaciones?: string | null;
  observaciones_comerciales?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AdminPoloService {
  private http = inject(HttpClient);

  private apiUrl = environment.apiUrl;

  // 🔥 NUEVOS MÉTODOS PARA EL PERFIL DEL POLO
  getPoloDetails(): Observable<PoloDetail> {
    return this.http.get<PoloDetail>(`${this.apiUrl}/polo/me`);
  }

  updatePolo(poloData: PoloSelfUpdate): Observable<PoloDetail> {
    return this.http.put<PoloDetail>(`${this.apiUrl}/polo/me`, poloData);
  }

  // Informacion comercial del Polo (carga/edicion directa, sin wizard)
  getComercialInfo(): Observable<InfoComercial> {
    return this.http.get<InfoComercial>(`${this.apiUrl}/polo/comercial`);
  }

  updateComercialInfo(data: InfoComercialUpdate): Observable<InfoComercial> {
    return this.http.put<InfoComercial>(`${this.apiUrl}/polo/comercial`, data);
  }

  changePasswordRequest(): Observable<any> {
    return this.http.post(`${this.apiUrl}/polo/change-password-request`, {});
  }

  // Roles
  getRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/roles`);
  }

  // Usuarios
  getUsers(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/usuarios`);
  }

  // 2) getUser (corregir URL)
  getUser(userId: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/usuarios/${userId}`); // ← FIX
  }

  createUser(usuario: UsuarioCreate): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/usuarios`, usuario);
  }

  updateUser(userId: string, usuario: UsuarioUpdate): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/usuarios/${userId}`, usuario);
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/usuarios/${userId}`);
  }

  // Empresas
  getEmpresas(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(`${this.apiUrl}/empresas`);
  }

  // Solicitudes de registro (autoregistro público, pendientes de aprobación)
  getSolicitudes(): Observable<SolicitudRegistro[]> {
    return this.http.get<SolicitudRegistro[]>(`${this.apiUrl}/empresas/solicitudes`);
  }

  aprobarSolicitud(cuil: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/empresas/${cuil}/aprobar`, {});
  }

  rechazarSolicitud(cuil: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/empresas/${cuil}/rechazar`, {});
  }

  updateEmpresa(cuil: number, empresa: EmpresaUpdate): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.apiUrl}/empresas/${cuil}`, empresa);
  }

  deleteEmpresa(cuil: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/empresas/${cuil}`);
  }

  // Servicios del Polo
  getServiciosPolo(): Observable<ServicioPolo[]> {
    return this.http.get<ServicioPolo[]>(`${this.apiUrl}/serviciopolo`);
  }

  createServicioPolo(servicio: ServicioPoloCreate): Observable<ServicioPolo> {
    return this.http.post<ServicioPolo>(
      `${this.apiUrl}/serviciopolo`,
      servicio
    );
  }

  deleteServicioPolo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/serviciopolo/${id}`);
  }

  // Lotes
  getLotes(): Observable<Lote[]> {
    return this.http.get<Lote[]>(`${this.apiUrl}/lotes`);
  }

  createLote(lote: LoteCreate): Observable<Lote> {
    return this.http.post<Lote>(`${this.apiUrl}/lotes`, lote);
  }

  deleteLote(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/lotes/${id}`);
  }
  // 3) Activar / Desactivar empresa (reemplazar 'base' por this.apiUrl)
  activarEmpresa(cuil: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/empresas/${cuil}/activar`, {}); // ← FIX
  }

  desactivarEmpresa(cuil: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/empresas/${cuil}/desactivar`, {}); // ← FIX
  }
}
