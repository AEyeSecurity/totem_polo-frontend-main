import {
  FastApiValidationErrorItem,
  FormError,
  HttpErrorBody,
  HttpErrorLike,
} from './form-error.model';

/**
 * Extrae un mensaje de texto legible de `detail`, sin importar si vino como
 * string plano (HTTPException de FastAPI) o como array de errores de
 * validacion de Pydantic ({loc, msg, type}[]). Nunca deja pasar un objeto
 * crudo a un campo `message: string` (eso es lo que termina renderizando
 * "[object Object]" en el template).
 */
function firstDetailMessage(
  detail: string | FastApiValidationErrorItem[] | undefined,
  fallback: string
): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first?.msg === 'string' && first.msg.trim()) {
      return first.msg;
    }
  }
  return fallback;
}

/** Nombre de campo legible a partir del `loc` de un error de Pydantic (ej. ["body","email"] -> "email"). */
function fieldFromLoc(loc: (string | number)[] | undefined): string {
  if (!loc || !loc.length) return 'general';
  const last = loc[loc.length - 1];
  return last === undefined || last === null ? 'general' : String(last);
}

// Traducciones de errores de campo comunes a todos los formularios,
// usadas como fallback cuando el formulario no tiene una traduccion propia.
export const GENERIC_FIELD_ERROR_TRANSLATIONS: Record<string, string> = {
  required: 'Este campo es requerido',
  invalid: 'El formato de este campo es inválido',
  min_length: 'Este campo es muy corto',
  max_length: 'Este campo es muy largo',
  email: 'El formato del email es inválido',
  url: 'El formato de la URL es inválido',
  number: 'Debe ser un número válido',
};

export function getFieldErrors(
  formErrors: Partial<Record<string, FormError[]>>,
  formName: string,
  fieldName: string
): FormError[] {
  const errors = formErrors[formName] || [];
  return errors.filter((error) => error.field === fieldName);
}

export function hasFieldError(
  formErrors: Partial<Record<string, FormError[]>>,
  formName: string,
  fieldName: string
): boolean {
  return getFieldErrors(formErrors, formName, fieldName).length > 0;
}

/**
 * Traduce una respuesta HTTP de error al listado de FormError que muestran los
 * formularios. El mapeo de status code es igual en toda la app; la traduccion
 * de campos/mensajes especificos de cada dominio se delega a los callbacks.
 */
export function buildFormErrorsFromHttpError(
  error: HttpErrorLike,
  formName: string,
  translateFieldError: (
    field: string,
    message: string,
    formName: string
  ) => string,
  translateGenericError: (detail: string, formName: string) => string
): FormError[] {
  const errorMessages: FormError[] = [];

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
    const errorResponse: HttpErrorBody | undefined = error.error;
    if (errorResponse?.errors) {
      // Formato custom propio: { errors: { campo: [mensajes] } }
      Object.keys(errorResponse.errors).forEach((field) => {
        const fieldErrors = errorResponse.errors![field];
        fieldErrors.forEach((message) => {
          errorMessages.push({
            field,
            message: translateFieldError(field, message, formName),
            type: 'validation',
          });
        });
      });
    } else if (Array.isArray(errorResponse?.detail)) {
      // Formato estandar de FastAPI/Pydantic: detail = [{ loc, msg, type }, ...]
      errorResponse!.detail.forEach((item) => {
        const field = fieldFromLoc(item?.loc);
        const rawMsg =
          typeof item?.msg === 'string' && item.msg.trim()
            ? item.msg
            : 'Dato inválido';
        errorMessages.push({
          field,
          message: translateFieldError(field, rawMsg, formName),
          type: 'validation',
        });
      });
    } else if (errorResponse?.detail) {
      errorMessages.push({
        field: 'general',
        message: translateGenericError(
          firstDetailMessage(errorResponse.detail, 'Datos inválidos'),
          formName
        ),
        type: 'validation',
      });
    }
  } else if (error.status === 400) {
    const errorDetail = firstDetailMessage(error.error?.detail, 'Datos inválidos');
    errorMessages.push({
      field: 'general',
      message: translateGenericError(errorDetail, formName),
      type: 'validation',
    });
  } else if (error.status === 500) {
    errorMessages.push({
      field: 'general',
      message: 'Error interno del servidor. Intente más tarde.',
      type: 'server',
    });
  } else {
    const detail = firstDetailMessage(
      error.error?.detail,
      error.message || 'Error desconocido'
    );
    errorMessages.push({
      field: 'general',
      message: translateGenericError(detail, formName),
      type: 'server',
    });
  }

  return errorMessages;
}
