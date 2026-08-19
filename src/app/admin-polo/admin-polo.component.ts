import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AdminPoloService,
  Empresa,
  EmpresaCreate,
  EmpresaUpdate,
  Usuario,
  UsuarioCreate,
  UsuarioUpdate,
  Rol,
  ServicioPolo,
  ServicioPoloCreate,
  Lote,
  LoteCreate,
  PoloDetail,
  PoloSelfUpdate,
  InfoComercial,
  InfoComercialUpdate,
} from './admin-polo.service';
import { LogoutButtonComponent } from '../shared/logout-button/logout-button.component';
import { PasswordChangeModalComponent } from '../shared/password-change-modal/password-change-modal.component';
import { FormError, HttpErrorLike } from '../shared/form-error.model';
import {
  buildFormErrorsFromHttpError,
  getFieldErrors as getFieldErrorsUtil,
  hasFieldError as hasFieldErrorUtil,
  GENERIC_FIELD_ERROR_TRANSLATIONS,
} from '../shared/form-errors.util';
import { UnsavedChangesTracker } from '../shared/unsaved-changes-tracker';
import { formatActivityMoment as formatActivityMomentUtil } from '../shared/activity-format.util';

type AdminPoloTab =
  | 'dashboard'
  | 'empresas'
  | 'usuarios'
  | 'servicios'
  | 'lotes'
  | 'perfil'
  | 'config';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LogoutButtonComponent,
    PasswordChangeModalComponent,
  ],
  templateUrl: './admin-polo.component.html',
  styleUrls: ['./admin-polo.component.css'],
})
export class AdminPoloComponent implements OnInit {
  private adminPoloService = inject(AdminPoloService);

  showPasswordModal = false;

  activeTab: AdminPoloTab = 'dashboard';

  // Sin tope real: se quiere ver el listado completo (una fila por
  // empresa/usuario/servicio/lote), la lista es scrolleable en el html.
  private readonly MAX_ACTIVIDADES = 2000;
  private dashboardDataLoaded = false;
  actividadReciente: {
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string;
  }[] = [];

  // PROPIEDADES PARA EL POLO
  poloData: PoloDetail | null = null;
  showPasswordForm = false;
  showPoloEditForm = false;

  passwordForm = {
    password: '',
    confirmPassword: '',
  };

  poloEditForm: PoloSelfUpdate = {
    cant_empleados: 0,
    observaciones: '',
    horario_trabajo: '',
  };

  // Informacion comercial del Polo (se carga/edita directa, sin wizard:
  // la conoce el propio Polo, no hace falta completarla de a un campo)
  comercialInfo: InfoComercial | null = null;
  comercialLoadingInfo = false;
  comercialSaving = false;

  showComercialEditForm = false;
  comercialEditForm: InfoComercialUpdate = {};
  readonly comercialPublicoOpciones = ['B2B', 'B2C', 'Ambos'];
  readonly comercialRangoPreciosOpciones = ['Económico', 'Medio', 'Premium'];
  readonly comercialModalidadVentaOpciones = ['Presencial', 'Online', 'Ambas'];

  // PROPIEDADES PARA CONTROL DE CAMBIOS - MEJORADO
  private changes = new UnsavedChangesTracker();
  private empresaNombrePorCuil: Record<number, string> = {};
  private servicioNombrePorId: Record<number, string> = {};

  // Sistema de errores mejorado
  formErrors: Partial<Record<string, FormError[]>> = {};

  // Empresas
  empresas: Empresa[] = [];
  showEmpresaForm = false;
  editingEmpresa: Empresa | null = null;
  empresaForm: EmpresaCreate = {
    cuil: 0,
    nombre: '',
    rubro: '',
    cant_empleados: 0,
    observaciones: '',
    horario_trabajo: '',
    estado: true,
  };
  empresaEstadoActual: boolean | null = null;

  selectedEmpresa: Empresa | null = null;
  creatingForEmpresa = false;

  // 🔽 Agregá esto a la clase
  submitting: Record<
    'polo' | 'empresa' | 'usuario' | 'servicioPolo' | 'lote',
    boolean
  > = {
    polo: false,
    empresa: false,
    usuario: false,
    servicioPolo: false,
    lote: false,
  };

  isModalBusy(
    formName: 'polo' | 'empresa' | 'usuario' | 'servicioPolo' | 'lote'
  ): boolean {
    return !!this.submitting[formName];
  }
  // Usuarios
  usuarios: Usuario[] = [];
  roles: Rol[] = [];
  showUsuarioForm = false;
  editingUsuario: Usuario | null = null;
  usuarioForm: UsuarioCreate = {
    email: '',
    nombre: '',
    password: '',
    estado: true,
    cuil: null as any,
    id_rol: null as any,
  };

  // Servicios del Polo
  serviciosPolo: ServicioPolo[] = [];
  showServicioPoloForm = false;
  servicioPoloForm: ServicioPoloCreate = {
    nombre: '',
    horario: '',
    datos: {
      cant_puestos: null,
      m2: null,
      datos_prop: {
        nombre: '',
        contacto: '',
      },
      datos_inquilino: {
        nombre: '',
        contacto: '',
      },
    },
    propietario: '',
    id_tipo_servicio_polo: 1,
    cuil: 0,
  };
  nombreServicioSeleccionado = '';

  // Lotes
  lotes: Lote[] = [];
  showLoteForm = false;
  loteForm: LoteCreate = {
    dueno: '',
    lote: 0,
    manzana: 0,
    id_servicio_polo: 0,
  };

  // Estados
  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  // PROPIEDADES PARA BÚSQUEDA
  empresaSearchTerm = '';
  usuarioSearchTerm = '';
  servicioSearchTerm = '';
  loteSearchTerm = '';

  // Arrays filtrados
  filteredEmpresas: Empresa[] = [];
  filteredUsuarios: Usuario[] = [];
  filteredServicios: ServicioPolo[] = [];
  filteredLotes: Lote[] = [];

  ngOnInit(): void {
    this.loadRoles();
    this.loadPoloData();
    this.loadData();
    this.loadComercialInfo();
  }

  setActiveTab(tab: AdminPoloTab): void {
    this.activeTab = tab;
    // Cerrar formularios sin confirmación al cambiar de tab
    this.closeAllFormsWithoutConfirmation();
    this.loadData();
  }

  quickAddEmpresa(): void {
    this.setActiveTab('empresas');
    this.openEmpresaForm();
  }

  quickAddUsuario(): void {
    this.setActiveTab('usuarios');
    this.openUsuarioForm();
  }

  quickAddServicioPolo(): void {
    this.setActiveTab('servicios');
    this.openServicioPoloForm();
  }

  quickAddLote(): void {
    this.setActiveTab('servicios');
    if (this.serviciosPolo.length > 0) {
      const servicio = this.serviciosPolo[0];
      this.openLoteForm(servicio.id_servicio_polo, servicio.nombre);
    }
  }

