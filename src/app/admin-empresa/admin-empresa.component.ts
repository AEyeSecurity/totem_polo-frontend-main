import { Component, OnInit, inject } from '@angular/core';

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
  EmpresaDirectorio,
  EmpresaSelfUpdate,
  TipoVehiculo,
  TipoServicio,
  TipoContacto,
  TipoServicioPolo,
  InfoComercial,
  InfoComercialUpdate,
  ComercialChatResponse,
} from './admin-empresa.service';
import { LogoutButtonComponent } from '../shared/logout-button/logout-button.component';
import { PasswordChangeModalComponent } from '../shared/password-change-modal/password-change-modal.component';
import { UpdateReminderModalComponent } from '../shared/update-reminder-modal/update-reminder-modal.component';
import { WelcomeModalComponent } from '../shared/welcome-modal/welcome-modal.component';
import { FormError, HttpErrorLike } from '../shared/form-error.model';
import {
  buildFormErrorsFromHttpError,
  getFieldErrors as getFieldErrorsUtil,
  hasFieldError as hasFieldErrorUtil,
  GENERIC_FIELD_ERROR_TRANSLATIONS,
} from '../shared/form-errors.util';
import { UnsavedChangesTracker } from '../shared/unsaved-changes-tracker';
import {
  formatActivityMoment as formatActivityMomentUtil,
  getItemDateSource as getItemDateSourceUtil,
  getItemTimestamp as getItemTimestampUtil,
} from '../shared/activity-format.util';
import { ChatbotFabComponent } from '../shared/chatbot-fab/chatbot-fab.component';

const EMPRESA_DATE_FIELDS = [
  'updated_at',
  'created_at',
  'fecha',
  'fecha_registro',
  'fecha_alta',
  'fecha_actualizacion',
  'fecha_creacion',
];

@Component({
  selector: 'app-empresa-me',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    LogoutButtonComponent,
    NgxJsonViewerModule,
    PasswordChangeModalComponent,
    UpdateReminderModalComponent,
    WelcomeModalComponent,
    ChatbotFabComponent
],
  templateUrl: './admin-empresa.component.html',
  styleUrls: ['./admin-empresa.component.css'],
})
export class EmpresaMeComponent implements OnInit {
  private adminEmpresaService = inject(AdminEmpresaService);
  private authService = inject(AuthenticationService);

  // pestanas
  activeTab:
    | 'dashboard'
    | 'vehiculos'
    | 'servicios'
    | 'contactos'
    | 'serviciosPolo'
    | 'empresas'
    | 'perfil'
    | 'config' = 'dashboard';

  // Directorio de empresas del parque (networking entre inquilinos)
  empresasDirectorio: EmpresaDirectorio[] = [];
  filteredEmpresasDirectorio: EmpresaDirectorio[] = [];
  empresasDirectorioSearchTerm = '';
  loadingEmpresasDirectorio = false;
  empresasDirectorioError = '';
  private empresasDirectorioLoaded = false;

  // Sin tope real: se quiere ver el listado completo, la lista es
  // scrolleable en el html.
  private readonly MAX_ACTIVIDADES = 2000;

  // Datos de la empresa
  empresaData: EmpresaDetail | null = null;

  // Formularios / modales
  showPasswordForm = false;
  showVehiculoForm = false;
  showServicioForm = false;
  showContactoForm = false;
  showEmpresaEditForm = false;
  showPasswordModal = false; // ← requerido por la plantilla
  showReminderModal = false;
  showWelcomeModal = false;

  // Estados de edicion
  editingVehiculo: Vehiculo | null = null;
  editingServicio: Servicio | null = null;
  editingContacto: Contacto | null = null;

  // PROPIEDADES PARA CONTROL DE CAMBIOS
  private changes = new UnsavedChangesTracker();

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

  // Sistema de errores mejorado
  formErrors: Partial<Record<string, FormError[]>> = {};
  showErrorDetails = false;

  // Estado de "guardando" por modal, para mostrar el aviso de progreso
  submitting: Record<'empresa' | 'vehiculo' | 'servicio' | 'contacto', boolean> = {
    empresa: false,
    vehiculo: false,
    servicio: false,
    contacto: false,
  };

  isModalBusy(formName: 'empresa' | 'vehiculo' | 'servicio' | 'contacto'): boolean {
    return !!this.submitting[formName];
  }

  // Tipos desde la BD
  tiposVehiculo: TipoVehiculo[] = [];
  tiposServicio: TipoServicio[] = [];
  tiposContacto: TipoContacto[] = [];
  tiposServicioPolo: TipoServicioPolo[] = [];

