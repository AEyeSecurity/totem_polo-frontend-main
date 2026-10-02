/**
 * Recorrido E2E completo del sistema Polo 52, contra backend y base reales.
 * Usa solo datos temporales con prefijo E2E_/e2e_ (CUILs 20999000xxx), que se
 * crean antes y se borran después con backend/…/e2e_data.py.
 *
 * Cada funcionalidad es un "check": si falla se registra y se sigue con la
 * siguiente, para obtener un informe completo en e2e-live/resultados.json.
 */
import { test, expect, Page, Browser } from '@playwright/test';
import * as fs from 'fs';

const API = 'http://localhost:8000';
const PWD = 'E2e#Prueba2026!';
const PWD_NUEVA = 'E2e#Cambiada2026!';
const CUIL_EMP = 20999000002;
const CUIL_REG_OK = 20999000003;
const CUIL_REG_RECH = 20999000004;
const CUIL_POLO_REAL = 44123456789;

type Result = { area: string; check: string; ok: boolean; detalle?: string };
const results: Result[] = [];
const httpErrors: string[] = [];
const consoleErrors: string[] = [];

function watch(page: Page, who: string) {
  page.on('dialog', (d) => d.accept());
  page.on('response', (r) => {
    if (r.url().startsWith(API) && r.status() >= 400)
      httpErrors.push(`[${who}] ${r.request().method()} ${r.url().replace(API, '')} -> ${r.status()}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${who}] ${m.text().slice(0, 200)}`);
  });
}

async function check(area: string, name: string, fn: () => Promise<void | string>) {
  await test.step(`${area} › ${name}`, async () => {
    try {
      const detalle = await fn();
      results.push({ area, check: name, ok: true, detalle: detalle || undefined });
    } catch (e: any) {
      results.push({ area, check: name, ok: false, detalle: String(e?.message || e).replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 300) });
      if (currentPage) {
        const f = `e2e-live/shots/FAIL-${area}-${name}`.replace(/[^\w\-/.]+/g, '_').slice(0, 120) + '.png';
        await currentPage.screenshot({ path: f }).catch(() => {});
        await dismissAll(currentPage).catch(() => {});
      }
    }
  });
}

let currentPage: Page | null = null;
async function dismissAll(page: Page) {
  for (const sel of ['form:visible button:has-text("Cancelar")', 'button:visible:has-text("✕")', 'button[aria-label="Cerrar"]:visible']) {
    const b = page.locator(sel).first();
    if (await b.isVisible().catch(() => false)) await b.click({ timeout: 3000 }).catch(() => {});
  }
}

async function closeModals(page: Page) {
  for (let i = 0; i < 3; i++) {
    const x = page.locator('button[aria-label="Cerrar"]:visible').first();
    if (!(await x.isVisible().catch(() => false))) return;
    await x.click();
    await page.waitForTimeout(400);
  }
}

async function login(page: Page, user: string, pwd = PWD) {
  await page.goto('/login');
  await page.fill('#username', user);
  await page.fill('#password', pwd);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });
  await page.waitForTimeout(1500);
  await closeModals(page);
}

async function tab(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(1000);
}

/**
 * Busca la FILA (el elemento más chico que contiene rowText y al menos un botón)
 * y dentro de ella el botón por title/aria-label/texto. Reintenta hasta 10 s
 * para dar tiempo a que la lista se refresque. Nunca sale de esa fila.
 */
