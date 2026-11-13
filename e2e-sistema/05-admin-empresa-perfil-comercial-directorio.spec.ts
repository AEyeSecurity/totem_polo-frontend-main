/**
 * PARTE 5 — Admin Empresa: perfil de la empresa, información comercial (chat
 * guiado de 9 preguntas y formulario), Servicios del Polo asociados,
 * directorio de empresas del parque, aviso de bienvenida, recordatorio de
 * actualización y cambio de contraseña.
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API, PWD, CUIL, storageFor, apiLogin, loginStatus, nextDialog, ensureServicioPoloConLote, ensureContactosEmpresa2, refreshSessionsIfOld } from './helpers';

// sesiones guardadas vigentes (el token dura 30 min y la suite completa tarda más)
test.beforeAll(async ({ request }) => refreshSessionsIfOld(request));

test.use({ storageState: storageFor('admin_empresa') });
// Orden fijo (workers: 1) pero sin cortar al primer fallo, para ver el estado completo.
test.describe.configure({ mode: 'default' });

let token = '';
const auth = (t = token) => ({ headers: { Authorization: `Bearer ${t}` } });
const me = async (request: APIRequestContext) => (await (await request.get(`${API}/me`, auth())).json()) as any;
const comercial = async (request: APIRequestContext) => {
  const r = await request.get(`${API}/companies/me/comercial`, auth());
  return r.status() === 200 ? await r.json() : null;
};
const modal = (page: Page) => page.locator('form:visible').last();
const msg = (page: Page, text: string) => expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

async function abrir(page: Page, tab?: string) {
  await page.goto('/me');
  await expect(page.getByText('E2E_Empresa_Prueba').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  if (tab === 'perfil') await page.getByRole('button', { name: 'Ver informacion de la empresa' }).click();
  else if (tab === 'config') await page.getByRole('button', { name: 'Abrir configuracion' }).click();
  else if (tab) await page.getByRole('button', { name: tab, exact: true }).first().click();
}

/** Login por UI (para los usuarios que no tienen sesión guardada). */
async function uiLogin(page: Page, user: string, pwd = PWD) {
  await page.goto('/login');
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(pwd);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page).toHaveURL(/\/me$/, { timeout: 30_000 });
}

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'e2e_admin_empresa')).access_token;
  await ensureServicioPoloConLote(request); // servicio del Polo con un lote ubicado en el mapa
  await ensureContactosEmpresa2(request); // contacto comercial + uno interno de la segunda empresa
});