  // PROPIEDADES PARA BUSQUEDA
  vehiculoSearchTerm = '';
  servicioSearchTerm = '';
  contactoSearchTerm = '';
  servicioPoloSearchTerm = '';

  // Arrays filtrados
  filteredVehiculos: Vehiculo[] = [];
  filteredServicios: Servicio[] = [];
  filteredContactos: Contacto[] = [];
  filteredServiciosPolo: ServicioPolo[] = [];

  // Expanded rows
  expandedRows = new Set<string>();

  // Informacion comercial (bot de carga guiado en la pestana de perfil)
  comercialInfo: InfoComercial | null = null;
  comercialLoadingInfo = false;
  comercialChatStarted = false;
  comercialChatLoading = false;
  comercialDone = false;
  comercialCampoActual: string | null = null;
  comercialProgresoActual = 0;
  comercialProgresoTotal = 0;
  comercialInput = '';
  comercialMessages: { from: 'bot' | 'user'; text: string }[] = [];

  showComercialEditForm = false;
  comercialEditForm: InfoComercialUpdate = {};
  readonly comercialPublicoOpciones = ['B2B', 'B2C', 'Ambos'];
  readonly comercialRangoPreciosOpciones = ['Económico', 'Medio', 'Premium'];
  readonly comercialModalidadVentaOpciones = ['Presencial', 'Online', 'Ambas'];

  get comercialContactos(): Contacto[] {
    const tipoComercial = this.tiposContacto.find(
      (t) => t.tipo?.toLowerCase() === 'comercial'
    );
    if (!tipoComercial || !this.empresaData) return [];
    return this.empresaData.contactos.filter(
      (c) => c.id_tipo_contacto === tipoComercial.id_tipo_contacto
    );
  }

  ngOnInit(): void {
    this.loadTipos();
    this.loadEmpresaData();
    this.loadComercialInfo();
    this.showWelcomeModal = this.authService.shouldShowWelcome();
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
    if (tab === 'empresas' && !this.empresasDirectorioLoaded) {
      this.loadEmpresasDirectorio();
    }
  }

  loadEmpresasDirectorio(): void {
    this.loadingEmpresasDirectorio = true;
    this.empresasDirectorioError = '';
    this.adminEmpresaService.getEmpresasDirectorio().subscribe({
      next: (empresas) => {
        this.empresasDirectorioLoaded = true;
        this.loadingEmpresasDirectorio = false;
        this.empresasDirectorio = empresas;
        this.filterEmpresasDirectorio();
      },
      error: (error) => {
        this.loadingEmpresasDirectorio = false;
        this.empresasDirectorioError =
          error.status === 403
            ? 'Tu cuenta no tiene permiso para ver el directorio de empresas del parque.'
            : 'No se pudo cargar el directorio de empresas. Intenta nuevamente mas tarde.';
      },
    });
  }

  filterEmpresasDirectorio(): void {
    if (!this.empresasDirectorioSearchTerm.trim()) {
      this.filteredEmpresasDirectorio = [...this.empresasDirectorio];
      return;
    }
    const term = this.empresasDirectorioSearchTerm.toLowerCase().trim();
    this.filteredEmpresasDirectorio = this.empresasDirectorio.filter(
      (empresa) =>
        empresa.nombre.toLowerCase().includes(term) ||
        empresa.rubro.toLowerCase().includes(term)
    );
  }

  clearEmpresasDirectorioSearch(): void {
    this.empresasDirectorioSearchTerm = '';
    this.filterEmpresasDirectorio();
  }

  // Prioriza el contacto de tipo "comercial", despues "empresarial", y
  // recien si no hay ninguno de esos dos usa el primero que haya.
  private getContactoPrincipal(empresa: EmpresaDirectorio) {
    const contactos = empresa.contactos || [];
    return (
      contactos.find((c) => c.tipo_contacto?.toLowerCase() === 'comercial') ||
      contactos.find((c) => c.tipo_contacto?.toLowerCase() === 'empresarial') ||
      contactos[0]
    );
  }

  getContactoComercial(empresa: EmpresaDirectorio): string {
    const contacto = this.getContactoPrincipal(empresa);
    if (!contacto?.nombre) return '-';
    const tipo = contacto.tipo_contacto
      ? ` (${this.capitalizar(contacto.tipo_contacto)})`
      : '';
    return `${contacto.nombre}${tipo}`;
  }

  private capitalizar(valor: string): string {
    return valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase();
  }

  getTelefonoComercial(empresa: EmpresaDirectorio): string {
    return this.getContactoPrincipal(empresa)?.telefono || '-';
  }

