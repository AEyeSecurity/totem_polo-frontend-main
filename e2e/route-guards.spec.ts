import { test, expect } from '@playwright/test';

test.describe('AuthGuard', () => {
  test('sin sesion, /chat redirige a /login', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sin sesion, /empresas redirige a /login', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sin sesion, /me redirige a /login', async ({ page }) => {
    await page.goto('/me');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('con un rol que no matchea, redirige segun el rol propio', async ({
    page,
  }) => {
    // Simulamos un usuario "publico" ya autenticado intentando entrar a /empresas
    await page.goto('/login');
    await page.evaluate(() => {
      const header = btoa(JSON.stringify({ alg: 'none' }));
      const payload = btoa(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
      );
      localStorage.setItem('sessionToken', `${header}.${payload}.sig`);
      localStorage.setItem('rol', 'publico');
    });

    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/chat$/);
  });
});
