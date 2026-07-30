import {
  validatePassword,
  getPasswordRequirements,
  doPasswordsMatch,
} from './password-validation';

describe('password-validation', () => {
  describe('validatePassword', () => {
    it('should reject an empty password', () => {
      expect(validatePassword('').isValid).toBeFalse();
    });

    it('should reject a password shorter than 8 characters', () => {
      const result = validatePassword('Abc1');
      expect(result.isValid).toBeFalse();
      expect(result.message).toContain('8 caracteres');
    });

    it('should reject a password longer than 128 characters', () => {
      const result = validatePassword('Aa1' + 'a'.repeat(127));
      expect(result.isValid).toBeFalse();
      expect(result.message).toContain('128 caracteres');
    });

    it('should reject a password without an uppercase letter', () => {
      const result = validatePassword('abcdefg1');
      expect(result.isValid).toBeFalse();
      expect(result.message).toContain('mayúscula');
    });

    it('should reject a password without a lowercase letter', () => {
      const result = validatePassword('ABCDEFG1');
      expect(result.isValid).toBeFalse();
      expect(result.message).toContain('minúscula');
    });

    it('should reject a password without a number', () => {
      const result = validatePassword('Abcdefgh');
      expect(result.isValid).toBeFalse();
      expect(result.message).toContain('número');
    });

    it('should accept a password meeting all requirements', () => {
      const result = validatePassword('Abcdefg1');
      expect(result.isValid).toBeTrue();
      expect(result.message).toBe('');
    });
  });

  describe('getPasswordRequirements', () => {
    it('should report each requirement individually', () => {
      const reqs = getPasswordRequirements('Abcdefg1', false);
      expect(reqs).toEqual({
        minLength: true,
        maxLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true,
        notReused: true,
      });
    });

    it('should flag notReused as false when the password was already used', () => {
      const reqs = getPasswordRequirements('Abcdefg1', true);
      expect(reqs.notReused).toBeFalse();
    });

    it('should flag missing requirements for a weak password', () => {
      const reqs = getPasswordRequirements('abc', false);
      expect(reqs.minLength).toBeFalse();
      expect(reqs.hasUppercase).toBeFalse();
      expect(reqs.hasNumber).toBeFalse();
    });
  });

  describe('doPasswordsMatch', () => {
    it('should return true when both passwords are equal and non-empty', () => {
      expect(doPasswordsMatch('Abcdefg1', 'Abcdefg1')).toBeTrue();
    });

    it('should return false when passwords differ', () => {
      expect(doPasswordsMatch('Abcdefg1', 'Abcdefg2')).toBeFalse();
    });

    it('should return false when the confirmation is empty', () => {
      expect(doPasswordsMatch('Abcdefg1', '')).toBeFalse();
    });
  });
});
