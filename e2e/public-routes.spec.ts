import { test, expect } from '@playwright/test';

test.describe('Rutas públicas', () => {
  test('la raiz redirige a /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('una ruta desconocida redirige a /login', async ({ page }) => {
    await page.goto('/esto-no-existe');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('/login muestra el formulario de acceso', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Iniciar Sesión' })
    ).toBeVisible();
  });

  test('/reset-password muestra el formulario de recuperacion', async ({
    page,
  }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('Token no válido o ausente')).toBeVisible();
  });
});
