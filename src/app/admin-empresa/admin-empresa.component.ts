import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxJsonViewerModule } from 'ngx-json-viewer';

import { AuthenticationService } from '../auth/auth.service';

import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  AdminEmpresaService,
  Vehiculo,
  VehiculoCreate,
  Servicio,
  ServicioCreate,
  ServicioUpdate,
  ServicioPolo,
  Contacto,
  ContactoCreate,
  EmpresaDetail,
  EmpresaSelfUpdate,
  UserUpdateCompany,
  TipoVehiculo,
  TipoServicio,
  TipoContacto,
  TipoServicioPolo,
} from './admin-empresa.service';
import { LogoutButtonComponent } from '../shared/logout-button/logout-button.component';
import { PasswordChangeModalComponent } from '../shared/password-change-modal/password-change-modal.component';

// Interfaces para manejo de errores
interface FormError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'duplicate' | 'server' | 'validation';
}

interface ErrorResponse {
  detail?: string;
  message?: string;
  errors?: { [key: string]: string[] };
  status?: number;
}

@Component({
  selector: 'app-empresa-me',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LogoutButtonComponent,
    NgxJsonViewerModule,
    PasswordChangeModalComponent,
  ],
  templateUrl: './admin-empresa.component.html',
  styleUrls: ['./admin-empresa.component.css'],
})
export class EmpresaMeComponent implements OnInit {
  // pestanas
  activeTab:
    | 'dashboard'
    | 'vehiculos'
    | 'servicios'
    | 'contactos'
    | 'serviciosPolo'
    | 'perfil'
    | 'config' = 'dashboard';

  // limite de items en “Actividad Reciente”
  private readonly MAX_ACTIVIDADES = 6;

  // Datos de la empresa
  empresaData: EmpresaDetail | null = null;

  // Formularios / modales
  showPasswordForm = false;
  showVehiculoForm = false;
  showServicioForm = false;
  showContactoForm = false;
  showEmpresaEditForm = false;
  showPasswordModal = false; // ← requerido por la plantilla

  // Estados de edicion
  editingVehiculo: Vehiculo | null = null;
  editingServicio: Servicio | null = null;
  editingContacto: Contacto | null = null;

  // PROPIEDADES PARA CONTROL DE CAMBIOS
  private initialForms: { [key: string]: any } = {};
  private hasUnsavedChanges: { [key: string]: boolean } = {};

  // Formularios
  passwordForm = {
    password: '',
    confirmPassword: '',
  };

  vehiculoForm: VehiculoCreate = {
    id_tipo_vehiculo: 1,
    horarios: '',
    frecuencia: '',
    datos: {},
  };

  servicioForm: ServicioCreate = {
    datos: {},
    id_tipo_servicio: 1,
  };

  contactoForm: ContactoCreate = {
    id_tipo_contacto: 1,
    nombre: '',
    telefono: '',
    datos: {},
    direccion: '',
    id_servicio_polo: 1,
  };

  empresaEditForm: EmpresaSelfUpdate = {
    cant_empleados: 0,
    observaciones: '',
    horario_trabajo: '',
  };

  // Estados
  loading = false;
  loadingTipos = false;
  message = '';
  messageType: 'success' | 'error' = 'success';
  private expandedVehiculos = new Set<number>();
  private expandedServicios = new Set<number>();

  // Sistema de errores mejorado
  formErrors: { [key: string]: FormError[] } = {};
  showErrorDetails = false;

  // Tipos desde la BD
  tiposVehiculo: TipoVehiculo[] = [];
  tiposServicio: TipoServicio[] = [];
  tiposContacto: TipoContacto[] = [];
  tiposServicioPolo: TipoServicioPolo[] = [];

  // PROPIEDADES PARA BUSQUEDA
  vehiculoSearchTerm: string = '';
  servicioSearchTerm: string = '';
  contactoSearchTerm: string = '';
  servicioPoloSearchTerm: string = '';

  // Arrays filtrados
  filteredVehiculos: Vehiculo[] = [];
  filteredServicios: Servicio[] = [];
  filteredContactos: Contacto[] = [];
  filteredServiciosPolo: ServicioPolo[] = [];

  // Expanded rows
  expandedRows = new Set<string>();

  constructor(
    private adminEmpresaService: AdminEmpresaService,
    private authService: AuthenticationService
  ) {}
  public isDarkMode: boolean = false;

  ngOnInit(): void {
    this.loadTipos();
    this.loadEmpresaData();

    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme === 'dark';
    this.syncDarkModeWithDocument();
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');

    this.syncDarkModeWithDocument();
  }

  private syncDarkModeWithDocument(): void {
    const body = document.body;
    const html = document.documentElement;

    body.classList.toggle('dark-theme', this.isDarkMode);
    html.classList.toggle('dark-theme', this.isDarkMode);

    if (this.isDarkMode) {
      body.style.background = '#1a223b';
      body.style.margin = '0';
      body.style.padding = '0';
      html.style.background = '#1a223b';
    } else {
      body.style.background = '#f8f9fa';
      html.style.background = '#ffffff';
      body.style.margin = '';
      body.style.padding = '';
    }
  }

  isVehiculoExpanded(id: number | null | undefined): boolean {
    if (id === null || id === undefined) return false;
    return this.expandedVehiculos.has(id);
  }

  toggleVehiculoDatos(id: number | null | undefined): void {
    if (id === null || id === undefined) return;
    if (this.expandedVehiculos.has(id)) {
      this.expandedVehiculos.delete(id);
    } else {
      this.expandedVehiculos.add(id);
    }
  }

  isServicioExpanded(id: number | null | undefined): boolean {
    if (id === null || id === undefined) return false;
    return this.expandedServicios.has(id);
  }

  toggleServicioDatos(id: number | null | undefined): void {
    if (id === null || id === undefined) return;
    if (this.expandedServicios.has(id)) {
      this.expandedServicios.delete(id);
    } else {
      this.expandedServicios.add(id);
    }
  }

  getVehiculoDatosResumen(datos: any): string {
    if (!datos || !this.hasKeys(datos)) return '';

    const parts: string[] = [];

    if (
      datos.cantidad !== undefined &&
      datos.cantidad !== null &&
      datos.cantidad !== ''
    ) {
      parts.push(`Cant: ${datos.cantidad}`);
    }
    if (datos.patente) {
      parts.push(`Pat: ${datos.patente}`);
    }
    if (
      datos.carga !== undefined &&
      datos.carga !== null &&
      datos.carga !== ''
    ) {
      parts.push(`Carga: ${datos.carga}`);
    }
    if (datos.descripcion) {
      parts.push(datos.descripcion);
    }

    return parts.join(' · ') || 'Detalles';
  }

