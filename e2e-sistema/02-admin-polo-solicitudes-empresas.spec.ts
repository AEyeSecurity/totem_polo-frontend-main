/**
 * PARTE 2 — Admin Polo: dashboard, solicitudes de registro (aprobar,
 * rechazar, re-aprobar) y gestión de empresas (buscar, editar, activar /
 * desactivar, agregar usuario, servicio del polo para la empresa).
 *
 * Los tests de cada describe dependen del anterior (corren en orden): se crean las
 * solicitudes por la API pública de registro y se siguen por todo el flujo.
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API, PWD, CUIL, storageFor, apiLogin, refreshSessionsIfOld } from './helpers';

// sesiones guardadas vigentes (el token dura 30 min y la suite completa tarda más)
test.beforeAll(async ({ request }) => refreshSessionsIfOld(request));

test.use({ storageState: storageFor('admin_polo') });
// Orden fijo (workers: 1) pero sin cortar al primer fallo, para ver el estado completo.
test.describe.configure({ mode: 'default' });

const SOL = {
  aprobar: { cuil: 20999000030, nombre: 'E2E_Sol_Aprobar', usuario: 'e2e_sol_aprobar' },
  rechazar: { cuil: 20999000031, nombre: 'E2E_Sol_Rechazar', usuario: 'e2e_sol_rechazar' },
  cancelar: { cuil: 20999000032, nombre: 'E2E_Sol_Cancelar', usuario: 'e2e_sol_cancelar' },
};

let token = '';
const auth = () => ({ headers: { Authorization: `Bearer ${token}` } });
const getEmpresa = async (request: APIRequestContext, cuil: number) =>
  ((await (await request.get(`${API}/empresas`, auth())).json()) as any[]).find((e) => e.cuil === cuil);
const getUsuario = async (request: APIRequestContext, nombre: string) =>
  ((await (await request.get(`${API}/usuarios`, auth())).json()) as any[]).find((u) => u.nombre === nombre);
const loginStatus = async (request: APIRequestContext, username: string) => {
  for (let i = 0; i < 6; i++) {
    const r = await request.post(`${API}/login`, { form: { username, password: PWD } });
    if (r.status() !== 429) return { status: r.status(), detail: (await r.json()).detail as string | undefined };
    await new Promise((res) => setTimeout(res, (Number(r.headers()['retry-after']) || 10) * 1000));
  }
  throw new Error('rate limit persistente');
};

/** Responde el próximo confirm() y, al resolverse, verifica su texto
 *  (se responde siempre primero, para no dejar la página colgada). */
