import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthenticationService } from '../auth.service';

interface EmpresaRegisterForm {
  cuil: number | null;
  nombre: string;
  rubro: string;
  cant_empleados: number | null;
  horario_trabajo: string;
  observaciones: string;
  usuario_nombre: string;
  email: string;
  password: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  private authService = inject(AuthenticationService);

  form: EmpresaRegisterForm = {
    cuil: null,
    nombre: '',
    rubro: '',
    cant_empleados: null,
    horario_trabajo: '',
    observaciones: '',
    usuario_nombre: '',
    email: '',
    password: '',
  };
  confirmPassword = '';

  loading = false;
  errorMessage = '';
  submitted = false;
  showPassword = false;
  showConfirmPassword = false;

  passwordComplexityMessage =
    '8 a 128 caracteres, con al menos una mayúscula, una minúscula y un dígito.';

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private isPasswordComplex(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password)
    );
  }

  onSubmit(form: NgForm): void {
    this.errorMessage = '';

    if (form.invalid) {
      this.errorMessage = 'Completá todos los campos obligatorios.';
      return;
    }

    if (!this.isPasswordComplex(this.form.password)) {
      this.errorMessage = `La contraseña no cumple los requisitos: ${this.passwordComplexityMessage}`;
      return;
    }

    if (this.form.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.loading = true;
    this.authService
      .registerEmpresa({
        cuil: Number(this.form.cuil),
        nombre: this.form.nombre.trim(),
        rubro: this.form.rubro.trim(),
        cant_empleados: Number(this.form.cant_empleados),
        horario_trabajo: this.form.horario_trabajo.trim(),
        observaciones: this.form.observaciones.trim() || undefined,
        usuario_nombre: this.form.usuario_nombre.trim(),
        email: this.form.email.trim(),
        password: this.form.password,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.submitted = true;
        },
        error: (err) => {
          const detail = err?.error?.detail;
          if (typeof detail === 'string') {
            this.errorMessage = detail;
          } else if (Array.isArray(detail) && detail.length) {
            this.errorMessage = detail[0]?.msg || 'Revisá los datos ingresados.';
          } else {
            this.errorMessage =
              'No pudimos procesar el registro. Intentá nuevamente.';
          }
        },
      });
  }
}