  getServicioDatosResumen(servicio: Servicio): string {
    const datos = servicio.datos || {};
    if (!this.hasKeys(datos)) return '';

    const parts: string[] = [];

    switch (servicio.id_tipo_servicio) {
      case 1:
        if (datos.biofiltro !== undefined && datos.biofiltro !== null) {
          parts.push(`Biofiltro: ${this.formatBoolean(datos.biofiltro)}`);
        }
        if (datos.tratamiento_aguas_grises) {
          parts.push(`Tratamiento: ${datos.tratamiento_aguas_grises}`);
        }
        break;
      case 2:
        if (datos.abierto !== undefined && datos.abierto !== null) {
          parts.push(`Abierto: ${this.formatBoolean(datos.abierto)}`);
        }
        if (datos.m2) {
          parts.push(`Superficie: ${datos.m2} m²`);
        }
        break;
      case 3:
        if (datos.tipo) {
          parts.push(`Tipo: ${datos.tipo}`);
        }
        if (datos.proveedor) {
          parts.push(`Proveedor: ${datos.proveedor}`);
        }
        break;
      case 4:
        if (datos.tipo) {
          parts.push(`Tipo: ${datos.tipo}`);
        }
        if (
          datos.cantidad !== undefined &&
          datos.cantidad !== null &&
          datos.cantidad !== ''
        ) {
          parts.push(`Cantidad: ${datos.cantidad}`);
        }
        break;
      default:
        if (datos.descripcion) {
          parts.push(datos.descripcion);
        }
        break;
    }

    return parts.join(' · ') || 'Detalles';
  }

  formatBoolean(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (typeof value === 'boolean') {
      return value ? 'Si' : 'No';
    }

    const normalized = `${value}`.trim().toLowerCase();
    if (['true', '1', 'si', 'si', 'yes'].includes(normalized)) {
      return 'Si';
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return 'No';
    }

    return `${value}`;
  }

  // TIPADO CORRECTO: la union de literales
  setActiveTab(tab: EmpresaMeComponent['activeTab']): void {
    this.activeTab = tab;
    this.closeAllFormsWithoutConfirmation();
    this.applyFilters();
  }

  // METODO PARA CERRAR TODOS LOS FORMULARIOS SIN CONFIRMACION
  private closeAllFormsWithoutConfirmation(): void {
    this.showPasswordForm = false;
    this.showVehiculoForm = false;
    this.showServicioForm = false;
    this.showContactoForm = false;
    this.showEmpresaEditForm = false;
    this.editingVehiculo = null;
    this.editingServicio = null;
    this.editingContacto = null;
    this.expandedVehiculos.clear();
    this.expandedServicios.clear();

    this.formErrors = {};
    this.initialForms = {};
    this.hasUnsavedChanges = {};
  }

  // ===== Control de cambios =====
  private saveInitialFormState(formName: string, formData: any): void {
    this.initialForms[formName] = JSON.parse(JSON.stringify(formData));
    this.hasUnsavedChanges[formName] = false;
  }

  private hasFormChanged(formName: string, currentFormData: any): boolean {
    if (!this.initialForms[formName]) return false;
    const initial = JSON.stringify(this.initialForms[formName]);
    const current = JSON.stringify(currentFormData);
    return initial !== current;
  }

  private checkUnsavedChanges(formName: string, currentFormData: any): boolean {
    return this.hasFormChanged(formName, currentFormData);
  }

  private restoreOriginalFormData(formName: string): void {
    if (!this.initialForms[formName]) return;
    const originalData = JSON.parse(
      JSON.stringify(this.initialForms[formName])
    );
    switch (formName) {
      case 'vehiculo':
        this.vehiculoForm = {
          id_tipo_vehiculo: originalData.id_tipo_vehiculo,
          horarios: originalData.horarios,
          frecuencia: originalData.frecuencia,
          datos: { ...originalData.datos },
        };
        break;
      case 'servicio':
        this.servicioForm = {
          id_tipo_servicio: originalData.id_tipo_servicio,
          datos: { ...originalData.datos },
        };
        break;
      case 'contacto':
        this.contactoForm = {
          id_tipo_contacto: originalData.id_tipo_contacto,
          nombre: originalData.nombre,
          telefono: originalData.telefono,
          direccion: originalData.direccion,
          id_servicio_polo: originalData.id_servicio_polo,
          datos: { ...originalData.datos },
        };
        break;
      case 'empresa':
        this.empresaEditForm = {
          cant_empleados: originalData.cant_empleados,
          observaciones: originalData.observaciones,
          horario_trabajo: originalData.horario_trabajo,
        };
        break;
      case 'password':
        this.passwordForm = {
          password: originalData.password,
          confirmPassword: originalData.confirmPassword,
        };
        break;
    }
  }

  // ===== Metricas y actividad =====
  get vehiculosActivos(): number {
    return this.empresaData?.vehiculos?.length ?? 0;
  }
  get totalServicios(): number {
    return this.empresaData?.servicios?.length ?? 0;
  }
  get totalContactos(): number {
    return this.empresaData?.contactos?.length ?? 0;
  }
  get estaActiva(): boolean {
    return !!this.empresaData;
  }
  get desdeIngreso(): string {
    return this.formatMonthYear(this.empresaData?.fecha_ingreso);
  }

  actividadReciente: Array<{
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string; // HH:mm o "-" si no hay timestamp
  }> = [];
  private manualActivities: Array<{
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string;
    timestamp: number;
  }> = [];
  private lastBuiltActivities: Array<{
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string;
    timestamp: number;
  }> = [];
  private readonly MANUAL_ACTIVITY_TTL_MS = 5 * 60 * 1000;

  // ——— Helper para “actividad reciente”
  private addActividad(
    tipo: 'ok' | 'warn' | 'info',
    titulo: string,
    cuando = this.formatActivityMoment(new Date().toISOString())
  ) {
    const record = {
      tipo,
      titulo,
      cuando,
      timestamp: Date.now(),
    };
    this.manualActivities.unshift(record);
    this.pruneManualActivities();
    this.combineActivities(this.lastBuiltActivities);
  }

  // ====== ACTIVIDAD EN TIEMPO REAL ======
  private pushActivity(
    tipo: 'ok' | 'warn' | 'info',
    titulo: string,
    cuando: string = this.formatActivityMoment(new Date().toISOString())
  ): void {
    const record = {
      tipo,
      titulo,
      cuando,
      timestamp: Date.now(),
    };
    this.manualActivities.unshift(record);
    this.pruneManualActivities();
    this.combineActivities(this.lastBuiltActivities);
  }

  /** reconstruye actividad desde los datos existentes */
  private buildActividadRecienteFromData(): void {
    const actividades: Array<{
      tipo: 'ok' | 'warn' | 'info';
      titulo: string;
      cuando: string;
      timestamp: number;
    }> = [];
    const fallbackBase = new Date();
    let fallbackSteps = 0;
    const nextFallbackIso = () => {
      const iso = new Date(
        fallbackBase.getTime() - fallbackSteps * 60000
      ).toISOString();
      fallbackSteps += 1;
      return iso;
    };

    const pushActividad = (
      tipo: 'ok' | 'warn' | 'info',
      titulo: string,
      item: any
    ) => {
      const raw = this.getItemDateSource(item);
      const chosenIso = raw ?? nextFallbackIso();
      actividades.push({
        tipo,
        titulo,
        cuando: this.formatActivityMoment(chosenIso),
        timestamp:
          raw !== null && raw !== undefined
            ? this.getItemTimestamp(item)
            : new Date(chosenIso).getTime(),
      });
    };

    [...(this.empresaData?.vehiculos ?? [])]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 3)
      .forEach((vehiculo) =>
        pushActividad(
          'ok',
          `Vehiculo ${this.getTipoVehiculoName(
            vehiculo.id_tipo_vehiculo
          )} actualizado`,
          vehiculo
        )
      );

