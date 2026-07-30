export interface FormError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'duplicate' | 'server' | 'validation';
}

export interface HttpErrorBody {
  detail?: string;
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