  // Datos de contacto web/redes cargados en el contacto comercial/empresarial
  // (pagina_web, correo, redes_sociales), no la ficha de info comercial.
  getDatosComerciales(empresa: EmpresaDirectorio): string {
    const datos = this.getContactoPrincipal(empresa)?.datos;
    if (!datos) return '-';

    const partes: string[] = [];
    if (datos.pagina_web) {
      partes.push(datos.pagina_web);
    }
    if (datos.redes_sociales) {
      partes.push(datos.redes_sociales);
    }
    if (datos.correo) {
      partes.push(datos.correo);
    }
    return partes.length ? partes.join(' · ') : '-';
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

    this.formErrors = {};
    this.changes.clearAll();
  }

  // ===== Control de cambios =====
  private restoreOriginalFormData(formName: string): void {
    const originalData = this.changes.getInitial(formName);
    if (!originalData) return;
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

  actividadReciente: {
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string; // HH:mm o "-" si no hay timestamp
  }[] = [];
  private manualActivities: {
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string;
    timestamp: number;
  }[] = [];
  private lastBuiltActivities: {
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string;
    timestamp: number;
  }[] = [];
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
    // Vehiculo/Servicio/Contacto no tienen ningun campo de fecha en la base.
    // Antes se les inventaba una fecha "recien ahora" (fallback secuencial)
    // cada vez que se reconstruia esta lista, asi que CUALQUIER guardado
    // (aunque fuera de otra seccion, como info comercial) hacia que items
    // sin tocar aparecieran como recien actualizados. Ahora, si no hay fecha
    // real, queda sin fecha (timestamp 0, "-"): solo pushActivity() (la
    // accion real, en el momento en que pasa) los hace aparecer como
    // recientes.
    const toActividad = (
      tipo: 'ok' | 'warn' | 'info',
      titulo: string,
      item: any
    ) => {
      const raw = this.getItemDateSource(item);
      return {
        tipo,
        titulo,
        cuando: raw ? this.formatActivityMoment(raw) : '-',
        timestamp: raw ? this.getItemTimestamp(item) : 0,
      };
    };

    const vehiculosAct = [...(this.empresaData?.vehiculos ?? [])]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((vehiculo) =>
        toActividad(
          'ok',
          `Vehiculo ${this.getTipoVehiculoName(
            vehiculo.id_tipo_vehiculo
          )} actualizado`,
          vehiculo
        )
      );

    const serviciosAct = [...(this.empresaData?.servicios ?? [])]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((servicio) =>
        toActividad(
          'info',
          `Servicio ${this.getTipoServicioName(
            servicio.id_tipo_servicio
          )} actualizado`,
          servicio
        )
      );

    const contactosAct = [...(this.empresaData?.contactos ?? [])]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((contacto) =>
        toActividad('ok', `Contacto ${contacto.nombre} actualizado`, contacto)
      );

    // Entrelazadas antes de ordenar: varios registros comparten fecha (solo
    // hay granularidad de dia), asi que un sort estable sobre listas
    // concatenadas dejaba bloques enteros de un mismo tipo juntos.
    const actividades = this.interleaveActividades([
      vehiculosAct,
      serviciosAct,
      contactosAct,
    ]);

    this.actividadReciente = actividades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_ACTIVIDADES)
      .map(({ timestamp: _timestamp, ...rest }) => ({
        ...rest,
        cuando: rest.cuando || '-',
      }));
    this.lastBuiltActivities = actividades;
    this.combineActivities(actividades);
  }

  private interleaveActividades<T>(listas: T[][]): T[] {
    const resultado: T[] = [];
    const maxLen = Math.max(0, ...listas.map((l) => l.length));
    for (let i = 0; i < maxLen; i++) {
      for (const lista of listas) {
        if (i < lista.length) resultado.push(lista[i]);
      }
    }
    return resultado;
  }

  private getItemDateSource(item: any): string | null {
    return getItemDateSourceUtil(item, EMPRESA_DATE_FIELDS);
  }

  private getItemTimestamp(item: any): number {
    return getItemTimestampUtil(item, EMPRESA_DATE_FIELDS);
  }

  private formatActivityMoment(raw?: string): string {
    return formatActivityMomentUtil(raw);
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
    dataActivities: {
      tipo: 'ok' | 'warn' | 'info';
      titulo: string;
      cuando: string;
      timestamp: number;
    }[]
  ): void {
    this.pruneManualActivities();
    const final: {
      tipo: 'ok' | 'warn' | 'info';
      titulo: string;
      cuando: string;
      timestamp: number;
    }[] = [];

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
    const hasChanges = this.changes.hasChanged(formName, currentFormData);
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
    this.changes.clear(formName);
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
      case 'empresas':
        this.filterEmpresasDirectorio();
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
    return getFieldErrorsUtil(this.formErrors, formName, fieldName);
  }
  hasFieldError(formName: string, fieldName: string): boolean {
    return hasFieldErrorUtil(this.formErrors, formName, fieldName);
  }

  private handleError(
    error: HttpErrorLike,
    formName: string,
    operation: string
  ): void {
    console.error(`Error en ${operation}:`, error);
    this.clearFormErrors(formName);

    const errorMessages = buildFormErrorsFromHttpError(
      error,
      formName,
      (field, message, form) => this.translateFieldError(field, message, form),
      (detail, form) => this.translateGenericError(detail, form)
    );
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
    const translations: Record<string, Record<string, string>> = {
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

    return GENERIC_FIELD_ERROR_TRANSLATIONS[message] || message;
  }

  private translateGenericError(detail: string, _formName: string): string {
    const translations: Record<string, string> = {
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

        this.buildActividadRecienteFromData();
        this.loading = false;
        this.checkUpdateReminder(data.cuil);
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar datos de la empresa');
        this.loading = false;
      },
    });
  }

  // ===== Informacion comercial (bot de carga guiado) =====
  loadComercialInfo(): void {
    this.comercialLoadingInfo = true;
    this.adminEmpresaService.getComercialInfo().subscribe({
      next: (data) => {
        this.comercialInfo = data;
        this.comercialDone = data.completado;
        this.comercialLoadingInfo = false;
      },
      error: () => {
        // 404 = todavia no se cargo nada: es un estado valido, no un error.
        this.comercialInfo = null;
        this.comercialDone = false;
        this.comercialLoadingInfo = false;
      },
    });
  }

  startComercialChat(): void {
    if (this.comercialChatStarted) return;
    this.comercialChatStarted = true;
    this.comercialMessages = [];
    this.runComercialChatStep(undefined);
  }

  sendComercialAnswer(): void {
    const text = this.comercialInput.trim();
    if (!text || this.comercialChatLoading) return;
    this.comercialMessages.push({ from: 'user', text });
    this.comercialInput = '';
    this.runComercialChatStep(text);
  }

  private runComercialChatStep(message?: string): void {
    this.comercialChatLoading = true;
    this.adminEmpresaService.sendComercialChatMessage(message).subscribe({
      next: (res: ComercialChatResponse) => {
        this.comercialMessages.push({ from: 'bot', text: res.reply });
        this.comercialDone = res.done;
        this.comercialCampoActual = res.campo_actual ?? null;
        this.comercialProgresoActual = res.progreso_actual;
        this.comercialProgresoTotal = res.progreso_total;
        this.comercialChatLoading = false;
        if (res.done) {
          this.pushActivity('ok', 'Informacion comercial completada');
          this.loadComercialInfo();
        }
      },
      error: (error) => {
        this.handleError(error, 'comercial', 'procesar tu respuesta');
        this.comercialChatLoading = false;
      },
    });
  }

  openComercialEditForm(): void {
    if (!this.comercialInfo) return;
    this.clearFormErrors('comercial');
    this.comercialEditForm = {
      productos_servicios: this.comercialInfo.productos_servicios || '',
      publico_objetivo: this.comercialInfo.publico_objetivo || '',
      atiende_publico: this.comercialInfo.atiende_publico ?? null,
      horario_atencion_comercial:
        this.comercialInfo.horario_atencion_comercial || '',
      rango_precios: this.comercialInfo.rango_precios || '',
      modalidad_venta: this.comercialInfo.modalidad_venta || '',
      marcas_representadas: this.comercialInfo.marcas_representadas || '',
      certificaciones: this.comercialInfo.certificaciones || '',
      observaciones_comerciales:
        this.comercialInfo.observaciones_comerciales || '',
    };
    this.showComercialEditForm = true;
  }

  cancelComercialEditForm(): void {
    this.showComercialEditForm = false;
    this.clearFormErrors('comercial');
  }

  submitComercialEdit(): void {
    this.comercialChatLoading = true;
    this.adminEmpresaService
      .updateComercialInfo(this.comercialEditForm)
      .subscribe({
        next: (data) => {
          this.comercialInfo = data;
          this.comercialDone = data.completado;
          this.showComercialEditForm = false;
          this.comercialChatLoading = false;
          this.showMessage(
            'Informacion comercial actualizada exitosamente',
            'success'
          );
          this.pushActivity('ok', 'Informacion comercial actualizada');
        },
        error: (error) => {
          this.handleError(error, 'comercial', 'actualizar informacion comercial');
          this.comercialChatLoading = false;
        },
      });
  }

  // ===== Recordatorio de actualización de datos (cada 6 meses) =====
  private checkUpdateReminder(cuil: number): void {
    const key = `empresaUpdateReminderShown_${cuil}`;
    const lastShownRaw = localStorage.getItem(key);
    const now = new Date();

    if (!lastShownRaw) {
      // Primera vez que vemos a esta empresa: arrancamos el conteo sin
      // mostrar el aviso todavía (recién cargaron sus datos).
      localStorage.setItem(key, now.getTime().toString());
      return;
    }

    const lastShown = new Date(Number(lastShownRaw));
    const nextReminder = new Date(lastShown);
    nextReminder.setMonth(nextReminder.getMonth() + 6);

    if (now >= nextReminder) {
      this.showReminderModal = true;
    }
  }

  private markReminderShown(): void {
    if (!this.empresaData) return;
    localStorage.setItem(
      `empresaUpdateReminderShown_${this.empresaData.cuil}`,
      Date.now().toString()
    );
  }

  onReminderClosed(): void {
    this.showReminderModal = false;
    this.markReminderShown();
  }

  onReminderGoToUpdate(): void {
    this.showReminderModal = false;
    this.markReminderShown();
    this.openEmpresaEditForm();
  }

  // ===== Aviso de bienvenida (primer login) =====
  onWelcomeClosed(): void {
    this.showWelcomeModal = false;
    this.authService.markWelcomeSeen().subscribe();
  }

  onWelcomeGoToComercial(): void {
    this.showWelcomeModal = false;
    this.authService.markWelcomeSeen().subscribe();
    this.setActiveTab('perfil');
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

    this.submitting = {
      empresa: false,
      vehiculo: false,
      servicio: false,
      contacto: false,
    };

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

    this.changes.clearAll();
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
      this.changes.save('empresa', this.empresaEditForm);
    }, 0);
  }

  onSubmitEmpresaEdit(): void {
    this.loading = true;
    this.clearFormErrors('empresa');
    this.submitting.empresa = true;

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
        this.submitting.empresa = false;
      },
      error: (error) => {
        this.handleError(error, 'empresa', 'actualizar datos de empresa');
        this.loading = false;
        this.submitting.empresa = false;
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
      this.changes.save('vehiculo', this.vehiculoForm);
    }, 0);
  }

  onSubmitVehiculo(): void {
    this.loading = true;
    this.clearFormErrors('vehiculo');
    this.submitting.vehiculo = true;

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
            this.submitting.vehiculo = false;
          },
          error: (error) => {
            this.handleError(error, 'vehiculo', 'actualizar vehiculo');
            this.loading = false;
            this.submitting.vehiculo = false;
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
          this.submitting.vehiculo = false;
        },
        error: (error) => {
          this.handleError(error, 'vehiculo', 'crear vehiculo');
          this.loading = false;
          this.submitting.vehiculo = false;
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
      this.changes.save('servicio', this.servicioForm);
    }, 0);
  }

  onSubmitServicio(): void {
    this.loading = true;
    this.clearFormErrors('servicio');
    this.submitting.servicio = true;

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
          this.submitting.servicio = false;
        },
        error: (error) => {
          this.handleError(error, 'servicio', 'actualizar servicio');
          this.loading = false;
          this.submitting.servicio = false;
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
          this.submitting.servicio = false;
        },
        error: (error) => {
          this.handleError(error, 'servicio', 'crear servicio');
          this.loading = false;
          this.submitting.servicio = false;
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
      this.changes.save('contacto', this.contactoForm);
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

    this.submitting.contacto = true;

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
            this.submitting.contacto = false;
          },
          error: (error) => {
            this.handleError(error, 'contacto', 'actualizar contacto');
            this.loading = false;
            this.submitting.contacto = false;
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
          this.submitting.contacto = false;
        },
        error: (error) => {
          this.handleError(error, 'contacto', 'crear contacto');
          this.loading = false;
          this.submitting.contacto = false;
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
    } catch {
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

  formatDatos(datos: any, isExpanded = false): string {
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
      (total, errors) => total + (errors?.length ?? 0),
      0
    );
  }

  getErrorsByType(type: FormError['type']): FormError[] {
    const allErrors: FormError[] = [];
    Object.values(this.formErrors).forEach((errors) => {
      allErrors.push(...(errors ?? []).filter((error) => error.type === type));
    });
    return allErrors;
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
    kind: 'empresa' | 'vehiculo' | 'servicio' | 'contacto' | 'comercial',
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
      comercial: 'guardar la informacion comercial',
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
      case 'comercial':
        this.submitComercialEdit();
        break;
    }
  }
}
