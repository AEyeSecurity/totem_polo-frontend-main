/**
 * Guarda una copia inicial de cada formulario (por nombre) para poder
 * detectar cambios sin guardar y restaurarlos si el usuario cancela.
 */
export class UnsavedChangesTracker {
  private initialForms: Record<string, unknown> = {};

  save(formName: string, formData: unknown): void {
    this.initialForms[formName] = JSON.parse(JSON.stringify(formData));
  }

  hasChanged(formName: string, currentFormData: unknown): boolean {
    if (!this.initialForms[formName]) return false;
    return (
      JSON.stringify(this.initialForms[formName]) !==
      JSON.stringify(currentFormData)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessor genérico: el llamador determina la forma real con <T>
  getInitial<T = any>(formName: string): T | undefined {
    const stored = this.initialForms[formName];
    return stored ? JSON.parse(JSON.stringify(stored)) : undefined;
  }

  clear(formName: string): void {
    delete this.initialForms[formName];
  }

  clearAll(): void {
    this.initialForms = {};
  }
}
