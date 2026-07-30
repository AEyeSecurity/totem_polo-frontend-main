import { test, expect } from '@playwright/test';

const BACKEND_LOGIN_URL = 'https://backtotem.aeye.com.ar/login';

// isLoggedIn() decodifica el token como JWT (header.payload.signature),
// asi que el mock necesita una forma valida con un "exp" futuro.
function fakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
    'base64'
  );
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64');
  return `${header}.${payload}.signature`;
}

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('el boton de ingresar esta deshabilitado con el formulario vacio', async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: 'Iniciar Sesión' })
    ).toBeDisabled();
  });

  test('se habilita al completar usuario y contraseña', async ({ page }) => {
    await page.locator('#username').fill('usuario@empresa.com');
    await page.locator('#password').fill('secreto123');
    await expect(
      page.getByRole('button', { name: 'Iniciar Sesión' })
    ).toBeEnabled();
  });

  test('un login fallido muestra un mensaje de error', async ({ page }) => {
    await page.route(BACKEND_LOGIN_URL, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ detail: 'Credenciales inválidas' }),
      })
    );

    await page.locator('#username').fill('usuario@empresa.com');
    await page.locator('#password').fill('secreto123');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page.getByText(/incorrectos|intentos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('un login exitoso como publico redirige al chat', async ({ page }) => {
    await page.route(BACKEND_LOGIN_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          access_token: fakeJwt(),
          token_type: 'bearer',
          tipo_rol: 'publico',
        }),
      })
    );

    await page.locator('#username').fill('usuario@empresa.com');
    await page.locator('#password').fill('secreto123');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page).toHaveURL(/\/chat$/, { timeout: 10000 });
    await expect(
      page.getByText('Asistente Virtual - Parque Industrial Polo 52')
    ).toBeVisible();
  });

  test('un login exitoso como admin_polo redirige a empresas', async ({
    page,
  }) => {
    await page.route(BACKEND_LOGIN_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          access_token: fakeJwt(),
          token_type: 'bearer',
          tipo_rol: 'admin_polo',
        }),
      })
    );

    await page.locator('#username').fill('admin@empresa.com');
    await page.locator('#password').fill('secreto123');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page).toHaveURL(/\/empresas$/, { timeout: 10000 });
  });
});