  // MÉTODO PARA CERRAR TODOS LOS FORMULARIOS SIN CONFIRMACIÓN
  private closeAllFormsWithoutConfirmation(): void {
    this.showPasswordForm = false;
    this.showPoloEditForm = false;
    this.showEmpresaForm = false;
    this.showUsuarioForm = false;
    this.showServicioPoloForm = false;
    this.showLoteForm = false;
    this.editingEmpresa = null;
    this.editingUsuario = null;
    this.selectedEmpresa = null;
    this.creatingForEmpresa = false;

    // Limpiar errores de todos los formularios
    this.formErrors = {};

    // Limpiar estados de cambios
    this.changes.clearAll();
  }

  // MÉTODOS PARA CONTROL DE CAMBIOS MEJORADO

  // --- helpers ---
  private rebuildEmpresaIndex(): void {
    const map: Record<number, string> = {};

    // de /polo/me (si ya vino)
    this.poloData?.empresas?.forEach((e) => {
      map[e.cuil] = e.nombre;
    });

    // de /empresas (si ya vino)
    this.empresas?.forEach((e) => {
      map[e.cuil] = e.nombre;
    });

    this.empresaNombrePorCuil = map;
  }

  private rebuildServicioPoloIndex(): void {
    const map: Record<number, string> = {};
    this.serviciosPolo.forEach((servicio) => {
      const baseNombre =
        servicio.nombre?.trim() ||
        servicio.tipo_servicio_polo?.trim() ||
        `Servicio #${servicio.id_servicio_polo}`;
      map[servicio.id_servicio_polo] = baseNombre;
    });
    this.servicioNombrePorId = map;
  }

  get totalEmpresas(): number {
    return this.empresas.length;
  }

  get empresasActivas(): number {
    return this.empresas.filter((e) => e.estado).length;
  }

  get empresasInactivas(): number {
    return this.empresas.filter((e) => !e.estado).length;
  }

  get totalUsuarios(): number {
    return this.usuarios.length;
  }

  get usuariosActivos(): number {
    return this.usuarios.filter((u) => u.estado).length;
  }

  get totalServiciosPolo(): number {
    return this.serviciosPolo.length;
  }

  get totalLotes(): number {
    return this.lotes.length;
  }