async function rowBtn(page: Page, rowText: string, title: string | RegExp, click = true) {
  const id = 'e2e' + Math.random().toString(36).slice(2);
  const src = title instanceof RegExp ? title.source : `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  const find = () => page.evaluate(({ rowText, src, id }) => {
    document.querySelectorAll('[data-e2e]').forEach((e) => e.removeAttribute('data-e2e'));
    const re = new RegExp(src, 'i');
    const visible = (b: Element) => (b as HTMLElement).offsetParent !== null;
    let row: Element | null = null;
    for (const el of Array.from(document.querySelectorAll('tr, li, article, div, section'))) {
      if (!(el as HTMLElement).innerText?.includes(rowText)) continue;
      if (!Array.from(el.querySelectorAll('button')).some(visible)) continue;
      if (!row || row.contains(el)) row = el;
    }
    if (!row) return false;
    const btn = Array.from(row.querySelectorAll('button')).find(
      (b) => visible(b) && [b.title, b.getAttribute('aria-label') || '', (b as HTMLElement).innerText.trim()].some((t) => re.test(t))
    );
    if (!btn) return false;
    btn.setAttribute('data-e2e', id);
    return true;
  }, { rowText, src, id });
  const t0 = Date.now();
  while (!(await find())) {
    if (Date.now() - t0 > 10000) throw new Error(`No encontré el botón "${title}" en la fila "${rowText}"`);
    await page.waitForTimeout(500);
  }
  if (click) await page.locator(`[data-e2e="${id}"]`).click();
}

const submit = (page: Page, name: RegExp) =>
  page.locator('form:visible').getByRole('button', { name }).last().click();

async function expectText(page: Page, text: string | RegExp, timeout = 10000) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout });
}

async function newPage(browser: Browser, who: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  watch(page, who);
  currentPage = page;
  return page;
}

test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  fs.writeFileSync(
    'e2e-live/resultados.json',
    JSON.stringify({ results, httpErrors: [...new Set(httpErrors)], consoleErrors: [...new Set(consoleErrors)] }, null, 2)
  );
});

// ────────────────────────────── 1. Público / sin sesión ──────────────────────────────
test('1. Acceso público: login, recuperación, registro y guards', async ({ browser }) => {
  const page = await newPage(browser, 'anonimo');
  const A = 'Público';

  await check(A, 'La raíz redirige a /login', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
  await check(A, 'Botón "Iniciar Sesión" deshabilitado con formulario vacío', async () => {
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeDisabled();
  });
  await check(A, 'Login con contraseña incorrecta muestra error', async () => {
    await page.fill('#username', 'e2e_publico');
    await page.fill('#password', 'Incorrecta123');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expectText(page, /incorrect|inválid|intentos/i);
    await expect(page).toHaveURL(/\/login$/);
  });
  await check(A, '"Olvidé mi contraseña" envía la solicitud', async () => {
    await page.getByText(/olvid/i).first().click();
    await page.fill('#reset-email', 'e2e_publico@example.com');
    await page.locator('form:has(#reset-email)').getByRole('button').filter({ hasNotText: /cancel|volver/i }).last().click();
    await expectText(page, /enviad|correo|email|revis/i, 15000);
  });
  await check(A, 'Guard: /empresas sin sesión vuelve a /login', async () => {
    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/login/);
  });
  await check(A, 'Guard: /chat sin sesión vuelve a /login', async () => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login/);
  });

  for (const [cuil, nombre] of [[CUIL_REG_OK, 'E2E_Registro_Aprobar'], [CUIL_REG_RECH, 'E2E_Registro_Rechazar']] as const) {
    await check(A, `Autoregistro de empresa "${nombre}"`, async () => {
      await page.goto('/register');
      await page.fill('#r_cuil', String(cuil));
      await page.fill('#r_nombre', nombre);
      await page.fill('#r_rubro', 'Testing E2E');
      await page.fill('#r_empleados', '4');
      await page.fill('#r_horario', 'Lun-Vie 8-17');
      await page.fill('#r_obs', 'Solicitud creada por la prueba E2E');
      await page.fill('#r_usuario', nombre.toLowerCase());
      await page.fill('#r_email', `${nombre.toLowerCase()}@example.com`);
      await page.fill('#r_password', PWD);
      await page.fill('#r_password_confirm', PWD);
      await page.locator('button[type=submit]').click();
      await expectText(page, /solicitud|aprob|pendiente|registr/i, 15000);
    });
  }
  await check(A, 'Una empresa pendiente no puede iniciar sesión', async () => {
    await page.goto('/login');
    await page.fill('#username', 'e2e_registro_aprobar');
    await page.fill('#password', PWD);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/login/);
  });
  await page.context().close();
});

// ────────────────────────────── 2. Admin del Polo ──────────────────────────────
test('2. Admin Polo', async ({ browser, request }) => {
  const page = await newPage(browser, 'admin_polo');
  const tkp = (await (await request.post(`${API}/login`, { form: { username: 'e2e_admin_polo', password: PWD } })).json()).access_token;
  const solicitudes = async () =>
    (await (await request.get(`${API}/empresas/solicitudes`, { headers: { Authorization: `Bearer ${tkp}` } })).json()).map((e: any) => e.nombre).join(',');
  const A = 'Admin Polo';

  await check(A, 'Login redirige a /empresas', async () => {
    await login(page, 'e2e_admin_polo');
    await expect(page).toHaveURL(/\/empresas$/);
  });
  await check(A, 'Dashboard muestra actividad y accesos rápidos', async () => {
    await tab(page, 'Dashboard');
    await expectText(page, 'Accesos rápidos');
    await expectText(page, 'Actividad reciente');
  });

  // Solicitudes
  await check(A, 'Solicitudes: aparecen las 2 empresas registradas', async () => {
    await tab(page, 'Solicitudes');
    await expectText(page, 'E2E_Registro_Aprobar');
    await expectText(page, 'E2E_Registro_Rechazar');
  });
  await check(A, 'Solicitudes: aprobar una', async () => {
    await rowBtn(page, 'E2E_Registro_Aprobar', 'Aprobar');
    await expect.poll(() => solicitudes(), { timeout: 15000 }).not.toContain('E2E_Registro_Aprobar');
  });
  await check(A, 'Solicitudes: rechazar otra', async () => {
    await rowBtn(page, 'E2E_Registro_Rechazar', 'Rechazar');
    await expect.poll(() => solicitudes(), { timeout: 15000 }).not.toContain('E2E_Registro_Rechazar');
  });

  // Empresas
  await check(A, 'Empresas: buscador encuentra la empresa aprobada', async () => {
    await tab(page, 'Empresas');
    await page.getByPlaceholder('Buscar por nombre, CUIL o rubro…').fill('E2E_');
    await expectText(page, 'E2E_Registro_Aprobar');
    await expectText(page, 'E2E_Empresa_Prueba');
  });
  await check(A, 'Empresas: editar rubro', async () => {
    await rowBtn(page, 'E2E_Registro_Aprobar', 'Editar');
    await page.fill('#e_rubro', 'Testing E2E Editado');
    await submit(page, /guardar|actualizar/i);
    await expectText(page, 'Testing E2E Editado');
  });
  await check(A, 'Empresas: desactivar', async () => {
    await rowBtn(page, 'E2E_Registro_Aprobar', 'Desactivar empresa');
    await page.waitForTimeout(2000);
    await rowBtn(page, 'E2E_Registro_Aprobar', 'Activar empresa', false);
  });
  await check(A, 'Empresas: reactivar', async () => {
    await rowBtn(page, 'E2E_Registro_Aprobar', 'Activar empresa');
    await page.waitForTimeout(2000);
    await rowBtn(page, 'E2E_Registro_Aprobar', 'Desactivar empresa', false);
  });
  await page.reload(); await page.waitForTimeout(1500); await closeModals(page);
  await check(A, 'Empresas: agregar usuario a una empresa existente', async () => {
    await tab(page, 'Empresas');
    await page.getByPlaceholder('Buscar por nombre, CUIL o rubro…').fill('E2E_Empresa_Prueba');
    await rowBtn(page, 'E2E_Empresa_Prueba', 'Agregar usuario a la empresa');
    await page.fill('#au_nombre', 'e2e_agregado');
    await page.fill('#au_email', 'e2e_agregado@example.com');
    await page.locator('form:has(#au_nombre)').locator('button[type=submit]').click();
    await expectText(page, /cread|agregad|éxito|exito|enviad/i);
  });

  // Usuarios
  await check(A, 'Usuarios: crear usuario público', async () => {
    await page.keyboard.press('Escape');
    await tab(page, 'Usuarios');
    await page.getByRole('button', { name: /Nuevo usuario/ }).first().click();
    await page.fill('#u_email', 'e2e_nuevo@example.com');
    await page.fill('#u_nombre', 'e2e_nuevo');
    await page.selectOption('#u_rol', { label: 'publico' });
    await page.fill('#u_cuil', String(CUIL_POLO_REAL)); // regla: 'publico' solo en la empresa Polo
    await submit(page, /crear/i);
    await page.getByPlaceholder('Buscar por nombre, email o empresa').fill('e2e_nuevo');
    await expectText(page, 'e2e_nuevo@example.com');
  });
  await check(A, 'Usuarios: editar (nombre/email bloqueados, cambia estado)', async () => {
    await rowBtn(page, 'e2e_nuevo@example.com', 'Editar');
    await expect(page.locator('#u_nombre')).toBeDisabled();
    await expect(page.locator('#u_email')).toBeDisabled();
    await page.selectOption('#u_estado', { label: 'Inhabilitado' });
    await submit(page, /guardar|actualizar/i);
    await page.waitForTimeout(1500);
    await rowBtn(page, 'e2e_nuevo@example.com', 'Habilitar', false);
  });
  await check(A, 'Usuarios: habilitar e inhabilitar con el botón de la fila', async () => {
    await rowBtn(page, 'e2e_nuevo@example.com', 'Habilitar');
    await page.waitForTimeout(1500);
    await rowBtn(page, 'e2e_nuevo@example.com', 'Inhabilitar');
    await page.waitForTimeout(1500);
    await rowBtn(page, 'e2e_nuevo@example.com', 'Habilitar', false);
  });

  // Servicios del Polo + lotes
  await check(A, 'Servicios Polo: crear coworking', async () => {
    await tab(page, 'Servicios Polo');
    await page.getByRole('button', { name: /Nuevo servicio/ }).first().click();
    await page.fill('#sp_nombre', 'E2E Coworking');
    await page.selectOption('#sp_tipo', { label: 'coworking' });
    await page.fill('#sp_horario', '08-18');
    await page.fill('#sp_cuil', String(CUIL_EMP));
    await page.fill('#sp_puestos', '12');
    await submit(page, /crear/i);
    await page.getByPlaceholder('Buscar por nombre o empresa…').fill('E2E');
    await expectText(page, 'E2E Coworking');
  });
  await check(A, 'Servicios Polo: asignar un lote', async () => {
    await rowBtn(page, 'E2E Coworking', 'Agregar/Asignar lote');
    await page.fill('#l_dueno', 'Prueba Automatica');
    await page.fill('#l_manzana', '999');
    await page.fill('#l_lote', '999');
    await submit(page, /crear|guardar|asignar|agregar/i);
    await expectText(page, /cread|asignad|éxito|exito|registrad/i);
  });
  await check(A, 'Lotes: aparece el lote y se puede buscar', async () => {
    await page.keyboard.press('Escape');
    await tab(page, 'Lotes');
    await page.getByPlaceholder(/Buscar por dueño/).fill('E2E');
    await expectText(page, 'Prueba Automatica');
  });
  await check(A, 'Lotes: abrir mapa de ubicación', async () => {
    await rowBtn(page, 'Prueba Automatica', /edit_location_alt|ubicaci/i);
    await expectText(page, /Ubicación del lote/);
    await page.getByRole('button', { name: /cancelar/i }).last().click();
  });
  await check(A, 'Lotes: eliminar', async () => {
    await rowBtn(page, 'Prueba Automatica', /^delete$|eliminar/i);
    await expect(page.getByText('Prueba Automatica')).toHaveCount(0, { timeout: 10000 });
  });
  await check(A, 'Servicios Polo: eliminar', async () => {
    await tab(page, 'Servicios Polo');
    await page.getByPlaceholder('Buscar por nombre o empresa…').fill('E2E');
    await rowBtn(page, 'E2E Coworking', 'Eliminar servicio');
    await expect(page.getByText('E2E Coworking')).toHaveCount(0, { timeout: 10000 });
  });

  // Perfil y configuración
  await check(A, 'Perfil: ver datos del Polo', async () => {
    await page.getByRole('button', { name: 'Ver información del polo' }).click();
    await expectText(page, 'Datos del Polo');
    await expect(page.locator('#ro-polo-nombre')).not.toHaveValue('', { timeout: 10000 });
    return 'Polo: ' + (await page.locator('#ro-polo-nombre').inputValue());
  });
  // OJO: /polo/me es el Polo REAL -> solo se abren los formularios y se cancelan.
  await check(A, 'Perfil: formulario "Editar datos del Polo" abre precargado (sin guardar)', async () => {
    await page.getByRole('button', { name: /Editar datos/ }).first().click();
    await expect(page.locator('#p_horario')).toBeVisible();
    await page.locator('form:visible').getByRole('button', { name: /cancelar/i }).click();
  });
  await check(A, 'Perfil: formulario "Información comercial" abre (sin guardar)', async () => {
    await page.getByRole('button', { name: /Editar datos/ }).nth(1).click();
    await expect(page.locator('#ce-productos')).toBeVisible();
    await page.locator('form:visible').getByRole('button', { name: /cancelar/i }).click();
  });
  await check(A, 'Configuración: abrir modal de cambio de contraseña', async () => {
    await page.getByRole('button', { name: 'Abrir configuración' }).click();
    await page.getByRole('button', { name: /Cambiar contraseña/ }).click();
    await expect(page.locator('#currentPassword')).toBeVisible();
    await page.keyboard.press('Escape');
    await closeModals(page);
  });
  await check(A, 'Asistente virtual (botón flotante) se abre', async () => {
    await page.goto('/empresas'); await page.waitForTimeout(1200); await closeModals(page);
    await page.getByRole('button', { name: 'Abrir asistente virtual del Polo' }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('iframe, .chat, [class*=chat]').first()).toBeVisible();
  });
  await check(A, 'Guard: admin_polo no puede entrar a /me', async () => {
    await page.goto('/me');
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/me$/);
  });
  await check(A, 'Cerrar sesión', async () => {
    await page.goto('/empresas'); await page.waitForTimeout(1200); await closeModals(page);
    await page.getByRole('button', { name: /Cerrar sesión/ }).first().click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
  await page.context().close();
});

// ────────────────────────────── 3. Admin de Empresa ──────────────────────────────
test('3. Admin Empresa', async ({ browser }) => {
  const page = await newPage(browser, 'admin_empresa');
  const A = 'Admin Empresa';

  await check(A, 'Login redirige a /me', async () => {
    await login(page, 'e2e_admin_empresa');
    await expect(page).toHaveURL(/\/me$/);
  });
  await check(A, 'Dashboard: tarjeta ESTADO coincide con la empresa (activa)', async () => {
    await tab(page, 'Dashboard');
    const card = page.locator('text=ESTADO').locator('xpath=ancestor::*[self::div or self::section][1]');
    const txt = (await card.innerText()).replace(/\s+/g, ' ');
    if (/inactiv/i.test(txt)) throw new Error(`La empresa está activa en la base pero la tarjeta dice: "${txt}"`);
  });

  // Vehículos
  await check(A, 'Vehículos: agregar', async () => {
    await tab(page, 'Vehiculos');
    await page.getByRole('button', { name: /Nuevo vehiculo/ }).first().click();
    await page.selectOption('#v_tipo', { label: 'corporativos' });
    await page.fill('#v_horarios', '08-18');
    await page.fill('#v_frecuencia', 'Diaria');
    await page.fill('#v_cant_corp', '2');
    await page.fill('#v_pat_corp', 'AE123EE');
    await page.selectOption('#v_carga_corp', { label: 'Baja' });
    await submit(page, /^agregar$/i);
    await page.getByPlaceholder('Buscar por tipo, patente o datos...').fill('AE123EE');
    await expectText(page, /corporativ/i);
  });
  await check(A, 'Vehículos: editar', async () => {
    await rowBtn(page, 'corporativ', 'Editar');
    await page.fill('#v_frecuencia', 'Semanal');
    await submit(page, /actualizar/i);
    await expectText(page, /Semanal/);
  });
  await check(A, 'Vehículos: eliminar', async () => {
    await rowBtn(page, 'Semanal', 'Eliminar');
    await expect(page.getByText('Semanal')).toHaveCount(0, { timeout: 10000 });
  });

  // Servicios
  await check(A, 'Servicios: agregar (agua)', async () => {
    await tab(page, 'Servicios');
    await page.getByRole('button', { name: /Nuevo servicio/ }).first().click();
    await page.selectOption('#s_tipo', { label: 'agua' });
    await page.fill('#s_biofiltro', 'E2E si');
    await page.fill('#s_aguas', 'E2E no');
    await submit(page, /^agregar$/i);
    await expectText(page, /E2E si/);
  });
  await check(A, 'Servicios: editar', async () => {
    await rowBtn(page, 'E2E si', 'Editar');
    await page.fill('#s_aguas', 'E2E editado');
    await submit(page, /actualizar/i);
    await expectText(page, /E2E editado/);
  });
  await check(A, 'Servicios: eliminar', async () => {
    await rowBtn(page, 'E2E editado', 'Eliminar');
    await expect(page.getByText('E2E editado')).toHaveCount(0, { timeout: 10000 });
  });

  // Contactos
  await check(A, 'Contactos: agregar', async () => {
    await tab(page, 'Contactos');
    await page.getByRole('button', { name: /Nuevo contacto/ }).first().click();
    await page.selectOption('#c_tipo', { label: 'comercial' });
    await page.fill('#c_nombre', 'E2E Contacto');
    await page.fill('#c_telefono', '+54 9 351 1234567');
    await page.fill('#c_direccion', 'Calle E2E 123, Córdoba');
    await page.getByPlaceholder('mail@empresa.com').fill('e2e_contacto@example.com');
    await submit(page, /^agregar$/i);
    await page.getByPlaceholder('Buscar por nombre, telefono o datos...').fill('E2E');
    await expectText(page, 'E2E Contacto');
  });
  await check(A, 'Contactos: editar', async () => {
    await rowBtn(page, 'E2E Contacto', 'Editar');
    await page.fill('#c_nombre', 'E2E Contacto Editado');
    await submit(page, /actualizar/i);
    await expectText(page, 'E2E Contacto Editado');
  });
  await check(A, 'Contactos: eliminar', async () => {
    await rowBtn(page, 'E2E Contacto Editado', 'Eliminar');
    await expect(page.getByText('E2E Contacto Editado')).toHaveCount(0, { timeout: 10000 });
  });

  await check(A, 'Servicios del Polo: pestaña carga', async () => {
    await tab(page, 'Servicios del Polo');
    await expectText(page, 'Servicios del Polo asociados');
  });
  await check(A, 'Empresas del parque: directorio carga con empresas', async () => {
    await tab(page, 'Empresas');
    await expectText(page, 'Empresas del parque');
    const t0 = Date.now();
    await expect(page.getByPlaceholder('Buscar por nombre o rubro...')).toBeVisible({ timeout: 45000 });
    const ms = Date.now() - t0;
    await page.getByPlaceholder('Buscar por nombre o rubro...').fill('E2E_Registro');
    await expectText(page, 'E2E_Registro_Aprobar');
    return `cargó en ${(ms / 1000).toFixed(1)} s`;
  });

  // Perfil
  await check(A, 'Perfil: editar datos de la empresa', async () => {
    await page.getByRole('button', { name: 'Ver informacion de la empresa' }).click();
    await page.getByRole('button', { name: /Editar datos/ }).first().click();
    await page.fill('#empresa_horario_trabajo', 'Lun-Vie 9-17');
    await submit(page, /guardar/i);
    await expect(page.locator('#ro-horario')).toHaveValue('Lun-Vie 9-17', { timeout: 10000 });
  });
  await check(A, 'Perfil: completar información comercial por chat (usa Gemini)', async () => {
    await page.getByRole('button', { name: /Completar informacion comercial/ }).first().click();
    await page.waitForTimeout(6000);
    const input = page.getByPlaceholder('Escribi tu respuesta...');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Vendemos software de prueba');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);
    const body = await page.locator('body').innerText();
    if (/problema|error|no pude|intent/i.test(body.slice(-1500))) throw new Error('El chat comercial respondió con error (Gemini)');
  });

  await check(A, 'Perfil: editar información comercial (formulario)', async () => {
    await page.getByRole('button', { name: /Editar datos/ }).nth(1).click();
    await page.fill('#ce-productos', 'Productos de prueba E2E');
    await page.fill('#ce-horario', 'Lun-Vie 9-13');
    await submit(page, /guardar/i);
    await expect(page.locator('#co-productos')).toHaveValue('Productos de prueba E2E', { timeout: 10000 });
  });
  // Chat embebido
  await check(A, 'Asistente virtual (botón flotante) responde', async () => {
    await page.goto('/me'); await page.waitForTimeout(1200); await closeModals(page);
    await page.getByRole('button', { name: 'Abrir asistente virtual del Polo' }).click();
    await page.waitForTimeout(2500);
    await expect(page.locator('iframe, [class*=chat]').first()).toBeVisible();
  });

  // Contraseña
  await check(A, 'Configuración: cambiar contraseña', async () => {
    await page.goto('/me'); await page.waitForTimeout(1200); await closeModals(page);
    await page.getByRole('button', { name: 'Abrir configuracion' }).click();
    await page.getByRole('button', { name: /Cambiar contraseña/ }).click();
    await page.fill('#currentPassword', PWD);
    await page.fill('#newPassword', PWD_NUEVA);
    await page.fill('#confirmPassword', PWD_NUEVA);
    await page.locator('form:has(#newPassword)').locator('button[type=submit]').click();
    await expectText(page, /actualizad|cambiad|éxito|exito/i, 15000);
  });
  await check(A, 'Cerrar sesión y volver a entrar con la contraseña nueva', async () => {
    await page.goto('/me'); await page.waitForTimeout(1200); await closeModals(page);
    await page.getByRole('button', { name: /Cerrar sesión/ }).first().click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await login(page, 'e2e_admin_empresa', PWD_NUEVA);
    await expect(page).toHaveURL(/\/me$/);
  });
  await page.context().close();
});

// ────────────────────────────── 4. Usuario público: chatbot ──────────────────────────────
test('4. Chatbot (usuario público)', async ({ browser, request }) => {
  const page = await newPage(browser, 'publico');
  const A = 'Chatbot';

  await check(A, 'Login público redirige a /chat', async () => {
    await login(page, 'e2e_publico');
    await expect(page).toHaveURL(/\/chat$/);
  });
  await check(A, 'Guard: público no puede entrar a /empresas', async () => {
    await page.goto('/empresas');
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/empresas$/);
    await page.goto('/chat'); await page.waitForTimeout(1500);
  });

  // Voz: con micrófono falso de Chromium solo hay un tono, no habla real.
  await check(A, 'Voz: modo "Voz IA" y grabación con micrófono (simulado)', async () => {
    await page.getByRole('button', { name: /Voz IA/ }).click();
    await page.getByRole('button', { name: 'mic' }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /mic|stop/ }).first().click();
    await page.waitForTimeout(6000);
    return 'Micrófono simulado: Chromium envía un tono, no voz real; la transcripción no puede validarse automáticamente';
  });
  const tk = (await (await request.post(`${API}/login`, { form: { username: 'e2e_publico', password: PWD } })).json()).access_token;
  const H = { headers: { Authorization: `Bearer ${tk}` } };
  await check(A, 'Voz (API): /api/voice/status', async () => {
    const r = await request.get(`${API}/api/voice/status`, H);
    expect(r.status()).toBe(200);
    return (await r.text()).slice(0, 150);
  });
  await check(A, 'Voz (API): síntesis de audio TTS', async () => {
    const r = await request.post(`${API}/api/voice/synthesize-base64`, { ...H, data: { text: 'Hola, soy el asistente del Polo 52' } });
    expect(r.status()).toBe(200);
    const b = await r.text();
    if (b.length < 1000) throw new Error('Respuesta de audio demasiado corta: ' + b.slice(0, 150));
    return `audio base64 de ${b.length} caracteres`;
  });

  // Como la voz real no se puede probar, se prueba el chat por escrito.
  await check(A, 'Texto: enviar pregunta escrita y recibir respuesta útil', async () => {
    await page.getByRole('button', { name: /Texto/ }).click();
    const input = page.getByPlaceholder('Escribe tu consulta...');
    await input.fill('¿Qué empresas hay en el parque?');
    await input.press('Enter');
    await expect(input).toBeEnabled({ timeout: 90000 });
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    if (/tuve un problema procesando tu consulta/i.test(body))
      throw new Error('El bot respondió "Disculpa, tuve un problema procesando tu consulta" (Gemini 403: proyecto de Google bloqueado)');
  });
  await check(A, 'Texto: pregunta sugerida (chip)', async () => {
    const chip = page.locator('.suggestion-chip').first();
    if (!(await chip.isVisible().catch(() => false))) return 'No hay chips visibles tras la primera respuesta';
    const q = (await chip.innerText()).trim();
    await chip.click();
    await expect(page.getByPlaceholder('Escribe tu consulta...')).toBeEnabled({ timeout: 90000 });
    return `Chip: "${q}"`;
  });
  await check(A, 'Pantalla completa', async () => {
    await page.locator('button:has-text("fullscreen")').click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
  });
  await check(A, 'Cerrar sesión desde el chat', async () => {
    await page.getByRole('button', { name: 'Mostrar u ocultar cerrar sesion' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Mostrar u ocultar cerrar sesion' }).click();
    await page.getByRole('button', { name: /Cerrar sesión/ }).first().click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
  await page.context().close();
});
