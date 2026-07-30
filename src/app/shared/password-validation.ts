export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
}

export interface PasswordRequirements {
  minLength: boolean;
  maxLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  notReused: boolean;
}

// Reglas alineadas con la validacion del backend (min 8, max 128, mayuscula, minuscula y numero)
export function validatePassword(password: string): PasswordValidationResult {
  if (!password) {
    return { isValid: false, message: 'La contraseña es requerida.' };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      message: 'La contraseña no puede tener más de 128 caracteres.',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'La contraseña debe tener al menos una letra mayúscula.',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'La contraseña debe tener al menos una letra minúscula.',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'La contraseña debe tener al menos un número.',
    };
  }

  return { isValid: true, message: '' };
}

export function getPasswordRequirements(
  password: string,
  passwordReused: boolean
): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    maxLength: password.length <= 128,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    notReused: !passwordReused,
  };
}

export function doPasswordsMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword && confirmPassword.length > 0;
}