  getEmpresaNombre(cuil: number | null | undefined): string {
    if (!cuil && cuil !== 0) return '—';
    return this.empresaNombrePorCuil[cuil] ?? cuil.toString();
  }
  getServicioPoloNombre(id: number | null | undefined): string {
    if (id === null || id === undefined) return '-';
    const direct =
      this.servicioNombrePorId[id] ??
      this.serviciosPolo
        .find((s) => s.id_servicio_polo === id)
        ?.nombre?.trim() ??
      this.serviciosPolo
        .find((s) => s.id_servicio_polo === id)
        ?.tipo_servicio_polo?.trim();
    return direct && direct.length > 0 ? direct : `Servicio #${id}`;
  }
  // MÉTODO PARA RESTAURAR DATOS ORIGINALES
  private restoreOriginalFormData(formName: string): void {
    const originalData = this.changes.getInitial(formName);
    if (!originalData) return;

    switch (formName) {
      case 'polo':
        this.poloEditForm = {
          cant_empleados: originalData.cant_empleados,
          observaciones: originalData.observaciones,
          horario_trabajo: originalData.horario_trabajo,
        };
        break;

      case 'empresa':
        this.empresaForm = {
          cuil: originalData.cuil,
          nombre: originalData.nombre,
          rubro: originalData.rubro,
          cant_empleados: originalData.cant_empleados,
          observaciones: originalData.observaciones,
          horario_trabajo: originalData.horario_trabajo,
          estado: originalData.estado,
        };
        break;

      case 'usuario':
        this.usuarioForm = {
          email: originalData.email,
          nombre: originalData.nombre,
          password: originalData.password,
          estado: originalData.estado,
          cuil: originalData.cuil,
          id_rol: originalData.id_rol,
        };
        break;

      case 'servicioPolo':
        this.servicioPoloForm = {
          nombre: originalData.nombre,
          horario: originalData.horario,
          datos: { ...originalData.datos },
          propietario: originalData.propietario,
          id_tipo_servicio_polo: originalData.id_tipo_servicio_polo,
          cuil: originalData.cuil,
        };
        break;

      case 'lote':
        this.loteForm = {
          dueno: originalData.dueno,
          lote: originalData.lote,
          manzana: originalData.manzana,
          id_servicio_polo: originalData.id_servicio_polo,
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

  // MÉTODO PARA CANCELAR FORMULARIOS CON CONFIRMACIÓN DE CAMBIOS
  cancelForm(formName: string): void {
    let currentFormData: any;

    // Obtener los datos actuales del formulario
    switch (formName) {
      case 'polo':
        currentFormData = this.poloEditForm;
        break;
      case 'empresa':
        currentFormData = this.empresaForm;
        break;
      case 'usuario':
        currentFormData = this.usuarioForm;
        break;
      case 'servicioPolo':
        currentFormData = this.servicioPoloForm;
        break;
      case 'lote':
        currentFormData = this.loteForm;
        break;
      case 'password':
        currentFormData = this.passwordForm;
        break;
      default:
        return;
    }

    if (this.isModalBusy(formName as any)) {
      alert('Hay una operación en curso. Por favor esperá a que finalice.');
      return;
    }

    // Verificar si hay cambios sin guardar
    const hasChanges = this.changes.hasChanged(formName, currentFormData);

    if (hasChanges) {
      const shouldDiscard = confirm(
        '¿Deseas descartar los cambios?\n\n' +
          'Se perderán todos los cambios no guardados.\n\n' +
          'Presiona "Aceptar" para descartar o "Cancelar" para continuar editando.'
      );

      if (!shouldDiscard) {
        return; // Usuario decide continuar editando
      }

      // Restaurar datos originales ANTES de cerrar
      this.restoreOriginalFormData(formName);
    }

    // Cerrar el formulario
    this.closeFormWithoutConfirmation(formName);
  }

  // MÉTODO PARA CERRAR FORMULARIO SIN CONFIRMACIÓN (uso interno)
  private closeFormWithoutConfirmation(formName: string): void {
    switch (formName) {
      case 'polo':
        this.showPoloEditForm = false;
        break;
      case 'empresa':
        this.showEmpresaForm = false;
        this.editingEmpresa = null;
        break;
      case 'usuario':
        this.showUsuarioForm = false;
        this.editingUsuario = null;
        break;
      case 'servicioPolo':
        this.showServicioPoloForm = false;
        break;
      case 'lote':
        this.showLoteForm = false;
        break;
      case 'password':
        this.showPasswordForm = false;
        break;
    }

    // Limpiar errores específicos del formulario
    this.clearFormErrors(formName);

    // Limpiar estado de cambios para este formulario
    this.changes.clear(formName);

    // Limpiar estados específicos
    this.selectedEmpresa = null;
    this.creatingForEmpresa = false;
  }

  closeFormDirectly(formName: string): void {
    // Este método se usa para el botón X y hace la misma validación
    this.cancelForm(formName);
  }

  // MÉTODOS DE FILTRADO
  filterEmpresas(): void {
    if (!this.empresaSearchTerm.trim()) {
      this.filteredEmpresas = [...this.empresas];
      return;
    }

    const term = this.empresaSearchTerm.toLowerCase().trim();
    this.filteredEmpresas = this.empresas.filter(
      (empresa) =>
        empresa.nombre.toLowerCase().includes(term) ||
        empresa.cuil.toString().includes(term) ||
        empresa.rubro.toLowerCase().includes(term)
    );
  }

  clearEmpresaSearch(): void {
    this.empresaSearchTerm = '';
    this.filteredEmpresas = [...this.empresas];
  }

  filterUsuarios(): void {
    if (!this.usuarioSearchTerm.trim()) {
      this.filteredUsuarios = [...this.usuarios];
      return;
    }

    const term = this.usuarioSearchTerm.toLowerCase().trim();
    this.filteredUsuarios = this.usuarios.filter((u) => {
      const empresaNombre = this.getEmpresaNombre(u.cuil).toLowerCase();
      return (
        u.nombre.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        empresaNombre.includes(term) || // 👈 ahora por nombre de empresa
        this.getUsuarioRoleLabel(u).toLowerCase().includes(term)
      );
    });
  }

  clearUsuarioSearch(): void {
    this.usuarioSearchTerm = '';
    this.filteredUsuarios = [...this.usuarios];
  }

  filterServicios(): void {
    if (!this.servicioSearchTerm.trim()) {
      this.filteredServicios = [...this.serviciosPolo];
      return;
    }

    const term = this.servicioSearchTerm.toLowerCase().trim();
    this.filteredServicios = this.serviciosPolo.filter((s) => {
      const empresaNombre = this.getEmpresaNombre(s.cuil).toLowerCase();
      return (
        s.nombre.toLowerCase().includes(term) ||
        empresaNombre.includes(term) || // 👈 nombre de empresa
        (s.propietario && s.propietario.toLowerCase().includes(term))
      );
    });
  }

  clearServicioSearch(): void {
    this.servicioSearchTerm = '';
    this.filteredServicios = [...this.serviciosPolo];
  }

  filterLotes(): void {
    if (!this.loteSearchTerm.trim()) {
      this.filteredLotes = [...this.lotes];
      return;
    }

    const term = this.loteSearchTerm.toLowerCase().trim();
    this.filteredLotes = this.lotes.filter(
      (lote) =>
        lote.dueno.toLowerCase().includes(term) ||
        lote.lote.toString().includes(term) ||
        lote.manzana.toString().includes(term) ||
        this.getServicioPoloNombre(lote.id_servicio_polo)
          .toLowerCase()
          .includes(term)
    );
  }

  clearLoteSearch(): void {
    this.loteSearchTerm = '';
    this.filteredLotes = [...this.lotes];
  }

  // Método para limpiar errores específicos
  clearFormErrors(formName: string): void {
    this.formErrors[formName] = [];
  }

  // Método para obtener errores de un campo específico
  getFieldErrors(formName: string, fieldName: string): FormError[] {
    return getFieldErrorsUtil(this.formErrors, formName, fieldName);
  }

  // Método para verificar si un campo tiene errores
  hasFieldError(formName: string, fieldName: string): boolean {
    return hasFieldErrorUtil(this.formErrors, formName, fieldName);
  }

  // Procesador de errores HTTP mejorado
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

    // Mostrar mensaje general
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

  // Traductor de errores de campos específicos
  private translateFieldError(
    field: string,
    message: string,
    formName: string
  ): string {
    const translations: Record<string, Record<string, string>> = {
      polo: {
        cant_empleados: 'La cantidad de empleados debe ser mayor a 0',
        horario_trabajo: 'El horario de trabajo es requerido',
      },
      empresa: {
        cuil: 'El CUIL debe tener formato válido',
        nombre: 'El nombre es requerido (mínimo 2 caracteres)',
        rubro: 'El rubro es requerido',
        cant_empleados: 'La cantidad de empleados debe ser mayor a 0',
        horario_trabajo: 'El horario de trabajo es requerido',
      },
      usuario: {
        email: 'El formato del email es inválido',
        nombre: 'El nombre de usuario es requerido',
        password: 'La contraseña debe tener al menos 6 caracteres',
        cuil: 'El CUIL de empresa es requerido',
        id_rol: 'Debe seleccionar un rol',
      },
      servicioPolo: {
        nombre: 'El nombre del servicio es requerido',
        cuil: 'El CUIL de empresa es requerido',
        propietario: 'Debe seleccionar el tipo de propietario',
        'datos.cant_puestos':
          'La cantidad de puestos es requerida para coworking',
        'datos.m2': 'Los metros cuadrados son requeridos',
      },
      lote: {
        dueno: 'El dueño del lote es requerido',
        lote: 'El número de lote debe ser mayor a 0',
        manzana: 'El número de manzana debe ser mayor a 0',
        id_servicio_polo: 'El ID del servicio polo es requerido',
      },
      password: {
        password: 'La contraseña debe tener al menos 6 caracteres',
        email: 'El email no fue encontrado en el sistema',
      },
    };

    const formTranslations = translations[formName];
    if (formTranslations && formTranslations[field]) {
      return formTranslations[field];
    }

    return GENERIC_FIELD_ERROR_TRANSLATIONS[message] || message;
  }

  // Traductor de errores genéricos
  private translateGenericError(detail: string, _formName: string): string {
    const translations: Record<string, string> = {
      'Ya existe una empresa con ese CUIL':
        'Ya existe una empresa registrada con ese CUIL',
      'Ya existe un usuario con ese email':
        'Ya existe un usuario registrado con ese email',
      'Usuario no encontrado': 'Usuario no encontrado en el sistema',
      'Email no registrado': 'El email no está registrado en el sistema',
      'Credenciales inválidas': 'Usuario o contraseña incorrectos',
      'Token inválido':
        'La sesión ha expirado, por favor inicie sesión nuevamente',
      'Polo no encontrado': 'El polo no fue encontrado',
      'Empresa no encontrada': 'La empresa no fue encontrada',
      'Servicio no encontrado': 'El servicio solicitado no existe',
      'Lote no encontrado': 'El lote solicitado no existe',
      'Rol inválido': 'El rol especificado no es válido',
      'Acceso denegado': 'No tiene permisos para realizar esta acción',
      'Datos inválidos': 'Los datos enviados contienen errores',
    };

    return translations[detail] || detail;
  }

  loadPoloData(): void {
    this.loading = true;
    this.clearFormErrors('general');

    this.adminPoloService.getPoloDetails().subscribe({
      next: (data) => {
        this.poloData = data;
        this.poloEditForm = {
          cant_empleados: data.cant_empleados,
          observaciones: data.observaciones || '',
          horario_trabajo: data.horario_trabajo,
        };
        this.rebuildEmpresaIndex();
        this.buildDashboardActivity();

        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar datos del polo');
        this.loading = false;
      },
    });
  }

  loadRoles(): void {
    this.adminPoloService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (error) => {
        console.error('Error loading roles:', error);
      },
    });
  }

  loadData(): void {
    this.loading = true;

    switch (this.activeTab) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'perfil':
        this.loading = false;
        break;
      case 'empresas':
        this.loadEmpresas();
        break;
      case 'usuarios':
        this.loadUsuarios();
        break;
      case 'servicios':
        this.loadServiciosPolo();
        break;
      case 'lotes':
        this.loadLotes();
        break;
      default:
        this.loading = false;
    }
  }