// ─────────────────────────────── 5.1 Perfil ───────────────────────────────
test.describe('5.1 Perfil de la empresa', () => {
  test('muestra los datos de la empresa (solo lectura)', async ({ page }) => {
    await abrir(page, 'perfil');
    await expect(page.getByRole('heading', { name: 'E2E_Empresa_Prueba' })).toBeVisible();
    await expect(page.locator('#ro-cuil')).toHaveValue(String(CUIL.empresa));
    await expect(page.locator('#ro-rubro')).toHaveValue('Testing E2E');
    await expect(page.locator('#ro-estado')).toHaveValue('Activa');
    await expect(page.locator('#ro-cuil')).toHaveAttribute('readonly', '');
  });

  test('editar: solo se pueden cambiar empleados, horario y descripción, y se guardan', async ({ page, request }) => {
    await abrir(page, 'perfil');
    await page.getByRole('button', { name: /Editar datos/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Editar datos de la empresa' })).toBeVisible();
    const editables = await modal(page).locator('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])').evaluateAll((els) => els.map((e) => e.id));
    expect(editables.sort()).toEqual(['empresa_cant_empleados', 'empresa_horario_trabajo', 'empresa_observaciones']);
    await page.locator('#empresa_cant_empleados').fill('9');
    await page.locator('#empresa_horario_trabajo').fill('Lun-Vie 7-15');
    await page.locator('#empresa_observaciones').fill('Descripción cargada por la parte 5');
    const d = nextDialog(page, true);
    await modal(page).getByRole('button', { name: 'Guardar cambios' }).click();
    await d;
    await msg(page, 'Datos de empresa actualizados exitosamente');
    await expect(page.locator('#ro-horario')).toHaveValue('Lun-Vie 7-15');
    await expect(page.locator('#ro-cant-empleados')).toHaveValue('9');
    const e = await me(request);
    expect([e.cant_empleados, e.horario_trabajo, e.observaciones]).toEqual([9, 'Lun-Vie 7-15', 'Descripción cargada por la parte 5']);
  });

  test('cancelar con cambios sin guardar pide confirmación y no guarda', async ({ page, request }) => {
    await abrir(page, 'perfil');
    await page.getByRole('button', { name: /Editar datos/ }).first().click();
    await page.locator('#empresa_horario_trabajo').fill('NO SE DEBE GUARDAR');
    const d = nextDialog(page, true, /cambios|descartar|guardad/i);
    await modal(page).getByRole('button', { name: 'Cancelar' }).click();
    await d;
    await expect(page.locator('#empresa_horario_trabajo')).toHaveCount(0);
    expect((await me(request)).horario_trabajo).toBe('Lun-Vie 7-15');
  });
});

// ──────────────────────── 5.2 Información comercial ────────────────────────
test.describe('5.2 Información comercial (chat guiado y formulario)', () => {
  const input = (page: Page) => page.getByPlaceholder('Escribi tu respuesta...');
  async function responder(page: Page, texto: string, espera: string | RegExp) {
    await input(page).fill(texto);
    await input(page).press('Enter');
    await expect(page.locator('main').getByText(espera).last()).toBeVisible({ timeout: 30_000 });
  }

  test('sin información cargada solo ofrece completarla por chat', async ({ page, request }) => {
    expect(await comercial(request)).toBeNull();
    await abrir(page, 'perfil');
    await expect(page.getByRole('button', { name: /Completar informacion comercial/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Editar datos/ })).toHaveCount(1); // solo el de la empresa
  });

  test('el chat hace las 9 preguntas, valida las respuestas y guarda todo', async ({ page, request }) => {
    await abrir(page, 'perfil');
    await page.getByRole('button', { name: /Completar informacion comercial/ }).click();
    await expect(page.getByText('Pregunta 1 de 9')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('¿qué productos o servicios ofrece tu empresa exactamente?').first()).toBeVisible();

    await responder(page, 'Software de gestión E2E', /A quién le vendés principalmente/);
    await expect(page.getByText('Pregunta 2 de 9')).toBeVisible();
    await responder(page, 'a cualquiera', 'No reconocí esa opción. Elegí una de estas: B2B, B2C, Ambos.');
    await responder(page, 'b2b', /Atendés al público directamente/);
    await responder(page, 'quizás', 'Respondeme con sí o no, por favor.');
    await responder(page, 'sí', /horario de atención comercial/);
    await responder(page, 'Lun-Vie 9-17', /Cómo describirías tus precios/);
    await responder(page, 'medio', /Vendés de forma presencial, online/);
    await responder(page, 'ambas', /Representás o distribuís marcas/);
    await responder(page, 'No aplica', /Contás con certificaciones/);
    await responder(page, 'ISO 9001', /algo más que quieras agregar/);
    await expect(page.getByText('Pregunta 9 de 9')).toBeVisible();
    // al responder la última, el chat se cierra y se muestra la ficha guardada
    await input(page).fill('Atención personalizada E2E');
    await input(page).press('Enter');
    await expect(page.locator('#co-productos')).toHaveValue('Software de gestión E2E', { timeout: 30_000 });
    await expect(input(page)).toHaveCount(0);
    const c = await comercial(request);
    expect(c).toMatchObject({
      productos_servicios: 'Software de gestión E2E', publico_objetivo: 'B2B', atiende_publico: true,
      horario_atencion_comercial: 'Lun-Vie 9-17', rango_precios: 'Medio', modalidad_venta: 'Ambas',
      marcas_representadas: 'No aplica', certificaciones: 'ISO 9001', observaciones_comerciales: 'Atención personalizada E2E', completado: true,
    });
  });

  test('ya completa: se edita con el formulario', async ({ page, request }) => {
    await abrir(page, 'perfil');
    await expect(page.getByRole('button', { name: /Completar informacion comercial/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Editar datos/ }).nth(1).click();
    await expect(page.getByRole('heading', { name: 'Editar informacion comercial' })).toBeVisible();
    await expect(page.locator('#ce-productos')).toHaveValue('Software de gestión E2E');
    await page.locator('#ce-publico').selectOption('Ambos');
    await page.locator('#ce-atiende').selectOption({ label: 'No' });
    await page.locator('#ce-certif').fill('ISO 9001, ISO 14001');
    const d = nextDialog(page, true);
    await modal(page).getByRole('button', { name: /Guardar cambios/ }).click();
    await d;
    await msg(page, 'Informacion comercial actualizada exitosamente');
    await expect(page.locator('#co-atiende')).toHaveValue('No');
    expect(await comercial(request)).toMatchObject({ publico_objetivo: 'Ambos', atiende_publico: false, certificaciones: 'ISO 9001, ISO 14001' });
  });
});

// ───────────────────────── 5.3 Servicios del Polo ─────────────────────────
test.describe('5.3 Servicios del Polo asociados', () => {
  test('lista los servicios del Polo de la empresa con tipo, horario, propietario y lotes', async ({ page }) => {
    await abrir(page, 'Servicios del Polo');
    const r = page.locator('.table--serviciosPolo .row').filter({ hasText: 'E2E Nave Empresa' });
    await expect(r).toContainText('nave');
    await expect(r).toContainText('06-22');
    await expect(r).toContainText('inquilino');
    await expect(r).toContainText('M995-L1');
  });

  test('el buscador filtra por nombre y por lote', async ({ page }) => {
    await abrir(page, 'Servicios del Polo');
    const buscar = page.getByPlaceholder('Buscar por nombre, tipo o lote...');
    await buscar.fill('no-existe-zzz');
    await expect(page.locator('.table--serviciosPolo .row')).toHaveCount(0);
    await buscar.fill('E2E Nave');
    await expect(page.locator('.table--serviciosPolo .row')).toHaveCount(1);
  });
});

// ───────────────────────────── 5.4 Directorio ─────────────────────────────
test.describe('5.4 Directorio de empresas del parque', () => {
  const filas = (page: Page) => page.locator('.table--empresas-directorio .row');
  async function abrirDirectorio(page: Page) {
    await abrir(page, 'Empresas');
    await expect(page.getByPlaceholder('Buscar por nombre o rubro...')).toBeVisible({ timeout: 45_000 });
  }

  test('muestra las empresas activas con su contacto comercial, teléfono y correo', async ({ page }) => {
    await abrirDirectorio(page);
    await page.getByPlaceholder('Buscar por nombre o rubro...').fill('E2E_Empresa_Dos');
    const r = filas(page).filter({ hasText: 'E2E Ventas Dos' });
    await expect(r).toContainText('351-000-1111');
    await expect(r).toContainText('ventas.dos@example.com');
  });

  test('no muestra empresas pendientes, rechazadas ni el propio Polo', async ({ page }) => {
    await abrirDirectorio(page);
    const buscar = page.getByPlaceholder('Buscar por nombre o rubro...');
    for (const nombre of ['E2E_Pendiente', 'E2E_Rechazada', 'Parque Industrial Polo 52']) {
      await buscar.fill(nombre);
      await expect(filas(page)).toHaveCount(0);
    }
  });

  test('el buscador filtra por nombre y por rubro', async ({ page }) => {
    await abrirDirectorio(page);
    const buscar = page.getByPlaceholder('Buscar por nombre o rubro...');
    await buscar.fill('Testing E2E'); // rubro de las empresas E2E
    await expect(page.locator('main').getByText('E2E_Empresa_Dos').first()).toBeVisible();
    await buscar.fill('E2E_Empresa_Prueba');
    await expect(page.locator('main').getByText('E2E_Empresa_Dos')).toHaveCount(0);
  });

  test('muestra la ubicación en el mapa cuando la empresa tiene un lote ubicado', async ({ page }) => {
    await abrirDirectorio(page);
    await page.getByPlaceholder('Buscar por nombre o rubro...').fill('E2E_Empresa_Prueba');
    const r = filas(page).first();
    await expect(r.locator('app-map-location-view')).toBeVisible();
    await expect(r).not.toContainText('Sin ubicacion');
  });

  test('no expone los contactos internos (empresariales) de otras empresas', async ({ page }) => {
    await abrirDirectorio(page);
    await page.getByPlaceholder('Buscar por nombre o rubro...').fill('E2E_Empresa_Dos');
    await expect(filas(page).filter({ hasText: 'E2E Ventas Dos' })).toBeVisible();
    await expect(page.locator('main').getByText('E2E Gerencia Interna'), 'el directorio muestra el contacto empresarial (interno) de otra empresa').toHaveCount(0);
    await expect(page.locator('main').getByText('351-000-9999')).toHaveCount(0);
  });
});

// ───────────────────── 5.5 Bienvenida y recordatorio ─────────────────────
test.describe('5.5 Aviso de bienvenida y recordatorio de actualización', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('primer ingreso: muestra la bienvenida, lleva a completar la info comercial y no vuelve a aparecer', async ({ page, request }) => {
    await uiLogin(page, 'e2e_bienvenida');
    await expect(page.getByText('¡Bienvenido a Polo 52!')).toBeVisible();
    const marcada = page.waitForResponse((r) => r.url().endsWith('/bienvenida-vista') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Completar información comercial/ }).click();
    expect((await marcada).status()).toBe(200);
    await expect(page.getByText('¡Bienvenido a Polo 52!')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Informacion comercial' })).toBeVisible();

    const r = await request.post(`${API}/login`, { form: { username: 'e2e_bienvenida', password: PWD } });
    expect((await r.json()).mostrar_bienvenida).toBe(false);
    await page.evaluate(() => localStorage.clear());
    await uiLogin(page, 'e2e_bienvenida');
    await page.waitForTimeout(2000);
    await expect(page.getByText('¡Bienvenido a Polo 52!')).toHaveCount(0);
  });

  test('recordatorio cada 6 meses: aparece, "Ahora no" lo pospone otros 6 meses y "Actualizar" abre la edición', async ({ page }) => {
    // Es un recordatorio periódico (un pop-up cada 6 meses), aunque la empresa no
    // tenga nada que cambiar: cuenta desde la última vez que se mostró.
    const aviso = () => page.getByText(/Hace más de 6 meses que no se actualizan los datos/);
    await uiLogin(page, 'e2e_admin_empresa2');
    const key = `empresaUpdateReminderShown_${CUIL.empresa2}`;
    const haceSieteMeses = () => String(Date.now() - 214 * 24 * 3600 * 1000);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, haceSieteMeses()]);
    await page.reload();
    await expect(aviso()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await expect(aviso()).toHaveCount(0);
    const guardado = Number(await page.evaluate((k) => localStorage.getItem(k), key));
    expect(Date.now() - guardado).toBeLessThan(60_000);
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(aviso()).toHaveCount(0);

    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, haceSieteMeses()]);
    await page.reload();
    await page.getByRole('button', { name: /Actualizar/ }).click();
    await expect(page.getByRole('heading', { name: 'Editar datos de la empresa' })).toBeVisible();
  });
});

