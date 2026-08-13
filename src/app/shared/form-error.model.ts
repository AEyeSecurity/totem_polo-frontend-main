export interface FormError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'duplicate' | 'server' | 'validation';
}

/** Item individual de un error de validacion de FastAPI/Pydantic. */
export interface FastApiValidationErrorItem {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

export interface HttpErrorBody {
  // FastAPI manda un string para errores "de negocio" (ej. HTTPException) y
  // un array de FastApiValidationErrorItem para errores de validacion de
  // Pydantic (422) - hay que soportar las dos formas.
  detail?: string | FastApiValidationErrorItem[];
  message?: string;
  errors?: Record<string, string[]>;
  status?: number;
}

/**
 * Forma minima que necesitamos leer de un error HTTP (o de un error
 * "sintetico" armado a mano para reusar la misma traduccion de mensajes).
 * Una HttpErrorResponse real cumple esta forma estructuralmente.
 */
export interface HttpErrorLike {
  status?: number;
  error?: HttpErrorBody;
  message?: string;
}
