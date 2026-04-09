// src/app/auth/auth-success/auth-success.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthenticationService } from './auth.service';

@Component({
  selector: 'app-auth-success',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Iniciando sesión...</p>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color:rgb(238, 236, 236);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e0e0e0;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    p {
      margin: 0;
      color: #666;
      font-size: 16px;
    }
  `]
})
export class AuthSuccessComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthenticationService
  ) {}

  ngOnInit(): void {
    console.log('🔄 Procesando autenticación...');
    
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
      
      console.log('✅ Autenticación exitosa, rol:', role);
      
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
    
    console.log('🎯 Redirigiendo a:', destination);
    this.router.navigate([destination]);
  }
}