// ───────────────────────────── 5.6 Configuración ─────────────────────────────
test.describe('5.6 Configuración: contraseña y sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  const NUEVA = 'E2e#EmpNueva2026!';

  test('cambia la contraseña: la nueva funciona y la vieja no', async ({ page, request }) => {
    await uiLogin(page, 'e2e_emp_pwd');
    await page.getByRole('button', { name: 'Abrir configuracion' }).click();
    await page.getByRole('button', { name: /Cambiar contraseña/ }).click();
    await page.locator('#currentPassword').fill(PWD);
    await page.locator('#newPassword').fill(NUEVA);
    await page.locator('#confirmPassword').fill(NUEVA);
    await page.locator('form:has(#newPassword) button[type=submit]').click();
    await expect(page.getByText(/Contraseña actualizada|actualizada correctamente/i).first()).toBeVisible({ timeout: 30_000 });
    expect((await loginStatus(request, 'e2e_emp_pwd', NUEVA)).status).toBe(200);
    expect((await loginStatus(request, 'e2e_emp_pwd', PWD)).status).toBe(401);
  });

  test('"Cerrar sesión" desde Configuración', async ({ page }) => {
    await uiLogin(page, 'e2e_emp_pwd', NUEVA);
    await page.getByRole('button', { name: 'Abrir configuracion' }).click();
    await page.locator('main').getByRole('button', { name: /Cerrar sesi[oó]n/ }).click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