    [...(this.empresaData?.servicios ?? [])]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 3)
      .forEach((servicio) =>
        pushActividad(
          'info',
          `Servicio ${this.getTipoServicioName(
            servicio.id_tipo_servicio
          )} actualizado`,
          servicio
        )
      );

    [...(this.empresaData?.contactos ?? [])]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 3)
      .forEach((contacto) =>
        pushActividad('ok', `Contacto ${contacto.nombre} actualizado`, contacto)
      );

    this.actividadReciente = actividades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_ACTIVIDADES)
      .map(({ timestamp, ...rest }) => ({
        ...rest,
        cuando: rest.cuando || '-',
      }));
    this.lastBuiltActivities = actividades;
    this.combineActivities(actividades);
  }

  private getItemDateSource(item: any): string | null {
    if (!item) return null;
    const candidates = [
      item.updated_at,
      item.created_at,
      item.fecha,
      item.fecha_registro,
      item.fecha_alta,
      item.fecha_actualizacion,
      item.fecha_creacion,
    ];
    for (const candidate of candidates) {
      if (
        candidate !== null &&
        candidate !== undefined &&
        String(candidate).trim() !== ''
      ) {
        return String(candidate);
      }
    }
    return null;
  }

  private getItemTimestamp(item: any): number {
    const raw = this.getItemDateSource(item);
    if (!raw) return 0;
    const date = new Date(raw);
    const value = date.getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  private formatActivityMoment(raw?: string): string {
    if (!raw) return '-';
    try {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return '-';
      }

      const timeZone = 'America/Argentina/Buenos_Aires';
      const dateFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const trimmed = String(raw).trim();
      const isDateOnly =
        /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
        /^\d{4}-\d{2}-\d{2}T00:00(?::00)?(?:\.000)?(?:Z)?$/.test(trimmed);

      return isDateOnly
        ? dateFormatter.format(date)
        : dateTimeFormatter.format(date);
    } catch {
      return '-';
    }
  }

  private findVehiculoById(id: number): Vehiculo | undefined {
    return (
      this.empresaData?.vehiculos?.find((v) => v.id_vehiculo === id) ??
      this.filteredVehiculos.find((v) => v.id_vehiculo === id)
    );
  }

  private findServicioById(id: number): Servicio | undefined {
    return (
      this.empresaData?.servicios?.find((s) => s.id_servicio === id) ??
      this.filteredServicios.find((s) => s.id_servicio === id)
    );
  }

  private findContactoById(id: number): Contacto | undefined {
    return (
      this.empresaData?.contactos?.find((c) => c.id_contacto === id) ??
      this.filteredContactos.find((c) => c.id_contacto === id)
    );
  }

  private describeVehiculo(
    source?: { id_tipo_vehiculo?: number; datos?: any } | null
  ): string {
    const tipoNombre =
      source?.id_tipo_vehiculo !== undefined &&
      source?.id_tipo_vehiculo !== null
        ? this.getTipoVehiculoName(source.id_tipo_vehiculo)
        : '';
    const base = tipoNombre ? `Vehiculo ${tipoNombre}` : 'Vehiculo';
    const datos = source?.datos || {};

    const patente =
      typeof datos.patente === 'string' && datos.patente.trim()
        ? datos.patente.trim()
        : '';
    if (patente) {
      return `${base} ${patente}`;
    }

    const cantidad =
      datos.cantidad !== undefined && datos.cantidad !== null
        ? Number(datos.cantidad)
        : NaN;
    if (!Number.isNaN(cantidad) && cantidad > 0) {
      return `${base} x${cantidad}`;
    }

    const descripcion =
      typeof datos.descripcion === 'string' && datos.descripcion.trim()
        ? datos.descripcion.trim()
        : '';
    if (descripcion) {
      return `${base} ${descripcion}`;
    }

    return base;
  }

  private describeServicio(
    source?: {
      id_tipo_servicio?: number;
      tipo_servicio?: string;
      datos?: any;
    } | null
  ): string {
    const tipoNombreRaw =
      typeof source?.tipo_servicio === 'string' && source.tipo_servicio.trim()
        ? source.tipo_servicio.trim()
        : source?.id_tipo_servicio !== undefined &&
          source?.id_tipo_servicio !== null
        ? this.getTipoServicioName(source.id_tipo_servicio)
        : '';
    const base = tipoNombreRaw ? `Servicio ${tipoNombreRaw}` : 'Servicio';
    const datos = source?.datos || {};

    const fields = ['nombre', 'tipo', 'descripcion'];
    for (const key of fields) {
      const value = datos[key];
      if (typeof value === 'string' && value.trim()) {
        return `${base} ${value.trim()}`;
      }
    }

    return base;
  }

  private describeContacto(
    source?: {
      nombre?: string;
      telefono?: string;
      id_tipo_contacto?: number;
    } | null
  ): string {
    if (source?.nombre && source.nombre.trim()) {
      return source.nombre.trim();
    }

    const tipoNombre =
      source?.id_tipo_contacto !== undefined &&
      source?.id_tipo_contacto !== null
        ? this.getTipoContactoName(source.id_tipo_contacto)
        : 'Contacto';

    const telefono =
      typeof source?.telefono === 'string' && source.telefono.trim()
        ? source.telefono.trim()
        : '';

    return telefono ? `${tipoNombre} ${telefono}` : tipoNombre;
  }

  private pruneManualActivities(): void {
    const cutoff = Date.now() - this.MANUAL_ACTIVITY_TTL_MS;
    this.manualActivities = this.manualActivities
      .filter((entry) => entry.timestamp >= cutoff)
      .slice(0, this.MAX_ACTIVIDADES);
  }

  private combineActivities(
    dataActivities: Array<{
      tipo: 'ok' | 'warn' | 'info';
      titulo: string;
      cuando: string;
      timestamp: number;
    }>
  ): void {
    this.pruneManualActivities();
    const final: Array<{
      tipo: 'ok' | 'warn' | 'info';
      titulo: string;
      cuando: string;
      timestamp: number;
    }> = [];

    const seen = new Map<string, number>();
    const keyFor = (entry: { tipo: 'ok' | 'warn' | 'info'; titulo: string }) =>
      `${entry.tipo}::${entry.titulo}`;

    const sortedManual = [...this.manualActivities].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    for (const entry of sortedManual) {
      const key = keyFor(entry);
      if (!seen.has(key)) {
        final.push(entry);
        seen.set(key, entry.timestamp);
      }
    }

    const sortedData = [...dataActivities].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    for (const entry of sortedData) {
      const key = keyFor(entry);
      if (!seen.has(key)) {
        final.push(entry);
        seen.set(key, entry.timestamp);
      } else {
        const existingTs = seen.get(key) ?? 0;
        if (entry.timestamp > existingTs) {
          const index = final.findIndex((item) => keyFor(item) === key);
          if (index !== -1) {
            final[index] = entry;
            seen.set(key, entry.timestamp);
          }
        }
      }
    }

    const trimmed = final
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_ACTIVIDADES);

    this.actividadReciente = trimmed.map(({ tipo, titulo, cuando }) => ({
      tipo,
      titulo,
      cuando,
    }));
    this.manualActivities = this.manualActivities.slice(
      0,
      this.MAX_ACTIVIDADES
    );
  }

  // ===== Cancelacion de formularios =====
  cancelForm(formName: string): void {
    let currentFormData: any;
    switch (formName) {
      case 'vehiculo':
        currentFormData = this.vehiculoForm;
        break;
      case 'servicio':
        currentFormData = this.servicioForm;
        break;
      case 'contacto':
        currentFormData = this.contactoForm;
        break;
      case 'empresa':
        currentFormData = this.empresaEditForm;
        break;
      case 'password':
        currentFormData = this.passwordForm;
        break;
      default:
        return;
    }
    const hasChanges = this.checkUnsavedChanges(formName, currentFormData);
    if (hasChanges) {
      const shouldDiscard = confirm(
        '¿Deseas descartar los cambios?\n\nSe perderan todos los cambios no guardados.'
      );
      if (!shouldDiscard) return;
      this.restoreOriginalFormData(formName);
    }
    this.closeFormWithoutConfirmation(formName);
  }

  private closeFormWithoutConfirmation(formName: string): void {
    switch (formName) {
      case 'vehiculo':
        this.showVehiculoForm = false;
        this.editingVehiculo = null;
        break;
      case 'servicio':
        this.showServicioForm = false;
        this.editingServicio = null;
        break;
      case 'contacto':
        this.showContactoForm = false;
        this.editingContacto = null;
        break;
      case 'empresa':
        this.showEmpresaEditForm = false;
        break;
      case 'password':
        this.showPasswordForm = false;
        break;
    }
    this.clearFormErrors(formName);
    delete this.initialForms[formName];
    delete this.hasUnsavedChanges[formName];
  }

  closeFormDirectly(formName: string): void {
    this.cancelForm(formName);
  }

  // ===== Filtros =====
  applyFilters(): void {
    switch (this.activeTab) {
      case 'dashboard':
        this.buildActividadRecienteFromData();
        break;
      case 'vehiculos':
        this.filterVehiculos();
        break;
      case 'servicios':
        this.filterServicios();
        break;
      case 'contactos':
        this.filterContactos();
        break;
      case 'serviciosPolo':
        this.filterServiciosPolo();
        break;
    }
  }

  filterVehiculos(): void {
    if (!this.empresaData?.vehiculos) {
      this.filteredVehiculos = [];
      return;
    }
    if (!this.vehiculoSearchTerm.trim()) {
      this.filteredVehiculos = [...this.empresaData.vehiculos];
      return;
    }
    const term = this.vehiculoSearchTerm.toLowerCase().trim();
    this.filteredVehiculos = this.empresaData.vehiculos.filter(
      (vehiculo) =>
        this.getTipoVehiculoName(vehiculo.id_tipo_vehiculo)
          .toLowerCase()
          .includes(term) ||
        vehiculo.horarios.toLowerCase().includes(term) ||
        vehiculo.frecuencia.toLowerCase().includes(term) ||
        (vehiculo.datos.patente &&
          vehiculo.datos.patente.toLowerCase().includes(term)) ||
        (vehiculo.datos.carga &&
          vehiculo.datos.carga.toLowerCase().includes(term))
    );
  }

  clearVehiculoSearch(): void {
    this.vehiculoSearchTerm = '';
    this.filteredVehiculos = this.empresaData?.vehiculos
      ? [...this.empresaData.vehiculos]
      : [];
  }

  filterServicios(): void {
    if (!this.empresaData?.servicios) {
      this.filteredServicios = [];
      return;
    }
    if (!this.servicioSearchTerm.trim()) {
      this.filteredServicios = [...this.empresaData.servicios];
      return;
    }
    const term = this.servicioSearchTerm.toLowerCase().trim();
    this.filteredServicios = this.empresaData.servicios.filter(
      (servicio) =>
        this.getTipoServicioName(servicio.id_tipo_servicio)
          .toLowerCase()
          .includes(term) ||
        JSON.stringify(servicio.datos).toLowerCase().includes(term)
    );
  }

  clearServicioSearch(): void {
    this.servicioSearchTerm = '';
    this.filteredServicios = this.empresaData?.servicios
      ? [...this.empresaData.servicios]
      : [];
  }

  filterContactos(): void {
    if (!this.empresaData?.contactos) {
      this.filteredContactos = [];
      return;
    }
    if (!this.contactoSearchTerm.trim()) {
      this.filteredContactos = [...this.empresaData.contactos];
      return;
    }
    const term = this.contactoSearchTerm.toLowerCase().trim();
    this.filteredContactos = this.empresaData.contactos.filter(
      (contacto) =>
        contacto.nombre.toLowerCase().includes(term) ||
        this.getTipoContactoName(contacto.id_tipo_contacto)
          .toLowerCase()
          .includes(term) ||
        (contacto.telefono && contacto.telefono.toLowerCase().includes(term)) ||
        (contacto.direccion &&
          contacto.direccion.toLowerCase().includes(term)) ||
        (contacto.datos?.correo &&
          contacto.datos.correo.toLowerCase().includes(term)) ||
        (contacto.datos?.pagina_web &&
          contacto.datos.pagina_web.toLowerCase().includes(term))
    );
  }

  clearContactoSearch(): void {
    this.contactoSearchTerm = '';
    this.filteredContactos = this.empresaData?.contactos
      ? [...this.empresaData.contactos]
      : [];
  }

  filterServiciosPolo(): void {
    if (!this.empresaData?.servicios_polo) {
      this.filteredServiciosPolo = [];
      return;
    }
    if (!this.servicioPoloSearchTerm.trim()) {
      this.filteredServiciosPolo = [...this.empresaData.servicios_polo];
      return;
    }
    const term = this.servicioPoloSearchTerm.toLowerCase().trim();
    this.filteredServiciosPolo = this.empresaData.servicios_polo.filter(
      (servicio) =>
        (servicio.nombre && servicio.nombre.toLowerCase().includes(term)) ||
        this.getTipoServicioPoloName(servicio.id_tipo_servicio_polo)
          .toLowerCase()
          .includes(term) ||
        (servicio.horario && servicio.horario.toLowerCase().includes(term)) ||
        (servicio.propietario &&
          servicio.propietario.toLowerCase().includes(term))
    );
  }

  clearServicioPoloSearch(): void {
    this.servicioPoloSearchTerm = '';
    this.filteredServiciosPolo = this.empresaData?.servicios_polo
      ? [...this.empresaData.servicios_polo]
      : [];
  }

  // ===== Errores =====
  clearFormErrors(formName: string): void {
    this.formErrors[formName] = [];
  }
  getFieldErrors(formName: string, fieldName: string): FormError[] {
    const errors = this.formErrors[formName] || [];
    return errors.filter((error) => error.field === fieldName);
  }
  hasFieldError(formName: string, fieldName: string): boolean {
    return this.getFieldErrors(formName, fieldName).length > 0;
  }

  private handleError(error: any, formName: string, operation: string): void {
    console.error(`Error en ${operation}:`, error);
    this.clearFormErrors(formName);
    let errorMessages: FormError[] = [];

    if (error.status === 0) {
      errorMessages.push({
        field: 'general',
        message: 'Error de conexion. Verifique su conexion a internet.',
        type: 'server',
      });
    } else if (error.status === 401) {
      errorMessages.push({
        field: 'general',
        message: 'Sesion expirada. Por favor, inicie sesion nuevamente.',
        type: 'server',
      });
    } else if (error.status === 403) {
      errorMessages.push({
        field: 'general',
        message: 'No tiene permisos para realizar esta accion.',
        type: 'server',
      });
    } else if (error.status === 404) {
      errorMessages.push({
        field: 'general',
        message: 'El recurso solicitado no fue encontrado.',
        type: 'server',
      });
    } else if (error.status === 422) {
      const errorResponse: ErrorResponse = error.error;
      if (errorResponse.errors) {
        Object.keys(errorResponse.errors).forEach((field) => {
          const fieldErrors = errorResponse.errors![field];
          fieldErrors.forEach((message) => {
            errorMessages.push({
              field: field,
              message: this.translateFieldError(field, message, formName),
              type: 'validation',
            });
          });
        });
      } else if (errorResponse.detail) {
        errorMessages.push({
          field: 'general',
          message: this.translateGenericError(errorResponse.detail, formName),
          type: 'validation',
        });
      }
    } else if (error.status === 400) {
      const errorDetail = error.error?.detail || 'Datos invalidos';
      errorMessages.push({
        field: 'general',
        message: this.translateGenericError(errorDetail, formName),
        type: 'validation',
      });
    } else if (error.status === 500) {
      errorMessages.push({
        field: 'general',
        message: 'Error interno del servidor. Intente mas tarde.',
        type: 'server',
      });
    } else {
      const detail =
        error.error?.detail || error.message || 'Error desconocido';
      errorMessages.push({
        field: 'general',
        message: this.translateGenericError(detail, formName),
        type: 'server',
      });
    }

    this.formErrors[formName] = errorMessages;

    const generalError = errorMessages.find((e) => e.field === 'general');
    if (generalError) {
      this.showMessage(generalError.message, 'error');
    } else {
      this.showMessage(
        `Error en ${operation}. Revise los campos marcados.`,
        'error'
      );
    }
  }

  private translateFieldError(
    field: string,
    message: string,
    formName: string
  ): string {
    const translations: { [key: string]: { [key: string]: string } } = {
      vehiculo: {
        id_tipo_vehiculo: 'El tipo de vehiculo es requerido',
        horarios: 'Los horarios son requeridos (formato: HH:MM - HH:MM)',
        frecuencia: 'La frecuencia es requerida',
        'datos.cantidad': 'La cantidad debe ser mayor a 0',
        'datos.patente':
          'La patente debe tener formato valido (ABC123 o AB123CD)',
        'datos.carga': 'Seleccione un tipo de carga valido',
        'datos.m2': 'Los metros cuadrados deben ser mayor a 0',
      },
      servicio: {
        id_tipo_servicio: 'El tipo de servicio es requerido',
        'datos.biofiltro': 'Debe especificar si tiene biofiltro',
        'datos.tratamiento_aguas_grises':
          'Debe especificar el tratamiento de aguas grises',
        'datos.abierto': 'Debe especificar si esta abierto al publico',
        'datos.m2': 'Los metros cuadrados son requeridos y deben ser mayor a 0',
        'datos.tipo': 'El tipo es requerido',
        'datos.proveedor': 'El proveedor es requerido',
        'datos.cantidad': 'La cantidad es requerida y debe ser mayor a 0',
      },
      contacto: {
        nombre: 'El nombre es requerido (minimo 2 caracteres)',
        id_tipo_contacto: 'El tipo de contacto es requerido',
        telefono: 'El telefono debe tener formato valido',
        direccion: 'La direccion es requerida para contactos comerciales',
        id_servicio_polo: 'El ID del servicio polo es requerido',
        'datos.pagina_web':
          'La pagina web debe tener formato valido (https://)',
        'datos.correo': 'El correo debe tener formato valido',
        'datos.redes_sociales':
          'Las redes sociales son requeridas para contactos comerciales',
      },
      empresa: {
        cant_empleados: 'La cantidad de empleados debe ser mayor a 0',
        horario_trabajo: 'El horario de trabajo es requerido',
        observaciones: 'Las observaciones no pueden exceder 500 caracteres',
      },
      password: {
        password: 'La contrasena debe tener al menos 6 caracteres',
        email: 'El email no fue encontrado en el sistema',
      },
    };

    const formTranslations = translations[formName];
    if (formTranslations && formTranslations[field]) {
      return formTranslations[field];
    }

    const genericTranslations: { [key: string]: string } = {
      required: 'Este campo es requerido',
      invalid: 'El formato de este campo es invalido',
      min_length: 'Este campo es muy corto',
      max_length: 'Este campo es muy largo',
      email: 'El formato del email es invalido',
      url: 'El formato de la URL es invalido',
      number: 'Debe ser un numero valido',
    };

    return genericTranslations[message] || message;
  }

  private translateGenericError(detail: string, formName: string): string {
    const translations: { [key: string]: string } = {
      'Ya existe un vehiculo con esa patente':
        'Ya existe un vehiculo registrado con esa patente',
      'Ya existe un contacto con ese nombre':
        'Ya existe un contacto registrado con ese nombre',
      'Usuario no encontrado': 'Usuario no encontrado en el sistema',
      'Email no registrado': 'El email no esta registrado en el sistema',
      'Credenciales invalidas': 'Usuario o contrasena incorrectos',
      'Token invalido':
        'La sesion ha expirado, por favor inicie sesion nuevamente',
      'Servicio no encontrado': 'El servicio solicitado no existe',
      'Vehiculo no encontrado': 'El vehiculo solicitado no existe',
      'Contacto no encontrado': 'El contacto solicitado no existe',
      'Empresa no encontrada': 'La empresa no fue encontrada',
      'Rol invalido': 'El rol especificado no es valido',
      'Acceso denegado': 'No tiene permisos para realizar esta accion',
      'Datos invalidos': 'Los datos enviados contienen errores',
    };
    return translations[detail] || detail;
  }

  // ===== Carga de datos =====
  loadEmpresaData(): void {
    this.loading = true;
    this.clearFormErrors('general');

    this.adminEmpresaService.getMyCompanyDetails().subscribe({
      next: (data) => {
        this.empresaData = data;
        this.empresaEditForm = {
          cant_empleados: data.cant_empleados,
          observaciones: data.observaciones || '',
          horario_trabajo: data.horario_trabajo,
        };

        this.filteredVehiculos = [...(data.vehiculos || [])];
        this.filteredServicios = [...(data.servicios || [])];
        this.filteredContactos = [...(data.contactos || [])];
        this.filteredServiciosPolo = [...(data.servicios_polo || [])];

        this.expandedVehiculos.clear();
        this.expandedServicios.clear();

        this.buildActividadRecienteFromData();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar datos de la empresa');
        this.loading = false;
      },
    });
  }

  // accesos rapidos
  goTo(tab: EmpresaMeComponent['activeTab']) {
    this.setActiveTab(tab);
  }
  quickAddVehiculo() {
    this.setActiveTab('vehiculos');
    this.openVehiculoForm();
  }
  quickAddServicio() {
    this.setActiveTab('servicios');
    this.openServicioForm();
  }
  quickAddContacto() {
    this.setActiveTab('contactos');
    this.openContactoForm();
  }

  // ===== Reset de formularios =====
  resetForms(): void {
    this.showPasswordForm = false;
    this.showVehiculoForm = false;
    this.showServicioForm = false;
    this.showContactoForm = false;
    this.showEmpresaEditForm = false;
    this.editingVehiculo = null;
    this.editingServicio = null;
    this.editingContacto = null;
    this.expandedVehiculos.clear();
    this.expandedServicios.clear();

    this.formErrors = {};

    this.passwordForm = { password: '', confirmPassword: '' };
    this.vehiculoForm = {
      id_tipo_vehiculo: 1,
      horarios: '',
      frecuencia: '',
      datos: {},
    };
    this.servicioForm = { datos: {}, id_tipo_servicio: 1 };
    this.contactoForm = {
      id_tipo_contacto: 1,
      nombre: '',
      telefono: '',
      datos: {
        pagina_web: '',
        correo: '',
        redes_sociales: '',
      },
      direccion: '',
      id_servicio_polo: 1,
    };

    this.initialForms = {};
    this.hasUnsavedChanges = {};
  }

  showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
    }, 5000);
  }

  // ===== Password modal (coincide con la plantilla) =====
  openPasswordModal() {
    this.showPasswordModal = true;
  }
  onPasswordModalClosed() {
    this.showPasswordModal = false;
  }
  onPasswordChanged(success: boolean) {
    if (success) {
      this.addActividad('info', 'Contrasena cambiada');
    }
  }

  // EMPRESA EDIT
  openEmpresaEditForm(): void {
    this.clearFormErrors('empresa');
    this.showEmpresaEditForm = true;
    setTimeout(() => {
      this.saveInitialFormState('empresa', this.empresaEditForm);
    }, 0);
  }

  onSubmitEmpresaEdit(): void {
    this.loading = true;
    this.clearFormErrors('empresa');

    this.adminEmpresaService.updateMyCompany(this.empresaEditForm).subscribe({
      next: () => {
        this.showMessage(
          'Datos de empresa actualizados exitosamente',
          'success'
        );
        this.pushActivity('info', 'Datos de empresa actualizados');
        this.loadEmpresaData();
        this.resetForms();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'empresa', 'actualizar datos de empresa');
        this.loading = false;
      },
    });
  }

  // ===== Vehiculos =====
  openVehiculoForm(vehiculo?: Vehiculo): void {
    this.clearFormErrors('vehiculo');

    if (vehiculo) {
      this.editingVehiculo = vehiculo;
      this.vehiculoForm = {
        id_tipo_vehiculo: vehiculo.id_tipo_vehiculo,
        horarios: vehiculo.horarios,
        frecuencia: vehiculo.frecuencia,
        datos: { ...vehiculo.datos },
      };
    } else {
      this.editingVehiculo = null;
      this.vehiculoForm = {
        id_tipo_vehiculo: 1,
        horarios: '',
        frecuencia: '',
        datos: {},
      };
    }

    this.onVehiculoTipoChange();
    this.showVehiculoForm = true;
    setTimeout(() => {
      this.saveInitialFormState('vehiculo', this.vehiculoForm);
    }, 0);
  }

  onSubmitVehiculo(): void {
    this.loading = true;
    this.clearFormErrors('vehiculo');

    if (this.editingVehiculo) {
      this.adminEmpresaService
        .updateVehiculo(this.editingVehiculo.id_vehiculo, this.vehiculoForm)
        .subscribe({
          next: () => {
            this.showMessage('Vehiculo actualizado exitosamente', 'success');
            const label = this.describeVehiculo({
              id_tipo_vehiculo: this.vehiculoForm.id_tipo_vehiculo,
              datos: this.vehiculoForm.datos,
            });
            this.pushActivity('ok', label + ' actualizado');

            this.loadEmpresaData();
            this.resetForms();
            this.loading = false;
          },
          error: (error) => {
            this.handleError(error, 'vehiculo', 'actualizar vehiculo');
            this.loading = false;
          },
        });
    } else {
      this.adminEmpresaService.createVehiculo(this.vehiculoForm).subscribe({
        next: () => {
          this.showMessage('Vehiculo creado exitosamente', 'success');
          const label = this.describeVehiculo({
            id_tipo_vehiculo: this.vehiculoForm.id_tipo_vehiculo,
            datos: this.vehiculoForm.datos,
          });
          this.pushActivity('ok', label + ' agregado');

          this.loadEmpresaData();
          this.resetForms();
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error, 'vehiculo', 'crear vehiculo');
          this.loading = false;
        },
      });
    }
  }

  deleteVehiculo(id: number): void {
    if (!confirm('Estas seguro de que deseas eliminar este vehiculo?')) {
      return;
    }

    const vehiculo = this.findVehiculoById(id);
    const label = this.describeVehiculo(vehiculo);

    this.adminEmpresaService.deleteVehiculo(id).subscribe({
      next: () => {
        this.showMessage('Vehiculo eliminado exitosamente', 'success');
        this.pushActivity('warn', label + ' eliminado');
        this.loadEmpresaData();
      },
      error: (error) => {
        this.handleError(error, 'general', 'eliminar vehiculo');
      },
    });
  }

  // ===== Servicios =====
  openServicioForm(servicio?: Servicio): void {
    this.clearFormErrors('servicio');

    if (servicio) {
      this.editingServicio = servicio;
      this.servicioForm = {
        id_tipo_servicio: servicio.id_tipo_servicio,
        datos: { ...servicio.datos },
      };
    } else {
      this.editingServicio = null;
      this.servicioForm = {
        id_tipo_servicio: 1,
        datos: {},
      };
    }

    this.onTipoServicioChange();

    if (this.editingServicio) {
      this.servicioForm.datos = { ...servicio!.datos };
    }

    this.showServicioForm = true;
    setTimeout(() => {
      this.saveInitialFormState('servicio', this.servicioForm);
    }, 0);
  }

  onSubmitServicio(): void {
    this.loading = true;
    this.clearFormErrors('servicio');

    if (this.editingServicio) {
      const sid = this.editingServicio.id_servicio;

      const updateData: ServicioUpdate = {
        datos: this.servicioForm.datos,
        id_tipo_servicio: this.servicioForm.id_tipo_servicio,
      };

      this.adminEmpresaService.updateServicio(sid, updateData).subscribe({
        next: () => {
          this.showMessage('Servicio actualizado exitosamente', 'success');
          const servicioLabel = this.describeServicio({
            id_tipo_servicio: updateData.id_tipo_servicio,
            datos: updateData.datos,
          });
          this.pushActivity('ok', servicioLabel + ' actualizado');
          this.loadEmpresaData();
          this.resetForms();
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error, 'servicio', 'actualizar servicio');
          this.loading = false;
        },
      });
    } else {
      this.adminEmpresaService.createServicio(this.servicioForm).subscribe({
        next: () => {
          this.showMessage('Servicio creado exitosamente', 'success');
          const servicioLabel = this.describeServicio({
            id_tipo_servicio: this.servicioForm.id_tipo_servicio,
            datos: this.servicioForm.datos,
          });
          this.pushActivity('ok', servicioLabel + ' agregado');

          this.loadEmpresaData();
          this.resetForms();
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error, 'servicio', 'crear servicio');
          this.loading = false;
        },
      });
    }
  }

  deleteServicio(id: number): void {
    if (!confirm('Estas seguro de que deseas eliminar este servicio?')) {
      return;
    }

    const servicio = this.findServicioById(id);
    const label = this.describeServicio(servicio);

    this.adminEmpresaService.deleteServicio(id).subscribe({
      next: () => {
        this.showMessage('Servicio eliminado exitosamente', 'success');
        this.pushActivity('warn', label + ' eliminado');
        this.loadEmpresaData();
      },
      error: (error) => {
        this.handleError(error, 'general', 'eliminar servicio');
      },
    });
  }

  onTipoServicioChange(): void {
    this.servicioForm.datos = {};

    switch (this.servicioForm.id_tipo_servicio) {
      case 1:
        this.servicioForm.datos = {
          biofiltro: '',
          tratamiento_aguas_grises: '',
        };
        break;
      case 2:
        this.servicioForm.datos = {
          abierto: '',
          m2: null,
        };
        break;
      case 3:
        this.servicioForm.datos = {
          tipo: '',
          proveedor: '',
        };
        break;
      case 4:
        this.servicioForm.datos = {
          tipo: '',
          cantidad: null,
        };
        break;
      default:
        this.servicioForm.datos = {};
    }
  }

  // ===== Contactos =====
  openContactoForm(contacto?: Contacto): void {
    this.clearFormErrors('contacto');

    if (contacto) {
      this.editingContacto = contacto;
      this.contactoForm = {
        id_tipo_contacto: contacto.id_tipo_contacto,
        nombre: contacto.nombre,
        telefono: contacto.telefono || '',
        datos: contacto.datos
          ? { ...contacto.datos }
          : {
              pagina_web: '',
              correo: '',
              redes_sociales: '',
              direccion: '',
            },
        direccion: contacto.direccion || '',
        id_servicio_polo: contacto.id_servicio_polo,
      };
    } else {
      this.editingContacto = null;
      this.contactoForm = {
        id_tipo_contacto: 1,
        nombre: '',
        telefono: '',
        datos: {
          pagina_web: '',
          correo: '',
          redes_sociales: '',
          direccion: '',
        },
        direccion: '',
        id_servicio_polo: 1,
      };
    }

    this.showContactoForm = true;
    this.onTipoContactoChange();
    setTimeout(() => {
      this.saveInitialFormState('contacto', this.contactoForm);
    }, 0);
  }

  onTipoContactoChange(): void {
    const tipo = Number(this.contactoForm.id_tipo_contacto);

    if (tipo === 1) {
      this.contactoForm.datos = {
        pagina_web: this.contactoForm.datos.pagina_web || '',
        correo: this.contactoForm.datos.correo || '',
        redes_sociales: this.contactoForm.datos.redes_sociales || '',
        direccion:
          this.contactoForm.direccion ||
          this.contactoForm.datos.direccion ||
          '',
      };
    } else {
      this.contactoForm.datos = {};
    }
  }

  onSubmitContacto(): void {
    this.loading = true;
    this.clearFormErrors('contacto');

    if (this.esTipoComercial()) {
      if (this.contactoForm.direccion) {
        this.contactoForm.datos.direccion = this.contactoForm.direccion;
      } else if (this.contactoForm.datos.direccion) {
        this.contactoForm.direccion = this.contactoForm.datos.direccion;
      }

      if (
        !this.contactoForm.datos.direccion ||
        this.contactoForm.datos.direccion.trim() === ''
      ) {
        this.formErrors['contacto'] = [
          {
            field: 'direccion',
            message: 'La direccion es requerida para contactos comerciales',
            type: 'required',
          },
        ];
        this.showMessage(
          'La direccion es requerida para contactos comerciales',
          'error'
        );
        this.loading = false;
        return;
      }
    }

    if (this.editingContacto) {
      this.adminEmpresaService
        .updateContacto(this.editingContacto.id_contacto, this.contactoForm)
        .subscribe({
          next: () => {
            this.showMessage('Contacto actualizado exitosamente', 'success');
            const contactoLabel = this.describeContacto(this.contactoForm);
            this.pushActivity('ok', contactoLabel + ' actualizado');

            this.loadEmpresaData();
            this.resetForms();
            this.loading = false;
          },
          error: (error) => {
            this.handleError(error, 'contacto', 'actualizar contacto');
            this.loading = false;
          },
        });
    } else {
      this.adminEmpresaService.createContacto(this.contactoForm).subscribe({
        next: () => {
          this.showMessage('Contacto creado exitosamente', 'success');
          const contactoLabel = this.describeContacto(this.contactoForm);
          this.pushActivity('ok', contactoLabel + ' agregado');

          this.loadEmpresaData();
          this.resetForms();
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error, 'contacto', 'crear contacto');
          this.loading = false;
        },
      });
    }
  }

  onDireccionChange(): void {
    if (this.esTipoComercial()) {
      this.contactoForm.datos.direccion = this.contactoForm.direccion;
    }
  }

  deleteContacto(id: number): void {
    if (!confirm('Estas seguro de que deseas eliminar este contacto?')) {
      return;
    }

    const contacto = this.findContactoById(id);
    const contactoLabel = this.describeContacto(contacto);

    this.adminEmpresaService.deleteContacto(id).subscribe({
      next: () => {
        this.showMessage('Contacto eliminado exitosamente', 'success');
        this.pushActivity('warn', contactoLabel + ' eliminado');
        this.loadEmpresaData();
      },
      error: (error) => {
        this.handleError(error, 'general', 'eliminar contacto');
      },
    });
  }

  esTipoComercial(): boolean {
    return this.contactoForm.id_tipo_contacto === 1;
  }

  // ===== Helpers de tipos/estado/fechas =====
  getTipoServicioPoloName(id: number): string {
    const tipo = this.tiposServicioPolo.find(
      (t) => t.id_tipo_servicio_polo === id
    );
    return tipo ? tipo.tipo : 'Sin tipo definido';
  }

  get tieneServiciosPolo(): boolean {
    return (
      Array.isArray(this.empresaData?.servicios_polo) &&
      this.empresaData.servicios_polo.length > 0
    );
  }

  getStatusClass(activo: boolean): string {
    return activo ? 'status-active' : 'status-inactive';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      return 'Fecha invalida';
    }
  }

  // HH:mm para actividad en vivo
  private formatTime(d: Date): string {
    try {
      return d.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  // usado por el HTML y por el getter desdeIngreso
  formatMonthYear(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('es-AR', {
        month: 'long',
        year: 'numeric',
      }).format(d);
    } catch {
      return '—';
    }
  }

  formatDatos(datos: any, isExpanded: boolean = false): string {
    if (!datos || Object.keys(datos).length === 0) {
      return 'Sin datos adicionales';
    }
    try {
      const dataString = JSON.stringify(datos, null, 2);
      if (isExpanded) return dataString;
      return dataString.length > 50
        ? dataString.substring(0, 50) + '...'
        : dataString;
    } catch {
      return 'Error al procesar datos';
    }
  }

  getTotalLotes(): number {
    if (!this.empresaData?.servicios_polo) return 0;
    return this.empresaData.servicios_polo.reduce((total, servicio) => {
      return total + (servicio.lotes ? servicio.lotes.length : 0);
    }, 0);
  }

  getTipoVehiculoName(id: any): string {
    const nid = Number(id);
    const t = this.tiposVehiculo?.find(
      (v) => Number(v.id_tipo_vehiculo) === nid
    );
    return t?.tipo ?? '-';
  }

  getTipoServicioName(id: any): string {
    const nid = Number(id);
    const t = this.tiposServicio?.find(
      (s) => Number(s.id_tipo_servicio) === nid
    );
    return t?.tipo ?? '-';
  }

  getTipoContactoName(id: any): string {
    const nid = Number(id);
    const t = this.tiposContacto?.find(
      (c) => Number(c.id_tipo_contacto) === nid
    );
    return t?.tipo ?? '-';
  }

  loadTipos(): void {
    this.loadingTipos = true;

    this.adminEmpresaService.getTiposServicioPolo().subscribe({
      next: (tipos) => {
        this.tiposServicioPolo = tipos;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar tipos de servicio polo');
      },
    });

    this.adminEmpresaService.getTiposVehiculo().subscribe({
      next: (tipos) => {
        this.tiposVehiculo = tipos;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar tipos de vehiculo');
      },
    });

    this.adminEmpresaService.getTiposServicio().subscribe({
      next: (tipos) => {
        this.tiposServicio = tipos;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar tipos de servicio');
      },
    });

    this.adminEmpresaService.getTiposContacto().subscribe({
      next: (tipos) => {
        this.tiposContacto = tipos;
        this.loadingTipos = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar tipos de contacto');
        this.loadingTipos = false;
      },
    });
  }

  toggleExpandRow(key: string): void {
    if (this.expandedRows.has(key)) {
      this.expandedRows.delete(key);
    } else {
      this.expandedRows.add(key);
    }
  }

  hasKeys(obj: any): boolean {
    return obj && Object.keys(obj).length > 0;
  }

  toggleErrorDetails(): void {
    this.showErrorDetails = !this.showErrorDetails;
  }

  getTotalErrors(): number {
    return Object.values(this.formErrors).reduce(
      (total, errors) => total + errors.length,
      0
    );
  }

  getErrorsByType(type: FormError['type']): FormError[] {
    const allErrors: FormError[] = [];
    Object.values(this.formErrors).forEach((errors) => {
      allErrors.push(...errors.filter((error) => error.type === type));
    });
    return allErrors;
  }

  private handlePasswordError(errorResponse: any): void {
    this.clearFormErrors('password');
    let passwordErrors: FormError[] = [];

    if (
      errorResponse.wrong_current ||
      errorResponse.error?.includes('contrasena actual') ||
      errorResponse.detail?.includes('incorrecta')
    ) {
      passwordErrors.push({
        field: 'currentPassword',
        message: 'La contrasena actual es incorrecta',
        type: 'validation',
      });
      this.showMessage('La contrasena actual es incorrecta', 'error');
    } else if (
      errorResponse.password_reused ||
      errorResponse.error?.includes('utilizado anteriormente')
    ) {
      passwordErrors.push({
        field: 'newPassword',
        message:
          'No puedes usar una contrasena que ya hayas utilizado anteriormente',
        type: 'validation',
      });
      this.showMessage(
        'No puedes usar una contrasena que ya hayas utilizado anteriormente',
        'error'
      );
    } else if (
      errorResponse.passwords_mismatch ||
      errorResponse.error?.includes('no coinciden')
    ) {
      passwordErrors.push({
        field: 'confirmPassword',
        message: 'Las contrasenas no coinciden',
        type: 'validation',
      });
      this.showMessage('Las contrasenas no coinciden', 'error');
    } else if (errorResponse.detail) {
      passwordErrors.push({
        field: 'general',
        message: errorResponse.detail,
        type: 'server',
      });
      this.showMessage(errorResponse.detail, 'error');
    } else if (errorResponse.error) {
      passwordErrors.push({
        field: 'general',
        message: errorResponse.error,
        type: 'server',
      });
      this.showMessage(errorResponse.error, 'error');
    } else {
      passwordErrors.push({
        field: 'general',
        message: 'Error al cambiar la contrasena. Intentalo nuevamente.',
        type: 'server',
      });
      this.showMessage('Error al cambiar la contrasena', 'error');
    }

    this.formErrors['password'] = passwordErrors;
  }

  onVehiculoTipoChange(): void {
    const tipo = Number(this.vehiculoForm.id_tipo_vehiculo);
    const currentDatos = this.vehiculoForm.datos || {};

    switch (tipo) {
      case 1: // Corporativo
        this.vehiculoForm.datos = {
          cantidad: currentDatos.cantidad ?? null,
          patente: currentDatos.patente ?? '',
          carga: currentDatos.carga ?? null,
        };
        break;
      case 2: // Personal
        this.vehiculoForm.datos = {
          cantidad: currentDatos.cantidad ?? null,
          patente: currentDatos.patente ?? '',
        };
        break;
      case 3: // Terceros
        this.vehiculoForm.datos = {
          cantidad: currentDatos.cantidad ?? null,
          carga: currentDatos.carga ?? null,
        };
        break;
      default:
        this.vehiculoForm.datos = {
          descripcion: currentDatos.descripcion ?? '',
        };
    }
  }

  /** Devuelve un texto de URL sin protocolo para mostrar */
  displayUrl(u?: string): string {
    if (!u) return '';
    try {
      return u.trim().replace(/^\s*https?:\/\//i, '');
    } catch {
      return u;
    }
  }

  /** Devuelve una URL segura para usar en href (agrega https:// si falta) */
  externalHref(u?: string): string {
    if (!u) return '#';
    return /^https?:\/\//i.test(u) ? u : `https://${u.trim()}`;
  }

  markAllAndSubmit(form: NgForm) {
    form.form.markAllAsTouched();
    if (form.invalid) {
      return;
    } // muestra errores y no envia
    this.onSubmitVehiculo(); // tu logica real de guardado
  }

  // dentro de la clase EmpresaMeComponent
  confirmAndSubmit(
    kind: 'empresa' | 'vehiculo' | 'servicio' | 'contacto',
    formRef: NgForm
  ) {
    // 1) Validacion: marcar controles, no abrir confirm si esta invalido
    if (!formRef || formRef.invalid) {
      Object.values(formRef.controls ?? {}).forEach((c: any) =>
        c?.markAsTouched?.()
      );
      return;
    }

    // 2) Texto segun el modal y si estas editando o creando
    const verbos: Record<typeof kind, string> = {
      empresa: 'guardar cambios de la empresa',
      vehiculo: this.editingVehiculo
        ? 'actualizar el vehiculo'
        : 'agregar el vehiculo',
      servicio: this.editingServicio
        ? 'actualizar el servicio'
        : 'agregar el servicio',
      contacto: this.editingContacto
        ? 'actualizar el contacto'
        : 'agregar el contacto',
    };

    const ok = window.confirm(
      `¿Queres ${verbos[kind]} ahora?\n\n• Aceptar: agregar/guardar\n• Cancelar: seguir editando`
    );
    if (!ok) return;

    // 3) Ejecutar el submit real que ya tenes implementado
    switch (kind) {
      case 'empresa':
        this.onSubmitEmpresaEdit();
        break;
      case 'vehiculo':
        this.onSubmitVehiculo();
        break;
      case 'servicio':
        this.onSubmitServicio();
        break;
      case 'contacto':
        this.onSubmitContacto();
        break;
    }
  }
}