  private loadDashboardData(): void {
    if (this.dashboardDataLoaded) {
      this.buildDashboardActivity();
      this.loading = false;
      return;
    }

    forkJoin({
      empresas: this.adminPoloService.getEmpresas(),
      usuarios: this.adminPoloService.getUsers(),
      servicios: this.adminPoloService.getServiciosPolo(),
      lotes: this.adminPoloService.getLotes(),
    }).subscribe({
      next: ({ empresas, usuarios, servicios, lotes }) => {
        this.empresas = empresas;
        this.usuarios = usuarios;
        this.serviciosPolo = servicios;
        this.lotes = lotes;

        this.rebuildEmpresaIndex();
        this.rebuildServicioPoloIndex();

        this.filterEmpresas();
        this.filterUsuarios();
        this.filterServicios();
        this.filterLotes();

        this.dashboardDataLoaded = true;
        this.buildDashboardActivity();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar resumen del polo');
        this.loading = false;
      },
    });
  }

  // ====== ACTIVIDAD EN TIEMPO REAL ======
  // Igual que en admin-empresa: buildDashboardActivity() reconstruye desde
  // los datos (fecha de creacion), que no cambia si solo editas/activas algo
  // ya existente. pushActivity() registra la accion real en el momento en
  // que pasa, para que se vea arriba de todo aunque el registro sea viejo.
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

  private pushActivity(
    tipo: 'ok' | 'warn' | 'info',
    titulo: string,
    cuando: string = this.formatActivityMoment(new Date().toISOString())
  ): void {
    this.manualActivities.unshift({
      tipo,
      titulo,
      cuando,
      timestamp: Date.now(),
    });
    this.pruneManualActivities();
    this.combineActivities(this.lastBuiltActivities);
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
  }

