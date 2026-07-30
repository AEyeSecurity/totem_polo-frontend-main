// src/app/auth/auth-success/auth-success.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthenticationService } from './auth.service';

@Component({
  selector: 'app-auth-success',
  standalone: true,
  imports: [],
  template: `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Iniciando sesión...</p>
    </div>
  `,
  styleUrl: './auth-success.component.css',
})
export class AuthSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthenticationService);


  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const tipoRol = params['tipo_rol'];
      
      if (token && tipoRol) {
        this.processAuth(token, tipoRol);
      } else {
        console.error('❌ Parámetros de autenticación faltantes');
        this.router.navigate(['/login'], { 
          queryParams: { error: 'auth_failed' } 
        });
      }
    });
  }

  private processAuth(token: string, role: string): void {
    try {
      // Guardar credenciales
      this.authService.setToken(token);
      this.authService.setUserRole(role);
      
      // Backup en localStorage
      localStorage.setItem('access_token', token);
      localStorage.setItem('tipo_rol', role);

      // Verificar que se guardó correctamente
      if (this.authService.isLoggedIn()) {
        // Pequeño delay para mostrar el spinner brevemente
        setTimeout(() => {
          this.redirectByRole(role);
        }, 1000);
      } else {
        throw new Error('Error al verificar autenticación');
      }
      
    } catch (error) {
      console.error('❌ Error en processAuth:', error);
      this.router.navigate(['/login'], { 
        queryParams: { error: 'auth_processing_failed' } 
      });
    }
  }

  private redirectByRole(role: string): void {
    let destination = '/dashboard'; // fallback por defecto
    
    switch (role) {
      case 'admin_polo':
        destination = '/empresas';
        break;
      case 'admin_empresa':
        destination = '/me';
        break;
      case 'publico':
        destination = '/chat';
        break;
      default:
        console.warn('⚠️ Rol no reconocido:', role, '- usando dashboard');
        destination = '/dashboard';
        break;
    }

    this.router.navigate([destination]);
  }
}