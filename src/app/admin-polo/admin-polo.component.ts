import { Component, OnInit } from '@angular/core';
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
} from './admin-polo.service';
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
  showPasswordModal = false;

  activeTab: AdminPoloTab = 'dashboard';

  private readonly MAX_ACTIVIDADES = 6;
  private dashboardDataLoaded = false;
  actividadReciente: Array<{
    tipo: 'ok' | 'warn' | 'info';
    titulo: string;
    cuando: string;
  }> = [];

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

  // PROPIEDADES PARA CONTROL DE CAMBIOS - MEJORADO
  private initialForms: { [key: string]: any } = {};
  private hasUnsavedChanges: { [key: string]: boolean } = {};
  private empresaNombrePorCuil: Record<number, string> = {};
  private servicioNombrePorId: Record<number, string> = {};

  // Sistema de errores mejorado
  formErrors: { [key: string]: FormError[] } = {};

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
  nombreServicioSeleccionado: string = '';

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
  empresaSearchTerm: string = '';
  usuarioSearchTerm: string = '';
  servicioSearchTerm: string = '';
  loteSearchTerm: string = '';

  // Arrays filtrados
  filteredEmpresas: Empresa[] = [];
  filteredUsuarios: Usuario[] = [];
  filteredServicios: ServicioPolo[] = [];
  filteredLotes: Lote[] = [];

  constructor(private adminPoloService: AdminPoloService) {}

  public isDarkMode: boolean = false;

  ngOnInit(): void {
    this.loadRoles();
    this.loadPoloData();
    this.loadData();
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme === 'dark';
    this.applyThemeClass();
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.applyThemeClass();
  }

  private applyThemeClass(): void {
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
    this.initialForms = {};
    this.hasUnsavedChanges = {};
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
  // 1. MÉTODO PARA GUARDAR ESTADO INICIAL MEJORADO
  private saveInitialFormState(formName: string, formData: any): void {
    // Crear copia profunda inmediatamente
    this.initialForms[formName] = JSON.parse(JSON.stringify(formData));
    this.hasUnsavedChanges[formName] = false;

    console.log(
      `Estado inicial guardado para ${formName}:`,
      this.initialForms[formName]
    );
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

  // MÉTODO PARA RESTAURAR DATOS ORIGINALES
  private restoreOriginalFormData(formName: string): void {
    console.log(`Restaurando datos para ${formName}`);

    if (!this.initialForms[formName]) {
      console.error('No hay datos iniciales guardados para', formName);
      return;
    }

    // Crear copia profunda de los datos originales
    const originalData = JSON.parse(
      JSON.stringify(this.initialForms[formName])
    );
    console.log('Datos originales a restaurar:', originalData);

    switch (formName) {
      case 'polo':
        this.poloEditForm = {
          cant_empleados: originalData.cant_empleados,
          observaciones: originalData.observaciones,
          horario_trabajo: originalData.horario_trabajo,
        };
        console.log('Polo restaurado:', this.poloEditForm);
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
        console.log('Empresa restaurada:', this.empresaForm);
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
        console.log('Usuario restaurado:', this.usuarioForm);
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
        console.log('Servicio Polo restaurado:', this.servicioPoloForm);
        break;

      case 'lote':
        this.loteForm = {
          dueno: originalData.dueno,
          lote: originalData.lote,
          manzana: originalData.manzana,
          id_servicio_polo: originalData.id_servicio_polo,
        };
        console.log('Lote restaurado:', this.loteForm);
        break;

      case 'password':
        this.passwordForm = {
          password: originalData.password,
          confirmPassword: originalData.confirmPassword,
        };
        console.log('Password restaurado:', this.passwordForm);
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

    console.log(`Cancelando formulario ${formName}`);
    console.log('Datos actuales:', currentFormData);
    console.log('Datos iniciales guardados:', this.initialForms[formName]);

    // Verificar si hay cambios sin guardar
    const hasChanges = this.checkUnsavedChanges(formName, currentFormData);
    console.log('¿Hay cambios?', hasChanges);

    if (this.isModalBusy(formName as any)) {
      alert('Hay una operación en curso. Por favor esperá a que finalice.');
      return;
    }
    // dentro de cancelForm(formName)
    if (hasChanges) {
      const shouldDiscard = confirm(/* ... */);
      if (!shouldDiscard) return;

      this.restoreOriginalFormData(formName);
      this.showMessage('Cambios descartados.', 'success'); // 👈 NUEVO (usamos success como “info”)
    }

    if (hasChanges) {
      const shouldDiscard = confirm(
        '¿Deseas descartar los cambios?\n\n' +
          'Se perderán todos los cambios no guardados.\n\n' +
          'Presiona "Aceptar" para descartar o "Cancelar" para continuar editando.'
      );

      console.log('Usuario eligió descartar:', shouldDiscard);

      if (!shouldDiscard) {
        return; // Usuario decide continuar editando
      }

      // Restaurar datos originales ANTES de cerrar
      console.log('Restaurando datos originales...');
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
    delete this.initialForms[formName];
    delete this.hasUnsavedChanges[formName];

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
    const errors = this.formErrors[formName] || [];
    return errors.filter((error) => error.field === fieldName);
  }

  // Método para verificar si un campo tiene errores
  hasFieldError(formName: string, fieldName: string): boolean {
    return this.getFieldErrors(formName, fieldName).length > 0;
  }

  // Procesador de errores HTTP mejorado
  private handleError(error: any, formName: string, operation: string): void {
    console.error(`Error en ${operation}:`, error);

    this.clearFormErrors(formName);
    let errorMessages: FormError[] = [];

    if (error.status === 0) {
      errorMessages.push({
        field: 'general',
        message: 'Error de conexión. Verifique su conexión a internet.',
        type: 'server',
      });
    } else if (error.status === 401) {
      errorMessages.push({
        field: 'general',
        message: 'Sesión expirada. Por favor, inicie sesión nuevamente.',
        type: 'server',
      });
    } else if (error.status === 403) {
      errorMessages.push({
        field: 'general',
        message: 'No tiene permisos para realizar esta acción.',
        type: 'server',
      });
    } else if (error.status === 404) {
      errorMessages.push({
        field: 'general',
        message: 'El recurso solicitado no fue encontrado.',
        type: 'server',
      });
    } else if (error.status === 422) {
      // Errores de validación específicos del backend
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
      const errorDetail = error.error?.detail || 'Datos inválidos';
      errorMessages.push({
        field: 'general',
        message: this.translateGenericError(errorDetail, formName),
        type: 'validation',
      });
    } else if (error.status === 500) {
      errorMessages.push({
        field: 'general',
        message: 'Error interno del servidor. Intente más tarde.',
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
    const translations: { [key: string]: { [key: string]: string } } = {
      polo: {
        cant_empleados: 'La cantidad de empleados debe ser mayor a 0',
        horario_trabajo: 'El horario de trabajo es requerido',
        observaciones: 'Las observaciones no pueden exceder 500 caracteres',
      },
      empresa: {
        cuil: 'El CUIL debe tener formato válido',
        nombre: 'El nombre es requerido (mínimo 2 caracteres)',
        rubro: 'El rubro es requerido',
        cant_empleados: 'La cantidad de empleados debe ser mayor a 0',
        horario_trabajo: 'El horario de trabajo es requerido',
        observaciones: 'Las observaciones no pueden exceder 500 caracteres',
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

    const genericTranslations: { [key: string]: string } = {
      required: 'Este campo es requerido',
      invalid: 'El formato de este campo es inválido',
      min_length: 'Este campo es muy corto',
      max_length: 'Este campo es muy largo',
      email: 'El formato del email es inválido',
      url: 'El formato de la URL es inválido',
      number: 'Debe ser un número válido',
    };

    return genericTranslations[message] || message;
  }

  // Traductor de errores genéricos
  private translateGenericError(detail: string, formName: string): string {
    const translations: { [key: string]: string } = {
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

  private buildDashboardActivity(): void {
    const actividades: Array<{
      tipo: 'ok' | 'warn' | 'info';
      titulo: string;
      cuando: string;
      timestamp: number;
    }> = [];

    const pushActividad = (
      tipo: 'ok' | 'warn' | 'info',
      titulo: string,
      item: any
    ) => {
      actividades.push({
        tipo,
        titulo,
        cuando: this.getActivityLabel(item),
        timestamp: this.getItemTimestamp(item),
      });
    };

    [...this.empresas]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 3)
      .forEach((empresa) => {
        const estadoLabel = empresa.estado ? 'activa' : 'inactiva';
        const tipo = empresa.estado ? 'ok' : 'warn';
        pushActividad(
          tipo,
          `Empresa ${empresa.nombre} ${estadoLabel}`,
          empresa
        );
      });

    [...this.usuarios]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 3)
      .forEach((usuario) => {
        const estadoLabel = usuario.estado ? 'habilitado' : 'inhabilitado';
        const tipo = usuario.estado ? 'ok' : 'warn';
        pushActividad(
          tipo,
          `Usuario ${usuario.nombre} ${estadoLabel}`,
          usuario
        );
      });

    [...this.serviciosPolo]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 2)
      .forEach((servicio) => {
        pushActividad(
          'info',
          `Servicio ${
            servicio.nombre || servicio.tipo_servicio_polo || ''
          } actualizado`,
          servicio
        );
      });

    [...this.lotes]
      .sort((a, b) => this.getItemTimestamp(b) - this.getItemTimestamp(a))
      .slice(0, 2)
      .forEach((lote) => {
        pushActividad(
          'info',
          `Lote M${lote.manzana} - ${lote.lote} actualizado`,
          lote
        );
      });

    this.actividadReciente = actividades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_ACTIVIDADES)
      .map(({ timestamp, ...rest }) => ({
        ...rest,
        cuando: rest.cuando || '-',
      }));
  }

  private getActivityLabel(item: any): string {
    const raw = this.getItemDateSource(item);
    return this.formatActivityMoment(raw ?? undefined);
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
      this.saveInitialFormState('polo', this.poloEditForm);
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

    this.adminPoloService.updatePolo(this.poloEditForm).subscribe({
      next: () => {
        this.showMessage('Datos del polo actualizados exitosamente', 'success');
        this.loadPoloData();
        this.resetForms();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'polo', 'actualizar datos del polo');
        this.loading = false;
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
      this.saveInitialFormState('empresa', this.empresaForm);
    }, 0);
  }

  onSubmitEmpresa(): void {
    this.loading = true;
    this.clearFormErrors('empresa');

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
            this.loadEmpresas();
            this.resetForms();
            this.loading = false;
          },
          error: (error) => {
            this.handleError(error, 'empresa', 'actualizar empresa');
            this.loading = false;
          },
        });
    } else {
      // Crear
      this.adminPoloService.createEmpresa(this.empresaForm).subscribe({
        next: () => {
          this.showMessage('Empresa creada exitosamente', 'success');
          this.loadEmpresas();
          this.resetForms();
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error, 'empresa', 'crear empresa');
          this.loading = false;
        },
      });
    }
  }

  deleteEmpresa(cuil: number): void {
    if (confirm('¿Está seguro de que desea eliminar esta empresa?')) {
      this.adminPoloService.deleteEmpresa(cuil).subscribe({
        next: () => {
          this.showMessage('Empresa eliminada exitosamente', 'success');
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
      this.saveInitialFormState('usuario', this.usuarioForm);
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

            this.showMessage(`Usuario ${accion}do exitosamente`, 'success');
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
      this.saveInitialFormState('servicioPolo', this.servicioPoloForm);
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

    this.adminPoloService.createServicioPolo(this.servicioPoloForm).subscribe({
      next: () => {
        this.showMessage('Servicio del polo creado exitosamente', 'success');
        this.loadServiciosPolo();
        this.resetForms();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'servicioPolo', 'crear servicio del polo');
        this.loading = false;
      },
    });
  }

  onTipoServicioChange(): void {
    const tipo = this.servicioPoloForm.id_tipo_servicio_polo;

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
      this.adminPoloService.deleteServicioPolo(id).subscribe({
        next: () => {
          this.showMessage(
            'Servicio del polo eliminado exitosamente',
            'success'
          );
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
      this.saveInitialFormState('lote', this.loteForm);
    }, 0);
  }

  onSubmitLote(): void {
    this.loading = true;
    this.clearFormErrors('lote');

    if (this.selectedServicioPoloId !== null) {
      this.loteForm.id_servicio_polo = this.selectedServicioPoloId;
    }

    this.adminPoloService.createLote(this.loteForm).subscribe({
      next: () => {
        this.showMessage('Lote creado exitosamente', 'success');
        this.loadLotes();
        this.resetForms();
        this.loading = false;
      },
      error: (error) => {
        this.handleError(error, 'lote', 'crear lote');
        this.loading = false;
      },
    });
  }

  deleteLote(id: number): void {
    if (confirm('¿Está seguro de que desea eliminar este lote?')) {
      this.adminPoloService.deleteLote(id).subscribe({
        next: () => {
          this.showMessage('Lote eliminado exitosamente', 'success');
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
      this.saveInitialFormState('usuario', this.usuarioForm);
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
      this.saveInitialFormState('servicioPolo', this.servicioPoloForm);
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
    kind: 'polo' | 'empresa' | 'usuario' | 'servicioPolo' | 'lote',
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
          this.loadEmpresas();
        },
        error: (error) => {
          this.handleError(error, 'general', 'activar empresa');
        },
      });
    }
  }
}
