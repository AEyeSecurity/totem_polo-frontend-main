import {
  getFieldErrors,
  hasFieldError,
  buildFormErrorsFromHttpError,
  GENERIC_FIELD_ERROR_TRANSLATIONS,
} from './form-errors.util';
import { FormError } from './form-error.model';

describe('form-errors.util', () => {
  describe('getFieldErrors / hasFieldError', () => {
    const formErrors: Record<string, FormError[]> = {
      vehiculo: [
        { field: 'patente', message: 'inválida', type: 'validation' },
        { field: 'general', message: 'error general', type: 'server' },
      ],
    };

    it('should return only the errors matching the requested field', () => {
      expect(getFieldErrors(formErrors, 'vehiculo', 'patente').length).toBe(1);
    });

    it('should return an empty array for a form with no errors', () => {
      expect(getFieldErrors(formErrors, 'inexistente', 'x')).toEqual([]);
    });

    it('hasFieldError should be true only when there is a matching field error', () => {
      expect(hasFieldError(formErrors, 'vehiculo', 'patente')).toBeTrue();
      expect(hasFieldError(formErrors, 'vehiculo', 'horarios')).toBeFalse();
    });
  });

  describe('buildFormErrorsFromHttpError', () => {
    const translateField = (field: string, message: string) =>
      `T:${field}:${message}`;
    const translateGeneric = (detail: string) => `G:${detail}`;

    it('should map a status 0 to a connection error', () => {
      const result = buildFormErrorsFromHttpError(
        { status: 0 },
        'empresa',
        translateField,
        translateGeneric
      );
      expect(result[0].message).toContain('Error de conexión');
      expect(result[0].type).toBe('server');
    });

    it('should map a status 401 to a session-expired error', () => {
      const result = buildFormErrorsFromHttpError(
        { status: 401 },
        'empresa',
        translateField,
        translateGeneric
      );
      expect(result[0].message).toContain('Sesión expirada');
    });

    it('should translate each field error for a 422 response', () => {
      const result = buildFormErrorsFromHttpError(
        {
          status: 422,
          error: { errors: { nombre: ['required'], cuil: ['invalid'] } },
        },
        'empresa',
        translateField,
        translateGeneric
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        field: 'nombre',
        message: 'T:nombre:required',
        type: 'validation',
      });
      expect(result[1].field).toBe('cuil');
    });

    it('should translate each item of a FastAPI/Pydantic validation array (422) instead of leaking the raw object', () => {
      const result = buildFormErrorsFromHttpError(
        {
          status: 422,
          error: {
            detail: [
              { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' },
              { loc: ['body', 'nombre'], msg: 'field required', type: 'missing' },
            ],
          },
        },
        'usuario',
        translateField,
        translateGeneric
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        field: 'email',
        message: 'T:email:value is not a valid email address',
        type: 'validation',
      });
      expect(result[1].field).toBe('nombre');
      // Ninguno de los dos mensajes debe ser el objeto crudo stringificado.
      expect(result.every((e) => !e.message.includes('[object Object]'))).toBeTrue();
    });

    it('should use the generic translator for a 422 with only a detail message', () => {
      const result = buildFormErrorsFromHttpError(
        { status: 422, error: { detail: 'Ya existe' } },
        'empresa',
        translateField,
        translateGeneric
      );
      expect(result[0].message).toBe('G:Ya existe');
      expect(result[0].field).toBe('general');
    });

    it('should default the 400 detail to "Datos inválidos" when missing', () => {
      const result = buildFormErrorsFromHttpError(
        { status: 400, error: {} },
        'empresa',
        translateField,
        translateGeneric
      );
      expect(result[0].message).toBe('G:Datos inválidos');
    });

    it('should map a status 500 to a server error', () => {
      const result = buildFormErrorsFromHttpError(
        { status: 500 },
        'empresa',
        translateField,
        translateGeneric
      );
      expect(result[0].message).toContain('Error interno del servidor');
    });

    it('should fall back to a generic message for an unknown status', () => {
      const result = buildFormErrorsFromHttpError(
        { status: 418, error: { detail: 'Soy una tetera' } },
        'empresa',
        translateField,
        translateGeneric
      );
      expect(result[0].message).toBe('G:Soy una tetera');
    });
  });

  describe('GENERIC_FIELD_ERROR_TRANSLATIONS', () => {
    it('should expose translations for the common validation keys', () => {
      expect(GENERIC_FIELD_ERROR_TRANSLATIONS['required']).toBeTruthy();
      expect(GENERIC_FIELD_ERROR_TRANSLATIONS['email']).toBeTruthy();
    });
  });
});