function nextDialog(page: Page, accept: boolean, text?: string | RegExp) {
  return new Promise<void>((resolve, reject) => {
    page.once('dialog', async (d) => {
      const msg = d.message();
      accept ? await d.accept() : await d.dismiss();
      try {
        if (text) expect(msg).toMatch(text);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function openAdmin(page: Page, tab?: string) {
  await page.goto('/empresas');
  // esperar a que carguen los datos: si se cambia de pestaña antes, al terminar
  // la carga el componente vuelve solo al Dashboard
  await expect(page.locator('.kpi-number').first()).not.toHaveText('0', { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  // la pestaña Solicitudes lleva el contador en el nombre ("Solicitudes 4")
  if (tab) await page.getByRole('button', { name: new RegExp(`^${tab}( \\d+)?$`) }).first().click();
}
const empresaRow = (page: Page, text: string) => page.locator('.table--empresas .row').filter({ hasText: text });
const solicitudRow = (page: Page, text: string) => page.locator('.table--solicitudes .row').filter({ hasText: text });
const alertMsg = (page: Page) => page.locator('main .alert').first();
const buscarEmpresa = (page: Page) => page.getByPlaceholder('Buscar por nombre, CUIL o rubro…');

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'e2e_admin_polo')).access_token;
  // Tras un test fallido Playwright reinicia el worker y vuelve a correr este
  // beforeAll: solo se registran las solicitudes que todavía no existen.
  const existentes = new Set(((await (await request.get(`${API}/empresas`, auth())).json()) as any[]).map((e) => e.cuil));
  for (const s of Object.values(SOL).filter((s) => !existentes.has(s.cuil))) {
    for (let intento = 0; ; intento++) {
      const r = await request.post(`${API}/register`, {
        data: {
          cuil: s.cuil, nombre: s.nombre, rubro: 'Testing E2E', cant_empleados: 5, horario_trabajo: 'Lun-Vie 8-17',
          observaciones: 'Solicitud de la parte 2', usuario_nombre: s.usuario, email: `${s.usuario}@example.com`, password: PWD,
        },
      });
      if (r.status() === 429 && intento < 6) {
        await new Promise((res) => setTimeout(res, (Number(r.headers()['retry-after']) || 10) * 1000));
        continue;
      }
      expect(r.status(), await r.text()).toBeLessThan(300);
      break;
    }
  }
});

test.describe('2.1 Dashboard', () => {
  test('los contadores coinciden con lo que hay en la base', async ({ page, request }) => {
    const empresas = await (await request.get(`${API}/empresas`, auth())).json();
    const usuarios = await (await request.get(`${API}/usuarios`, auth())).json();
    await openAdmin(page, 'Dashboard');
    const kpi = (titulo: string) => page.locator('.kpi').filter({ hasText: titulo });
    await expect(kpi('Empresas activas').locator('.kpi-sub')).toHaveText(`de ${empresas.length} registradas`);
    await expect(kpi('Empresas activas').locator('.kpi-number')).toHaveText(String(empresas.filter((e: any) => e.estado).length));
    await expect(kpi('Usuarios habilitados').locator('.kpi-sub')).toHaveText(`de ${usuarios.length} usuarios`);
    await expect(kpi('Usuarios habilitados').locator('.kpi-number')).toHaveText(String(usuarios.filter((u: any) => u.estado).length));
  });

  test('la pestaña Solicitudes muestra cuántas hay pendientes', async ({ page, request }) => {
    const pendientes = await (await request.get(`${API}/empresas/solicitudes`, auth())).json();
    await openAdmin(page);
    await expect(page.getByRole('button', { name: /Solicitudes/ }).first().locator('.tab-badge')).toHaveText(String(pendientes.length));
  });

  test('"Solicitudes pendientes" (acceso rápido) lleva a la pestaña', async ({ page }) => {
    await openAdmin(page, 'Dashboard');
    await page.getByRole('button', { name: /Solicitudes pendientes/ }).click();
    await expect(page.getByRole('heading', { name: 'Solicitudes de registro pendientes' })).toBeVisible();
  });
});

test.describe('2.2 Solicitudes de registro', () => {
  test('lista las pendientes con empresa, rubro, usuario y email', async ({ page }) => {
    await openAdmin(page, 'Solicitudes');
    for (const s of Object.values(SOL)) {
      const row = solicitudRow(page, s.nombre);
      await expect(row).toContainText(String(s.cuil));
      await expect(row).toContainText('Testing E2E');
      await expect(row).toContainText(s.usuario);
      await expect(row).toContainText(`${s.usuario}@example.com`);
    }
  });

  test('cancelar la confirmación no cambia nada', async ({ page, request }) => {
    await openAdmin(page, 'Solicitudes');
    const d = nextDialog(page, false, `¿Aprobar el registro de "${SOL.cancelar.nombre}"?`);
    await solicitudRow(page, SOL.cancelar.nombre).getByTitle('Aprobar').click();
    await d;
    await expect(solicitudRow(page, SOL.cancelar.nombre)).toBeVisible();
    expect((await getEmpresa(request, SOL.cancelar.cuil)).estado_solicitud).toBe('pendiente');
  });

  test('aprobar: sale de la lista, la empresa y su usuario quedan activos y puede entrar', async ({ page, request }) => {
    await openAdmin(page, 'Solicitudes');
    const d = nextDialog(page, true, `¿Aprobar el registro de "${SOL.aprobar.nombre}"?`);
    await solicitudRow(page, SOL.aprobar.nombre).getByTitle('Aprobar').click();
    await d;
    await expect(alertMsg(page)).toHaveText(`Empresa '${SOL.aprobar.nombre}' aprobada`, { timeout: 30_000 });
    await expect(solicitudRow(page, SOL.aprobar.nombre)).toHaveCount(0);

    const e = await getEmpresa(request, SOL.aprobar.cuil);
    expect([e.estado, e.estado_solicitud]).toEqual([true, 'aprobada']);
    expect((await loginStatus(request, SOL.aprobar.usuario)).status).toBe(200);
  });

  test('rechazar: sale de la lista, queda inactiva y el login explica el rechazo', async ({ page, request }) => {
    await openAdmin(page, 'Solicitudes');
    const d = nextDialog(page, true, `¿Rechazar el registro de "${SOL.rechazar.nombre}"?`);
    await solicitudRow(page, SOL.rechazar.nombre).getByTitle('Rechazar').click();
    await d;
    await expect(alertMsg(page)).toHaveText(`Solicitud de '${SOL.rechazar.nombre}' rechazada`, { timeout: 30_000 });
    await expect(solicitudRow(page, SOL.rechazar.nombre)).toHaveCount(0);

    const e = await getEmpresa(request, SOL.rechazar.cuil);
    expect([e.estado, e.estado_solicitud]).toEqual([false, 'rechazada']);
    const login = await loginStatus(request, SOL.rechazar.usuario);
    expect(login.status).toBe(403);
    expect(login.detail).toContain('rechazada');
  });

  test('la actividad reciente registra la aprobación y el rechazo', async ({ page }) => {
    // la actividad es de la sesión actual: se aprueba/rechaza y se mira el dashboard sin recargar
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(SOL.rechazar.nombre);
    const d = nextDialog(page, true);
    await empresaRow(page, SOL.rechazar.nombre).getByTitle('Aprobar solicitud (rechazada)').click();
    await d;
    await expect(alertMsg(page)).toHaveText(`Empresa '${SOL.rechazar.nombre}' aprobada`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click();
    await expect(page.locator('.activity-list')).toContainText(`Solicitud de ${SOL.rechazar.nombre} aprobada`);
  });

  test('una rechazada se puede aprobar después desde Empresas y ya puede entrar', async ({ request }) => {
    // (la aprobó el test anterior desde Empresas)
    const e = await getEmpresa(request, SOL.rechazar.cuil);
    expect([e.estado, e.estado_solicitud]).toEqual([true, 'aprobada']);
    expect((await loginStatus(request, SOL.rechazar.usuario)).status).toBe(200);
  });

  test('una pendiente aparece en Empresas como inactiva y con "Aprobar", sin poder editarla', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(SOL.cancelar.nombre);
    const row = empresaRow(page, SOL.cancelar.nombre);
    await expect(row.locator('.badge')).toHaveText('Inactiva');
    await expect(row.getByTitle('Aprobar solicitud (pendiente)')).toBeEnabled();
    await expect(row.getByTitle('Activar empresa', { exact: true })).toHaveCount(0);
    for (const t of ['Editar', 'Servicio del Polo para empresa', 'Agregar usuario a la empresa']) {
      await expect(row.getByTitle(t)).toBeDisabled();
    }
  });

  test('API: /activar rechaza una solicitud pendiente', async ({ request }) => {
    const r = await request.put(`${API}/empresas/${SOL.cancelar.cuil}/activar`, auth());
    expect(r.status()).toBe(400);
    expect((await r.json()).detail).toContain('Aprobala desde Solicitudes');
  });

  test('API: editar la empresa no permite activar una solicitud pendiente', async ({ request }) => {
    const r = await request.put(`${API}/empresas/${SOL.cancelar.cuil}`, { ...auth(), data: { estado: true } });
    const e = await getEmpresa(request, SOL.cancelar.cuil);
    expect(e.estado, `PUT /empresas/{cuil} respondió ${r.status()} y dejó estado=${e.estado} con solicitud ${e.estado_solicitud}`).toBe(false);
  });
});

test.describe('2.3 Empresas', () => {
  const E = SOL.aprobar; // empresa ya aprobada en 2.2, se usa para editar/activar/desactivar

  test('el buscador filtra por nombre, CUIL y rubro, y "Limpiar" vuelve a mostrar todo', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await expect(empresaRow(page, E.nombre)).toBeVisible(); // esperar a que cargue la lista
    const total = await page.locator('.table--empresas .row').count();
    expect(total).toBeGreaterThan(3);
    await buscarEmpresa(page).fill(E.nombre);
    await expect(page.locator('.table--empresas .row')).toHaveCount(1);
    await buscarEmpresa(page).fill(String(E.cuil));
    await expect(page.locator('.table--empresas .row')).toHaveCount(1);
    await buscarEmpresa(page).fill('Testing E2E');
    await expect(empresaRow(page, E.nombre)).toBeVisible();
    await buscarEmpresa(page).fill('zzz-no-existe-ninguna');
    await expect(page.locator('.table--empresas .row')).toHaveCount(0);
    await page.getByRole('button', { name: 'Limpiar' }).first().click();
    await expect(buscarEmpresa(page)).toHaveValue('');
    await expect(page.locator('.table--empresas .row')).toHaveCount(total);
  });

  test('"Ver mas" / "Ocultar" muestra el horario', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    const row = empresaRow(page, E.nombre);
    await row.getByRole('button', { name: 'Ver mas' }).click();
    await expect(row.locator('.horario-full')).toHaveText('Lun-Vie 8-17');
    await row.getByRole('button', { name: 'Ocultar' }).click();
    await expect(row.locator('.horario-full')).toHaveCount(0);
  });

  test('editar: el formulario viene precargado, el CUIL no se puede cambiar y el nombre es obligatorio', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Editar').click();
    await expect(page.locator('#e_cuil')).toBeDisabled();
    await expect(page.locator('#e_cuil')).toHaveValue(String(E.cuil));
    await expect(page.locator('#e_nombre')).toHaveValue(E.nombre);
    await expect(page.locator('#e_rubro')).toHaveValue('Testing E2E');
    await page.locator('#e_nombre').fill('');
    const d = nextDialog(page, true);
    await page.locator('form:visible button[type=submit]').click();
    await Promise.race([d, page.waitForTimeout(1500)]);
    await expect(page.locator('form:visible')).toContainText(/nombre/i);
    await expect(page.locator('#e_nombre')).toBeVisible(); // no se cerró ni guardó
  });

  test('editar: guarda nombre, rubro, empleados, horario y descripción', async ({ page, request }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Editar').click();
    await page.locator('#e_nombre').fill(`${E.nombre}_Editada`);
    await page.locator('#e_rubro').fill('Testing E2E Editado');
    await page.locator('#e_empleados').fill('12');
    await page.locator('#e_horario').fill('Lun-Sab 7-19');
    await page.locator('#e_obs').fill('Descripción editada por la parte 2');
    const d = nextDialog(page, true);
    await page.locator('form:visible button[type=submit]').click();
    await d;
    await expect(alertMsg(page)).toHaveText('Empresa actualizada exitosamente', { timeout: 30_000 });
    await buscarEmpresa(page).fill(`${E.nombre}_Editada`);
    await expect(empresaRow(page, `${E.nombre}_Editada`)).toContainText('Testing E2E Editado');
    await expect(empresaRow(page, `${E.nombre}_Editada`)).toContainText('12');

    const e = await getEmpresa(request, E.cuil);
    expect([e.nombre, e.rubro, e.cant_empleados, e.horario_trabajo, e.observaciones]).toEqual(
      [`${E.nombre}_Editada`, 'Testing E2E Editado', 12, 'Lun-Sab 7-19', 'Descripción editada por la parte 2']);
  });

  test('cerrar el formulario con cambios sin guardar pide confirmación y no guarda', async ({ page, request }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Editar').click();
    await page.locator('#e_rubro').fill('NO SE DEBE GUARDAR');
    const d = nextDialog(page, true, /cambios|descartar|guardad/i);
    await page.locator('form:visible').getByRole('button', { name: 'Cancelar' }).click();
    await d;
    await expect(page.locator('#e_rubro')).toBeHidden();
    expect((await getEmpresa(request, E.cuil)).rubro).toBe('Testing E2E Editado');
  });

  test('desactivar: queda inactiva, sus usuarios también y no pueden entrar', async ({ page, request }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    const row = empresaRow(page, E.nombre);
    const d = nextDialog(page, true, `¿Seguro que deseas desactivar la empresa "${E.nombre}_Editada"?`);
    await row.getByTitle('Desactivar empresa', { exact: true }).click();
    await d;
    await expect(alertMsg(page)).toHaveText('Empresa desactivada correctamente', { timeout: 30_000 });
    await expect(row.locator('.badge')).toHaveText('Inactiva');
    for (const t of ['Editar', 'Servicio del Polo para empresa', 'Agregar usuario a la empresa']) {
      await expect(row.getByTitle(t)).toBeDisabled();
    }
    expect((await getEmpresa(request, E.cuil)).estado).toBe(false);
    expect((await getUsuario(request, E.usuario)).estado).toBe(false);
    expect((await loginStatus(request, E.usuario)).status).toBe(403);
  });

  test('activar: vuelve a estar activa junto con sus usuarios', async ({ page, request }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    const row = empresaRow(page, E.nombre);
    const d = nextDialog(page, true, `¿Seguro que deseas activar la empresa "${E.nombre}_Editada"?`);
    await row.getByTitle('Activar empresa', { exact: true }).click();
    await d;
    await expect(alertMsg(page)).toHaveText('Empresa activada correctamente', { timeout: 30_000 });
    await expect(row.locator('.badge')).toHaveText('Activa');
    expect((await getUsuario(request, E.usuario)).estado).toBe(true);
    expect((await loginStatus(request, E.usuario)).status).toBe(200);
  });

  test('desactivar desde el formulario (Estado: Inactiva) también desactiva a sus usuarios', async ({ page, request }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Editar').click();
    await page.locator('#e_estado').selectOption({ label: 'Inactiva' });
    const d = nextDialog(page, true);
    await page.locator('form:visible button[type=submit]').click();
    await d;
    await expect(alertMsg(page)).toHaveText('Empresa actualizada exitosamente', { timeout: 30_000 });
    expect((await getEmpresa(request, E.cuil)).estado).toBe(false);
    const u = await getUsuario(request, E.usuario);
    // se deja activa de nuevo para los tests siguientes antes de verificar
    await request.put(`${API}/empresas/${E.cuil}/activar`, auth());
    expect(u.estado, 'el usuario de la empresa quedó habilitado aunque la empresa se desactivó').toBe(false);
  });

  test('agregar usuario: valida nombre y email', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Agregar usuario a la empresa').click();
    await page.locator('#au_nombre').fill('ab');
    await page.locator('#au_email').fill('no-es-email');
    await page.locator('form:has(#au_nombre) button[type=submit]').click();
    await expect(page.getByText('Ingresá entre 3 y 50 caracteres.')).toBeVisible();
    await expect(page.getByText('Ingresá un email válido.')).toBeVisible();
  });

  test('agregar usuario: rechaza un nombre de usuario que ya existe', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Agregar usuario a la empresa').click();
    await page.locator('#au_nombre').fill('e2e_publico');
    await page.locator('#au_email').fill('e2e_otro_mail@example.com');
    await page.locator('form:has(#au_nombre) button[type=submit]').click();
    // (el mensaje se muestra en el modal y también en el aviso general de la página)
    await expect(page.locator('form:has(#au_nombre)').getByText('Ya existe un usuario con ese nombre')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#au_nombre')).toBeVisible();
  });

  test('agregar usuario: lo crea como admin_empresa de esa empresa y aparece en Usuarios', async ({ page, request }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Agregar usuario a la empresa').click();
    await page.locator('#au_nombre').fill('e2e_agregado_p2');
    await page.locator('#au_email').fill('e2e_agregado_p2@example.com');
    await page.locator('form:has(#au_nombre) button[type=submit]').click();
    await expect(alertMsg(page)).toContainText(`Usuario creado para ${E.nombre}`, { timeout: 30_000 });

    const u = await getUsuario(request, 'e2e_agregado_p2');
    expect(u.cuil).toBe(E.cuil);
    expect(u.estado).toBe(true);
    expect(u.roles.map((r: any) => r.tipo_rol)).toEqual(['admin_empresa']);

    await page.getByRole('button', { name: 'Usuarios', exact: true }).first().click();
    await page.getByPlaceholder('Buscar por nombre, email o empresa').fill('e2e_agregado_p2');
    await expect(page.getByText('e2e_agregado_p2@example.com')).toBeVisible();
  });

  test('"Servicio del Polo para empresa" abre el alta con el CUIL de la empresa', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await buscarEmpresa(page).fill(E.nombre);
    await empresaRow(page, E.nombre).getByTitle('Servicio del Polo para empresa').click();
    await expect(page.getByRole('heading', { name: 'Nuevo servicio del Polo' })).toBeVisible();
    await expect(page.locator('#sp_cuil')).toHaveValue(String(E.cuil));
    await page.locator('form:visible').getByRole('button', { name: 'Cancelar' }).click();
  });

  test('"Ver solicitudes de registro" lleva a la pestaña de solicitudes', async ({ page }) => {
    await openAdmin(page, 'Empresas');
    await page.getByRole('button', { name: /Ver solicitudes de registro/ }).click();
    await expect(page.getByRole('heading', { name: 'Solicitudes de registro pendientes' })).toBeVisible();
  });
});
