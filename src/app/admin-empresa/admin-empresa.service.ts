import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Vehiculo {
  id_vehiculo: number;
  id_tipo_vehiculo: number;
  horarios: string;
  frecuencia: string;
  datos: any;
  tipo_vehiculo?: string;
}

export interface VehiculoCreate {
  id_tipo_vehiculo: number;
  horarios: string;
  frecuencia: string;
  datos: any;
}

export interface Servicio {
  id_servicio: number;
  datos: any;
  id_tipo_servicio: number;
  tipo_servicio?: string;
}

export interface Lote {
  id_lotes: number;
  dueno: string;
  lote: number;
  manzana: number;
  id_servicio_polo: number;
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
  lotes: Lote[];
}

export interface ServicioCreate {
  datos: any;
  id_tipo_servicio: number;
}

export interface ServicioUpdate {
  datos?: any;
  id_tipo_servicio?: number;
}

export interface Contacto {
  id_contacto: number;
  id_tipo_contacto: number;
  nombre: string;
  telefono?: string;
  datos?: any;
  direccion?: string;
  id_servicio_polo: number;
  tipo_contacto?: string;
}

export interface ContactoCreate {
  id_tipo_contacto: number;
  nombre: string;
  telefono?: string;
  datos?: any;
  direccion?: string;
  id_servicio_polo: number;
}

export interface EmpresaSelfUpdate {
  cant_empleados?: number;
  observaciones?: string;
  horario_trabajo?: string;
}

export interface EmpresaDetail {
  cuil: number;
  nombre: string;
  rubro: string;
  cant_empleados: number;
  observaciones?: string;
  fecha_ingreso: string;
  horario_trabajo: string;
  vehiculos: Vehiculo[];
  contactos: Contacto[];
  servicios: Servicio[];
  servicios_polo: ServicioPolo[];
}

export interface UserUpdateCompany {
  password: string;
}

// Interfaces para los tipos
export interface TipoVehiculo {
  id_tipo_vehiculo: number;
  tipo: string;
}

export interface TipoServicio {
  id_tipo_servicio: number;
  tipo: string;
}

export interface TipoContacto {
  id_tipo_contacto: number;
  tipo: string;
}

export interface TipoServicioPolo {
  id_tipo_servicio_polo: number;
  tipo: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminEmpresaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Obtener tipos desde la BD
  getTiposVehiculo(): Observable<TipoVehiculo[]> {
    return this.http.get<TipoVehiculo[]>(`${this.apiUrl}/tipos/vehiculo`);
  }

  getTiposServicio(): Observable<TipoServicio[]> {
    return this.http.get<TipoServicio[]>(`${this.apiUrl}/tipos/servicio`);
  }

  getTiposContacto(): Observable<TipoContacto[]> {
    return this.http.get<TipoContacto[]>(`${this.apiUrl}/tipos/contacto`);
  }

  getTiposServicioPolo(): Observable<TipoServicioPolo[]> {
    return this.http.get<TipoServicioPolo[]>(
      `${this.apiUrl}/tipos/servicio-polo`
    );
  }

  // Actualizar contraseña
  updatePassword(password: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/update_password`, { password });
  }

  // Vehículos
  createVehiculo(vehiculo: VehiculoCreate): Observable<Vehiculo> {
    return this.http.post<Vehiculo>(`${this.apiUrl}/vehiculos`, vehiculo);
  }

  updateVehiculo(id: number, vehiculo: VehiculoCreate): Observable<Vehiculo> {
    return this.http.put<Vehiculo>(`${this.apiUrl}/vehiculos/${id}`, vehiculo);
  }

  deleteVehiculo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/vehiculos/${id}`);
  }

  // Servicios
  createServicio(servicio: ServicioCreate): Observable<Servicio> {
    return this.http.post<Servicio>(`${this.apiUrl}/servicios`, servicio);
  }

  updateServicio(id: number, servicio: ServicioUpdate): Observable<Servicio> {
    return this.http.put<Servicio>(`${this.apiUrl}/servicios/${id}`, servicio);
  }

  deleteServicio(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/servicios/${id}`);
  }

  // Contactos
  createContacto(contacto: ContactoCreate): Observable<Contacto> {
    return this.http.post<Contacto>(`${this.apiUrl}/contactos`, contacto);
  }

  updateContacto(id: number, contacto: ContactoCreate): Observable<Contacto> {
    return this.http.put<Contacto>(`${this.apiUrl}/contactos/${id}`, contacto);
  }

  deleteContacto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/contactos/${id}`);
  }

  // Datos de empresa
  updateMyCompany(data: EmpresaSelfUpdate): Observable<any> {
    return this.http.put(`${this.apiUrl}/companies/me`, data);
  }

  getMyCompanyDetails(): Observable<EmpresaDetail> {
    return this.http.get<EmpresaDetail>(`${this.apiUrl}/me`);
  }

  // Solicitar cambio de contraseña por email
  changePasswordRequest(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/password-reset/request-logged-user`,
      {}
    );
  }
}

// Solicitar cambio de contraseña por email