  private buildDashboardActivity(): void {
    const toActividad = (
      tipo: 'ok' | 'warn' | 'info',
      titulo: string,
      item: any
    ) => ({
      tipo,
      titulo,
      cuando: this.getActivityLabel(item),
      timestamp: this.getItemTimestamp(item),
    });

    const empresasAct = [...this.empresas]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((empresa) => {
        const estadoLabel = empresa.estado ? 'activa' : 'inactiva';
        const tipo = empresa.estado ? 'ok' : ('warn' as const);
        return toActividad(tipo, `Empresa ${empresa.nombre} ${estadoLabel}`, empresa);
      });

    const usuariosAct = [...this.usuarios]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((usuario) => {
        const estadoLabel = usuario.estado ? 'habilitado' : 'inhabilitado';
        const tipo = usuario.estado ? 'ok' : ('warn' as const);
        return toActividad(tipo, `Usuario ${usuario.nombre} ${estadoLabel}`, usuario);
      });

    // ServicioPolo y Lote no tienen ningun campo de fecha propio en la base,
    // asi que sin esto siempre calculaban timestamp 0 y quedaban al final de
    // la lista sin importar cuando se hayan creado en verdad. Se les asigna
    // como fecha la de la empresa dueña (dato real: se cargaron junto con
    // ella en la misma importacion), no una fecha inventada.
    const serviciosAct = [...this.serviciosPolo]
      .map((servicio) => ({
        ...servicio,
        fecha_ingreso: (servicio as any).fecha_ingreso ?? this.getEmpresaFecha(servicio.cuil),
      }))
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((servicio) =>
        toActividad(
          'info',
          `Servicio ${
            servicio.nombre || servicio.tipo_servicio_polo || ''
          } actualizado`,
          servicio
        )
      );

    const lotesAct = [...this.lotes]
      .map((lote) => {
        const servicioPolo = this.serviciosPolo.find(
          (s) => s.id_servicio_polo === lote.id_servicio_polo
        );
        return {
          ...lote,
          fecha_ingreso: servicioPolo ? this.getEmpresaFecha(servicioPolo.cuil) : undefined,
        };
      })
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .map((lote) =>
        toActividad('info', `Lote M${lote.manzana} - ${lote.lote} actualizado`, lote)
      );

    // Se entrelazan las categorías (en vez de concatenarlas una atrás de la
    // otra) antes de ordenar por fecha: como varios registros comparten la
    // misma fecha (solo hay granularidad de día, no de hora), un sort
    // estable sobre una lista concatenada dejaba bloques enteros de un
    // mismo tipo juntos. Entrelazando primero, esos empates quedan
    // mezclados en vez de agrupados.
    const entrelazadas = this.interleaveActividades([
      empresasAct,
      usuariosAct,
      serviciosAct,
      lotesAct,
    ]).map((a) => ({ ...a, cuando: a.cuando || '-' }));

    this.lastBuiltActivities = entrelazadas;
    this.combineActivities(entrelazadas);
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

  private getActivityLabel(item: any): string {
    const raw = this.getItemDateSource(item);
    return this.formatActivityMoment(raw ?? undefined);
  }

  private getEmpresaFecha(cuil: number | undefined | null): string | undefined {
    if (cuil === undefined || cuil === null) return undefined;
    return this.empresas.find((e) => e.cuil === cuil)?.fecha_ingreso;
  }

  private getItemDateSource(item: any): string | null {
    if (!item) return null;
    return (
      item.updated_at ??
      item.created_at ??
      item.fecha_ingreso ??
      item.fecha_registro ??
      item.fecha ??
      null
    );
  }

  private getItemTimestamp(item: any): number {
    const raw = this.getItemDateSource(item);
    if (!raw) return 0;
    const date = new Date(raw);
    const value = date.getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  private formatActivityMoment(raw?: string): string {
    return formatActivityMomentUtil(raw);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      const value = date.getTime();
      if (Number.isNaN(value)) return '-';
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  }

  loadEmpresas(): void {
    this.adminPoloService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.filteredEmpresas = [...empresas];
        this.filterEmpresas();
        this.rebuildEmpresaIndex();
        this.buildDashboardActivity();

        this.loading = false;
      },

      error: (error) => {
        this.handleError(error, 'general', 'cargar empresas');
        this.loading = false;
      },
    });
  }

  loadUsuarios(): void {
    this.adminPoloService.getUsers().subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios;
        this.filteredUsuarios = [...usuarios];
        this.filterUsuarios();
        this.buildDashboardActivity();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar usuarios');
        this.loading = false;
      },
    });
  }

  loadServiciosPolo(): void {
    this.adminPoloService.getServiciosPolo().subscribe({
      next: (servicios) => {
        this.serviciosPolo = servicios;
        this.filteredServicios = [...servicios];
        this.rebuildServicioPoloIndex();
        this.filterServicios();
        this.buildDashboardActivity();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar servicios del polo');
        this.loading = false;
      },
    });
  }

  loadLotes(): void {
    this.adminPoloService.getLotes().subscribe({
      next: (lotes) => {
        this.lotes = lotes;
        this.filteredLotes = [...lotes];
        this.filterLotes();
        this.buildDashboardActivity();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'general', 'cargar lotes');
        this.loading = false;
      },
    });
  }

  // Método resetForms sin confirmación (usado al enviar exitosamente)
  resetForms(): void {
    this.showPasswordForm = false;
    this.showPoloEditForm = false;
    this.showEmpresaForm = false;
    this.showUsuarioForm = false;
    this.showServicioPoloForm = false;
    this.showLoteForm = false;
    this.editingEmpresa = null;
    this.editingUsuario = null;
    this.selectedEmpresa = null;
    this.creatingForEmpresa = false;

    this.submitting = {
      polo: false,
      empresa: false,
      usuario: false,
      servicioPolo: false,
      lote: false,
    };

    // Limpiar errores de todos los formularios
    this.formErrors = {};

    // Resetear formularios
    this.passwordForm = { password: '', confirmPassword: '' };

    this.empresaForm = {
      cuil: 0,
      nombre: '',
      rubro: '',
      cant_empleados: 0,
      observaciones: '',
      horario_trabajo: '',
      estado: true,
    };
    this.empresaEstadoActual = null; // ← NUEVO

    this.usuarioForm = {
      email: '',
      nombre: '',
      password: '',
      estado: true,
      cuil: null as any,
      id_rol: null as any,
    };

    this.servicioPoloForm = {
      nombre: '',
      horario: '',
      datos: {
        cant_puestos: null,
        m2: null,
        datos_prop: { nombre: '', contacto: '' },
        datos_inquilino: { nombre: '', contacto: '' },
      },
      propietario: '',
      id_tipo_servicio_polo: 1,
      cuil: 0,
    };

    this.loteForm = {
      dueno: '',
      lote: 0,
      manzana: 0,
      id_servicio_polo: 0,
    };

    // Limpiar estados de cambios
    this.changes.clearAll();
  }

  showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
    }, 5000);
  }

  openPasswordForm(): void {
    this.clearFormErrors('password');
    this.showPasswordForm = true;
    // No necesitamos saveInitialFormState aquí porque el modal maneja su propio estado
  }

  // POLO EDIT
  openPoloEditForm(): void {
    this.clearFormErrors('polo');
    this.showPoloEditForm = true;

    // IMPORTANTE: Guardar el estado inicial DESPUÉS de mostrar el formulario
    setTimeout(() => {
      this.changes.save('polo', this.poloEditForm);
    }, 0);
  }
  activarEmpresa(cuil: number): void {
    if (!confirm('¿Activar esta empresa y sus registros relacionados?')) return;
    this.adminPoloService.activarEmpresa(cuil).subscribe({
      next: () => {
        this.showMessage('Empresa activada correctamente', 'success');
        this.loadEmpresas();
      },
      error: (err) => this.handleError(err, 'general', 'activar empresa'),
    });
  }

  desactivarEmpresa(cuil: number): void {
    if (!confirm('¿Desactivar esta empresa y sus registros relacionados?'))
      return;
    this.adminPoloService.desactivarEmpresa(cuil).subscribe({
      next: () => {
        this.showMessage('Empresa desactivada correctamente', 'success');
        this.loadEmpresas();
      },
      error: (err) => this.handleError(err, 'general', 'desactivar empresa'),
    });
  }

  onSubmitPoloEdit(): void {
    this.loading = true;
    this.clearFormErrors('polo');
    this.submitting.polo = true;

    this.adminPoloService.updatePolo(this.poloEditForm).subscribe({
      next: () => {
        this.showMessage('Datos del polo actualizados exitosamente', 'success');
        this.pushActivity('info', 'Datos del Polo actualizados');
        this.loadPoloData();
        this.resetForms();
        this.loading = false;
        this.submitting.polo = false;
      },
      error: (error) => {
        this.handleError(error, 'polo', 'actualizar datos del polo');
        this.loading = false;
        this.submitting.polo = false;
      },
    });
  }

  formatBoolean(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? 'Si' : 'No';
    }
    const normalized = `${value}`.trim().toLowerCase();
    if (['true', '1', 'si', 'yes'].includes(normalized)) {
      return 'Si';
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return 'No';
    }
    return `${value}`;
  }

  // ===== Informacion comercial del Polo (carga/edicion directa, sin wizard) =====
  loadComercialInfo(): void {
    this.comercialLoadingInfo = true;
    this.adminPoloService.getComercialInfo().subscribe({
      next: (data) => {
        this.comercialInfo = data;
        this.comercialLoadingInfo = false;
      },
      error: () => {
        // 404 = todavia no se cargo nada: es un estado valido, no un error.
        this.comercialInfo = null;
        this.comercialLoadingInfo = false;
      },
    });
  }

  openComercialEditForm(): void {
    this.clearFormErrors('comercial');
    const info = this.comercialInfo;
    this.comercialEditForm = {
      productos_servicios: info?.productos_servicios || '',
      publico_objetivo: info?.publico_objetivo || '',
      atiende_publico: info?.atiende_publico ?? null,
      horario_atencion_comercial: info?.horario_atencion_comercial || '',
      rango_precios: info?.rango_precios || '',
      modalidad_venta: info?.modalidad_venta || '',
      marcas_representadas: info?.marcas_representadas || '',
      certificaciones: info?.certificaciones || '',
      observaciones_comerciales: info?.observaciones_comerciales || '',
    };
    this.showComercialEditForm = true;
  }

  cancelComercialEditForm(): void {
    this.showComercialEditForm = false;
    this.clearFormErrors('comercial');
  }

  submitComercialEdit(): void {
    this.comercialSaving = true;
    this.adminPoloService
      .updateComercialInfo(this.comercialEditForm)
      .subscribe({
        next: (data) => {
          this.comercialInfo = data;
          this.showComercialEditForm = false;
          this.comercialSaving = false;
          this.showMessage(
            'Informacion comercial actualizada exitosamente',
            'success'
          );
          this.pushActivity('ok', 'Informacion comercial del Polo actualizada');
        },
        error: (error) => {
          this.handleError(error, 'comercial', 'actualizar informacion comercial');
          this.comercialSaving = false;
        },
      });
  }

  // EMPRESAS
  openEmpresaForm(empresa?: Empresa): void {
    this.clearFormErrors('empresa');

    if (empresa) {
      this.editingEmpresa = empresa;
      this.empresaForm = {
        cuil: empresa.cuil,
        nombre: empresa.nombre,
        rubro: empresa.rubro,
        cant_empleados: empresa.cant_empleados,
        observaciones: empresa.observaciones || '',
        horario_trabajo: empresa.horario_trabajo,
        estado: empresa.estado,
      };
      this.empresaEstadoActual = empresa.estado ?? null; // ← NUEVO
    } else {
      this.editingEmpresa = null;
      this.empresaForm = {
        cuil: 0,
        nombre: '',
        rubro: '',
        cant_empleados: 0,
        observaciones: '',
        horario_trabajo: '',
        estado: true,
      };
      this.empresaEstadoActual = null; // ← NUEVO
    }

    this.showEmpresaForm = true;

    // IMPORTANTE: Guardar estado después de configurar el formulario
    setTimeout(() => {
      this.changes.save('empresa', this.empresaForm);
    }, 0);
  }

  onSubmitEmpresa(): void {
    this.loading = true;
    this.clearFormErrors('empresa');
    this.submitting.empresa = true;

    if (this.editingEmpresa) {
      // Actualizar
      const updateData: EmpresaUpdate = {
        nombre: this.empresaForm.nombre,
        rubro: this.empresaForm.rubro,
        estado: this.empresaForm.estado,
        cant_empleados: this.empresaForm.cant_empleados,
        observaciones: this.empresaForm.observaciones,
        horario_trabajo: this.empresaForm.horario_trabajo,
      };

      this.adminPoloService
        .updateEmpresa(this.editingEmpresa.cuil, updateData)
        .subscribe({
          next: () => {
            this.showMessage('Empresa actualizada exitosamente', 'success');
            this.pushActivity('ok', `Empresa ${this.empresaForm.nombre} actualizada`);
            this.loadEmpresas();
            this.resetForms();
            this.loading = false;
            this.submitting.empresa = false;
          },
          error: (error) => {
            this.handleError(error, 'empresa', 'actualizar empresa');
            this.loading = false;
            this.submitting.empresa = false;
          },
        });
    } else {
      // Crear
      this.adminPoloService.createEmpresa(this.empresaForm).subscribe({
        next: () => {
          this.showMessage('Empresa creada exitosamente', 'success');
          this.pushActivity('ok', `Empresa ${this.empresaForm.nombre} creada`);
          this.loadEmpresas();
          this.resetForms();
          this.loading = false;
          this.submitting.empresa = false;
        },
        error: (error) => {
          this.handleError(error, 'empresa', 'crear empresa');
          this.loading = false;
          this.submitting.empresa = false;
        },
      });
    }
  }

  deleteEmpresa(cuil: number): void {
    if (confirm('¿Está seguro de que desea eliminar esta empresa?')) {
      const nombre = this.empresas.find((e) => e.cuil === cuil)?.nombre || 'Empresa';
      this.adminPoloService.deleteEmpresa(cuil).subscribe({
        next: () => {
          this.showMessage('Empresa eliminada exitosamente', 'success');
          this.pushActivity('warn', `${nombre} eliminada`);
          this.loadEmpresas();
        },
        error: (error) => {
          this.handleError(error, 'general', 'eliminar empresa');
        },
      });
    }
  }

  // USUARIOS
  openUsuarioForm(usuario?: Usuario): void {
    this.clearFormErrors('usuario');
    this.submitting.usuario = false; // ← importante

    if (usuario) {
      this.editingUsuario = usuario;
      this.usuarioForm = {
        email: usuario.email,
        nombre: usuario.nombre,
        password: '',
        estado: usuario.estado,
        cuil: usuario.cuil,
        id_rol: 0, // Los roles no se editan en usuarios existentes
      };
    } else {
      this.editingUsuario = null;
      this.usuarioForm = {
        email: '',
        nombre: '',
        password: '',
        estado: true,
        cuil: null as any,
        id_rol: null as any,
      };
    }

    this.showUsuarioForm = true;

    // IMPORTANTE: Guardar estado después de configurar el formulario
    setTimeout(() => {
      this.changes.save('usuario', this.usuarioForm);
    }, 0);
  }

  onSubmitUsuario(): void {
    this.loading = true;
    this.clearFormErrors('usuario');

    if (this.editingUsuario) {
      // (update) — opcional: también podrías mostrar busy si lo querés en update
      const updateData: UsuarioUpdate = {
        password: this.usuarioForm.password || undefined,
        estado: this.usuarioForm.estado,
      };
      this.submitting.usuario = true; // si también querés bloquear durante update
      this.adminPoloService
        .updateUser(this.editingUsuario.id_usuario, updateData)
        .subscribe({
          next: () => {
            this.showMessage('Usuario actualizado exitosamente', 'success');
            this.pushActivity('ok', `Usuario ${this.usuarioForm.nombre} actualizado`);
            this.loadUsuarios();
            this.resetForms();
            this.loading = false;
            this.submitting.usuario = false;
          },
          error: (error) => {
            this.handleError(error, 'usuario', 'actualizar usuario');
            this.loading = false;
            this.submitting.usuario = false;
          },
        });
    } else {
      // Crear nuevo usuario
      const userCreateData = {
        email: this.usuarioForm.email,
        nombre: this.usuarioForm.nombre,
        estado: this.usuarioForm.estado,
        cuil: this.usuarioForm.cuil,
        id_rol: this.usuarioForm.id_rol,
      };

      this.submitting.usuario = true; // ← 🔒 bloquea el modal
      this.adminPoloService.createUser(userCreateData).subscribe({
        next: () => {
          this.showMessage(
            'Usuario creado. Enviamos las credenciales por email. Esto puede demorar unos minutos.',
            'success'
          );
          this.pushActivity('ok', `Usuario ${this.usuarioForm.nombre} creado`);
          this.loadUsuarios();
          this.resetForms();
          this.loading = false;
          this.submitting.usuario = false; // (por si el modal quedara abierto por algún flujo)
        },
        error: (error) => {
          this.handleError(error, 'usuario', 'crear usuario');
          this.loading = false;
          this.submitting.usuario = false; // ← siempre liberar
        },
      });
    }
  }

  toggleUsuarioEstado(usuario: Usuario): void {
    const accion = usuario.estado ? 'inhabilitar' : 'habilitar';
    const participio = usuario.estado ? 'inhabilitado' : 'habilitado';
    const nuevoEstado = !usuario.estado;

    if (confirm(`¿Está seguro de que desea ${accion} este usuario?`)) {
      const updateData: UsuarioUpdate = {
        estado: nuevoEstado,
      };

      this.adminPoloService
        .updateUser(usuario.id_usuario, updateData)
        .subscribe({
          next: (usuarioActualizado) => {
            // Actualizar el usuario en la lista local
            const index = this.usuarios.findIndex(
              (u) => u.id_usuario === usuario.id_usuario
            );
            if (index !== -1) {
              this.usuarios[index] = usuarioActualizado;
            }

            // Actualizar también en la lista filtrada
            const filteredIndex = this.filteredUsuarios.findIndex(
              (u) => u.id_usuario === usuario.id_usuario
            );
            if (filteredIndex !== -1) {
              this.filteredUsuarios[filteredIndex] = usuarioActualizado;
            }

            this.showMessage(`Usuario ${participio} exitosamente`, 'success');
            this.pushActivity(
              nuevoEstado ? 'ok' : 'warn',
              `Usuario ${usuario.nombre} ${participio}`
            );
          },
          error: (error) => {
            this.handleError(error, 'general', `${accion} usuario`);
          },
        });
    }
  }

  // SERVICIOS DEL POLO
  openServicioPoloForm(): void {
    this.clearFormErrors('servicioPolo');
    this.showServicioPoloForm = true;

    // IMPORTANTE: Guardar estado después de configurar el formulario
    setTimeout(() => {
      this.changes.save('servicioPolo', this.servicioPoloForm);
    }, 0);
  }

  isCantPuestosRequired(): boolean {
    return this.servicioPoloForm.id_tipo_servicio_polo === 1;
  }

  isM2Required(): boolean {
    return this.servicioPoloForm.id_tipo_servicio_polo !== 1;
  }

  onSubmitServicioPolo(): void {
    this.loading = true;
    this.clearFormErrors('servicioPolo');

    const tipo = this.servicioPoloForm.id_tipo_servicio_polo;
    const datos = this.servicioPoloForm.datos || {};

    // Validaciones manuales
    if (tipo === 1 && (!datos.cant_puestos || datos.cant_puestos <= 0)) {
      this.handleError(
        {
          error: {
            detail: 'Debe ingresar la cantidad de puestos para coworking.',
          },
        },
        'servicioPolo',
        'validar servicio polo'
      );
      this.loading = false;
      return;
    }

    if (tipo !== 1 && (!datos.m2 || datos.m2 <= 0)) {
      this.handleError(
        {
          error: {
            detail:
              'Debe ingresar los metros cuadrados para este tipo de servicio.',
          },
        },
        'servicioPolo',
        'validar servicio polo'
      );
      this.loading = false;
      return;
    }

    this.submitting.servicioPolo = true;
    this.adminPoloService.createServicioPolo(this.servicioPoloForm).subscribe({
      next: () => {
        this.showMessage('Servicio del polo creado exitosamente', 'success');
        this.pushActivity('ok', `Servicio ${this.servicioPoloForm.nombre} creado`);
        this.loadServiciosPolo();
        this.resetForms();
        this.loading = false;
        this.submitting.servicioPolo = false;
      },
      error: (error) => {
        this.handleError(error, 'servicioPolo', 'crear servicio del polo');
        this.loading = false;
        this.submitting.servicioPolo = false;
      },
    });
  }

  onTipoServicioChange(): void {
    if (!this.servicioPoloForm.datos) {
      this.servicioPoloForm.datos = {};
    }

    this.servicioPoloForm.datos.cant_puestos = null;
    this.servicioPoloForm.datos.m2 = null;
  }

  onPropietarioChange(): void {
    const tipo = this.servicioPoloForm.propietario;
    if (!this.servicioPoloForm.datos) {
      this.servicioPoloForm.datos = {};
    }

    if (tipo === 'propietario') {
      this.servicioPoloForm.datos.datos_prop = { nombre: '', contacto: '' };
      delete this.servicioPoloForm.datos.datos_inquilino;
    } else if (tipo === 'inquilino') {
      this.servicioPoloForm.datos.datos_inquilino = {
        nombre: '',
        contacto: '',
      };
      delete this.servicioPoloForm.datos.datos_prop;
    } else {
      delete this.servicioPoloForm.datos.datos_prop;
      delete this.servicioPoloForm.datos.datos_inquilino;
    }
  }

  deleteServicioPolo(id: number): void {
    if (confirm('¿Está seguro de que desea eliminar este servicio del polo?')) {
      const nombre =
        this.serviciosPolo.find((s) => s.id_servicio_polo === id)?.nombre ||
        'Servicio del polo';
      this.adminPoloService.deleteServicioPolo(id).subscribe({
        next: () => {
          this.showMessage(
            'Servicio del polo eliminado exitosamente',
            'success'
          );
          this.pushActivity('warn', `Servicio ${nombre} eliminado`);
          this.loadServiciosPolo();
        },
        error: (error) => {
          this.handleError(error, 'general', 'eliminar servicio del polo');
        },
      });
    }
  }

  // LOTES
  selectedServicioPoloId: number | null = null;

  openLoteForm(idServicioPolo: number, nombreServicio?: string): void {
    this.clearFormErrors('lote');
    this.selectedServicioPoloId = idServicioPolo;
    this.nombreServicioSeleccionado =
      nombreServicio || `Servicio ID: ${idServicioPolo}`;

    this.loteForm = {
      dueno: '',
      lote: 0,
      manzana: 0,
      id_servicio_polo: idServicioPolo,
    };

    this.showLoteForm = true;

    // IMPORTANTE: Guardar estado después de configurar el formulario
    setTimeout(() => {
      this.changes.save('lote', this.loteForm);
    }, 0);
  }

  onSubmitLote(): void {
    this.loading = true;
    this.clearFormErrors('lote');

    if (this.selectedServicioPoloId !== null) {
      this.loteForm.id_servicio_polo = this.selectedServicioPoloId;
    }

    this.submitting.lote = true;
    this.adminPoloService.createLote(this.loteForm).subscribe({
      next: () => {
        this.showMessage('Lote creado exitosamente', 'success');
        this.pushActivity(
          'ok',
          `Lote M${this.loteForm.manzana} - ${this.loteForm.lote} creado`
        );
        this.loadLotes();
        this.resetForms();
        this.loading = false;
        this.submitting.lote = false;
      },
      error: (error) => {
        this.handleError(error, 'lote', 'crear lote');
        this.loading = false;
        this.submitting.lote = false;
      },
    });
  }

  deleteLote(id: number): void {
    if (confirm('¿Está seguro de que desea eliminar este lote?')) {
      const lote = this.lotes.find((l) => l.id_lotes === id);
      const nombre = lote ? `M${lote.manzana} - ${lote.lote}` : 'Lote';
      this.adminPoloService.deleteLote(id).subscribe({
        next: () => {
          this.showMessage('Lote eliminado exitosamente', 'success');
          this.pushActivity('warn', `Lote ${nombre} eliminado`);
          this.loadLotes();
        },
        error: (error) => {
          this.handleError(error, 'general', 'eliminar lote');
        },
      });
    }
  }

  getRoleName(id: number): string {
    const rol = this.roles.find((r) => r.id_rol === id);
    return rol ? this.formatRoleDisplay(rol.tipo_rol) : 'Desconocido';
  }

  getUsuarioRoleLabel(usuario: Usuario): string {
    const rol = this.getUsuarioPrimaryRole(usuario);
    if (!rol) return 'Sin rol';

    switch (rol.tipo_rol) {
      case 'admin_polo':
        return 'Polo 52';
      case 'admin_empresa':
        return 'Empresa';
      case 'publico':
        return 'Público';
      default:
        return 'Sin rol';
    }
  }

  getUsuarioRoleBadgeClass(usuario: Usuario): string {
    const rol = this.getUsuarioPrimaryRole(usuario);
    if (!rol) return 'badge--rol-default';

    switch (rol.tipo_rol) {
      case 'admin_polo':
        return 'badge--rol-admin-polo';
      case 'admin_empresa':
        return 'badge--rol-admin-empresa';
      case 'publico':
        return 'badge--rol-publico';
      default:
        return 'badge--rol-default';
    }
  }

  private getUsuarioPrimaryRole(usuario: Usuario): Rol | null {
    if (usuario?.roles && usuario.roles.length > 0) {
      return usuario.roles[0];
    }
    return null;
  }

  private formatRoleDisplay(value: string): string {
    return value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  createUsuarioForEmpresa(empresa: Empresa): void {
    this.selectedEmpresa = empresa;
    this.creatingForEmpresa = true;
    this.usuarioForm = {
      email: '',
      nombre: '',
      password: '',
      estado: true,
      cuil: empresa.cuil,
      id_rol: 0,
    };
    this.showUsuarioForm = true;

    // IMPORTANTE: Guardar estado después de configurar el formulario
    setTimeout(() => {
      this.changes.save('usuario', this.usuarioForm);
    }, 0);
  }

  createServicioPoloForEmpresa(empresa: Empresa): void {
    this.selectedEmpresa = empresa;
    this.creatingForEmpresa = true;
    this.servicioPoloForm = {
      nombre: '',
      horario: '',
      datos: {
        cant_puestos: null,
        m2: null,
        datos_prop: { nombre: '', contacto: '' },
        datos_inquilino: { nombre: '', contacto: '' },
      },
      propietario: '',
      id_tipo_servicio_polo: 1,
      cuil: empresa.cuil,
    };
    this.showServicioPoloForm = true;

    // IMPORTANTE: Guardar estado después de configurar el formulario
    setTimeout(() => {
      this.changes.save('servicioPolo', this.servicioPoloForm);
    }, 0);
  }

  openPasswordModal() {
    this.showPasswordModal = true;
  }

  onPasswordModalClosed() {
    this.showPasswordModal = false;
  }

  onPasswordChanged(success: boolean) {
    if (success) {
      this.showMessage('Contraseña actualizada exitosamente.', 'success'); // 👈 NUEVO
    }
    this.showPasswordModal = false;
  }

  confirmAndSubmit(
    kind: 'polo' | 'empresa' | 'usuario' | 'servicioPolo' | 'lote' | 'comercial',
    formRef: NgForm
  ) {
    // 1) Si el form es inválido, marco controles y corto
    if (!formRef || formRef.invalid) {
      Object.values(formRef.controls ?? {}).forEach((c: any) =>
        c?.markAsTouched?.()
      );
      return;
    }
    // dentro de confirmAndSubmit(...)
    if (!formRef || formRef.invalid) {
      Object.values(formRef.controls ?? {}).forEach((c: any) =>
        c?.markAsTouched?.()
      );
      this.showMessage(
        'Revisá los campos obligatorios e intentá de nuevo.',
        'error'
      ); // 👈 NUEVO
      return;
    }

    // 2) Mensaje específico según modal
    const verbos: Record<typeof kind, string> = {
      polo: 'guardar cambios del Polo',
      empresa: this.editingEmpresa
        ? 'actualizar la empresa'
        : 'crear la empresa',
      usuario: this.editingUsuario
        ? 'actualizar el usuario'
        : 'crear el usuario',
      servicioPolo: 'crear el servicio del Polo',
      lote: 'agregar el lote',
      comercial: 'guardar la informacion comercial',
    };

    const ok = window.confirm(
      `¿Querés ${verbos[kind]} ahora?\n\n• Aceptar: agregar/guardar\n• Cancelar: seguir editando`
    );
    if (!ok) return;

    // 3) Llamo al submit real existente
    switch (kind) {
      case 'polo':
        this.onSubmitPoloEdit();
        break;
      case 'empresa':
        this.onSubmitEmpresa();
        break;
      case 'usuario':
        this.onSubmitUsuario();
        break;
      case 'servicioPolo':
        this.onSubmitServicioPolo();
        break;
      case 'lote':
        this.onSubmitLote();
        break;
      case 'comercial':
        this.submitComercialEdit();
        break;
    }
  }

  // --- EMPRESAS ---
  private horarioEmpState: Record<number, boolean> = {};
  isHorarioEmpExpanded(cuil: number): boolean {
    return !!this.horarioEmpState[cuil];
  }
  toggleHorarioEmp(cuil: number): void {
    this.horarioEmpState[cuil] = !this.horarioEmpState[cuil];
  }

  // --- SERVICIOS DEL POLO ---
  private horarioServState: Record<number, boolean> = {};
  isHorarioServExpanded(idServ: number): boolean {
    return !!this.horarioServState[idServ];
  }
  toggleHorarioServ(idServ: number): void {
    this.horarioServState[idServ] = !this.horarioServState[idServ];
  }

  toggleEmpresaEstado(empresa: Empresa): void {
    const accion = empresa.estado ? 'desactivar' : 'activar';
    const confirmar = confirm(
      `¿Seguro que deseas ${accion} la empresa "${empresa.nombre}"?`
    );

    if (!confirmar) return;

    if (empresa.estado) {
      // Desactivar
      this.adminPoloService.desactivarEmpresa(empresa.cuil).subscribe({
        next: () => {
          this.showMessage('Empresa desactivada correctamente', 'success');
          this.pushActivity('warn', `Empresa ${empresa.nombre} desactivada`);
          this.loadEmpresas(); // recarga la lista
        },
        error: (error) => {
          this.handleError(error, 'general', 'desactivar empresa');
        },
      });
    } else {
      // Activar
      this.adminPoloService.activarEmpresa(empresa.cuil).subscribe({
        next: () => {
          this.showMessage('Empresa activada correctamente', 'success');
          this.pushActivity('ok', `Empresa ${empresa.nombre} activada`);
          this.loadEmpresas();
        },
        error: (error) => {
          this.handleError(error, 'general', 'activar empresa');
        },
      });
    }
  }
}
