/**
 * PARTE 3 — Admin Polo: usuarios, servicios del polo, lotes (incluida la
 * ubicación en el mapa), accesos rápidos, perfil del Polo y configuración.
 *
 * OJO: /polo/me es el Polo REAL. El test que edita sus datos guarda una copia
 * antes y la restaura al final (afterAll), aunque falle. La información
 * comercial del Polo no se guarda (solo se abre el formulario), porque crearía
 * un registro nuevo en el Polo real.
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API, PWD, CUIL, storageFor, apiLogin, loginStatus, nextDialog, openAdminPolo, refreshSessionsIfOld } from './helpers';

// sesiones guardadas vigentes (el token dura 30 min y la suite completa tarda más)
test.beforeAll(async ({ request }) => refreshSessionsIfOld(request));

test.use({ storageState: storageFor('admin_polo') });
// Orden fijo (workers: 1) pero sin cortar al primer fallo, para ver el estado completo.
test.describe.configure({ mode: 'default' });

const POLO_CUIL = 44123456789;
let token = '';
let poloOriginal: { cant_empleados: number; horario_trabajo: string; observaciones: string | null } | null = null;
const auth = () => ({ headers: { Authorization: `Bearer ${token}` } });
const list = async (request: APIRequestContext, path: string) => (await (await request.get(`${API}${path}`, auth())).json()) as any[];

const alertMsg = (page: Page) => page.locator('main .alert').first();
const modal = (page: Page) => page.locator('form:visible').last();
const row = (page: Page, table: string, text: string) => page.locator(`.table--${table} .row`).filter({ hasText: text });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'e2e_admin_polo')).access_token;
  const polo = await (await request.get(`${API}/polo/me`, auth())).json();
  poloOriginal = { cant_empleados: polo.cant_empleados, horario_trabajo: polo.horario_trabajo, observaciones: polo.observaciones };
});

test.afterAll(async ({ request }) => {
  if (!poloOriginal) return;
  const r = await request.put(`${API}/polo/me`, { ...auth(), data: poloOriginal });
  expect(r.status(), 'no se pudieron restaurar los datos del Polo real').toBe(200);
});

// ─────────────────────────────── 3.1 Usuarios ───────────────────────────────
test.describe('3.1 Usuarios', () => {
  const buscar = (page: Page) => page.getByPlaceholder('Buscar por nombre, email o empresa');
  async function abrirNuevo(page: Page) {
    await openAdminPolo(page, 'Usuarios');
    await page.getByRole('button', { name: /Nuevo usuario/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuevo usuario' })).toBeVisible();
  }
  async function completar(page: Page, o: { email: string; nombre: string; rol: string; cuil: number }) {
    await page.locator('#u_email').fill(o.email);
    await page.locator('#u_nombre').fill(o.nombre);
    await page.locator('#u_rol').selectOption({ label: o.rol });
    await page.locator('#u_cuil').fill(String(o.cuil));
    const d = nextDialog(page, true);
    await modal(page).getByRole('button', { name: 'Crear' }).click();
    await Promise.race([d, page.waitForTimeout(3000)]);
  }

  test('lista los usuarios con empresa, rol y estado; el buscador filtra y "Limpiar" restaura', async ({ page }) => {
    await openAdminPolo(page, 'Usuarios');
    await expect(row(page, 'usuarios', 'e2e_admin_empresa@example.com')).toBeVisible();
    const total = await page.locator('.table--usuarios .row').count();
    await buscar(page).fill('e2e_admin_empresa');
    const r = row(page, 'usuarios', 'e2e_admin_empresa@example.com');
    await expect(r).toContainText('E2E_Empresa_Prueba');
    await expect(r.locator('.badge').first()).toHaveText('Empresa');
    await expect(r.locator('.badge').last()).toHaveText('Habilitado');
    await buscar(page).fill('E2E_Empresa_Prueba'); // por nombre de empresa
    await expect(row(page, 'usuarios', 'e2e_publico@example.com')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar' }).first().click();
    await expect(page.locator('.table--usuarios .row')).toHaveCount(total);
  });

  test('el alta solo ofrece los roles admin_polo y publico', async ({ page }) => {
    await abrirNuevo(page);
    const opciones = await page.locator('#u_rol option').allTextContents();
    expect(opciones.map((o) => o.trim())).toEqual(['—', 'admin_polo', 'publico']);
  });

  test('valida campos obligatorios y formato de email', async ({ page }) => {
    await abrirNuevo(page);
    await page.locator('#u_email').fill('no-es-un-email');
    await page.locator('#u_email').blur();
    await modal(page).getByRole('button', { name: 'Crear' }).click();
    await expect(page.locator('#u_email')).toHaveClass(/ng-invalid/);
    await expect(page.locator('#u_nombre')).toHaveClass(/ng-invalid/);
    await expect(page.getByRole('heading', { name: 'Nuevo usuario' })).toBeVisible(); // no se creó
  });

  const rechazos: [string, { email: string; nombre: string; rol: string; cuil: number }, RegExp][] = [
    ['publico fuera de la empresa Polo', { email: 'e2e_p3_x1@example.com', nombre: 'e2e_p3_x1', rol: 'publico', cuil: CUIL.empresa }, /solo pueden crearse en la empresa Polo/],
    ['admin_polo fuera de la empresa Polo', { email: 'e2e_p3_x2@example.com', nombre: 'e2e_p3_x2', rol: 'admin_polo', cuil: CUIL.empresa }, /admin_polo solo puede asignarse/],
    ['email repetido', { email: 'e2e_publico@example.com', nombre: 'e2e_p3_x3', rol: 'publico', cuil: POLO_CUIL }, /Ya existe un usuario registrado con ese email/],
    ['CUIL inexistente', { email: 'e2e_p3_x4@example.com', nombre: 'e2e_p3_x4', rol: 'publico', cuil: 20999999999 }, /No existe una empresa registrada con CUIL|solo pueden crearse/],
  ];
  for (const [caso, datos, msg] of rechazos) {
    test(`rechaza: ${caso}`, async ({ page }) => {
      await abrirNuevo(page);
      await completar(page, datos);
      await expect(page.getByText(msg).first()).toBeVisible({ timeout: 30_000 });
    });
  }

  test('crea un usuario público en la empresa Polo', async ({ page, request }) => {
    await abrirNuevo(page);
    await completar(page, { email: 'e2e_p3_nuevo@example.com', nombre: 'e2e_p3_nuevo', rol: 'publico', cuil: POLO_CUIL });
    await expect(alertMsg(page)).toHaveText('Usuario creado. Enviamos las credenciales por email. Esto puede demorar unos minutos.', { timeout: 30_000 });
    await buscar(page).fill('e2e_p3_nuevo');
    await expect(row(page, 'usuarios', 'e2e_p3_nuevo@example.com')).toBeVisible({ timeout: 30_000 });
    const u = (await list(request, '/usuarios')).find((x) => x.nombre === 'e2e_p3_nuevo');
    expect([u.cuil, u.estado, u.roles.map((r: any) => r.tipo_rol)]).toEqual([POLO_CUIL, true, ['publico']]);
  });

  test('editar: nombre, email y CUIL bloqueados; cambiar a Inhabilitado lo deshabilita', async ({ page, request }) => {
    await openAdminPolo(page, 'Usuarios');
    await buscar(page).fill('e2e_p3_nuevo');
    await row(page, 'usuarios', 'e2e_p3_nuevo@example.com').getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar usuario' })).toBeVisible();
    for (const id of ['#u_nombre', '#u_email', '#u_cuil']) await expect(page.locator(id)).toBeDisabled();
    await expect(page.locator('#u_rol')).toHaveCount(0);
    await page.locator('#u_estado').selectOption({ label: 'Inhabilitado' });
    const d = nextDialog(page, true);
    await modal(page).getByRole('button', { name: /Guardar|Actualizar/ }).click();
    await d;
    await expect(alertMsg(page)).toHaveText('Usuario actualizado exitosamente', { timeout: 30_000 });
    await expect(row(page, 'usuarios', 'e2e_p3_nuevo@example.com').locator('.badge').last()).toHaveText('Inhabilitado');
    expect((await list(request, '/usuarios')).find((x) => x.nombre === 'e2e_p3_nuevo').estado).toBe(false);
  });

  test('habilitar / inhabilitar desde la fila (con confirmación)', async ({ page, request }) => {
    await openAdminPolo(page, 'Usuarios');
    await buscar(page).fill('e2e_p3_nuevo');
    const r = row(page, 'usuarios', 'e2e_p3_nuevo@example.com');
    let d = nextDialog(page, true, '¿Está seguro de que desea habilitar este usuario?');
    await r.getByTitle('Habilitar', { exact: true }).click();
    await d;
    await expect(alertMsg(page)).toHaveText('Usuario habilitado exitosamente', { timeout: 30_000 });
    await expect(r.locator('.badge').last()).toHaveText('Habilitado');
    d = nextDialog(page, true, '¿Está seguro de que desea inhabilitar este usuario?');
    await r.getByTitle('Inhabilitar', { exact: true }).click();
    await d;
    await expect(alertMsg(page)).toHaveText('Usuario inhabilitado exitosamente', { timeout: 30_000 });
    expect((await list(request, '/usuarios')).find((x) => x.nombre === 'e2e_p3_nuevo').estado).toBe(false);
  });

  test('un usuario inhabilitado no puede iniciar sesión', async ({ request }) => {
    // e2e_publico se inhabilita por API y se vuelve a habilitar al final
    const u = (await list(request, '/usuarios')).find((x) => x.nombre === 'e2e_publico');
    await request.put(`${API}/usuarios/${u.id_usuario}`, { ...auth(), data: { estado: false } });
    try {
      const login = await loginStatus(request, 'e2e_publico');
      expect(login.status).toBe(403);
      expect(login.detail).toContain('deshabilitada');
    } finally {
      await request.put(`${API}/usuarios/${u.id_usuario}`, { ...auth(), data: { estado: true } });
    }
  });
});

// ─────────────────────────── 3.2 Servicios del Polo ───────────────────────────
test.describe('3.2 Servicios del Polo', () => {
  const buscar = (page: Page) => page.getByPlaceholder('Buscar por nombre o empresa…');
  async function abrirNuevo(page: Page) {
    await openAdminPolo(page, 'Servicios Polo');
    await page.getByRole('button', { name: /Nuevo servicio/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuevo servicio del Polo' })).toBeVisible();
  }
  async function crear(page: Page) {
    const d = nextDialog(page, true);
    await modal(page).getByRole('button', { name: 'Crear' }).click();
    await Promise.race([d, page.waitForTimeout(3000)]);
  }

  test('coworking: "Cant. puestos" es obligatorio; otros tipos piden superficie', async ({ page }) => {
    await abrirNuevo(page);
    await page.locator('#sp_nombre').fill('E2E Validacion');
    await page.locator('#sp_cuil').fill(String(CUIL.empresa));
    await page.locator('#sp_tipo').selectOption({ label: 'coworking' });
    await expect(page.locator('#sp_puestos')).toBeVisible();
    await crear(page);
    await expect(page.locator('#sp_puestos')).toHaveClass(/ng-invalid/);
    await page.locator('#sp_tipo').selectOption({ label: 'nave' });
    await expect(page.locator('#sp_m2')).toBeVisible();
    await expect(page.locator('#sp_puestos')).toHaveCount(0);
    await crear(page);
    await expect(page.locator('#sp_m2')).toHaveClass(/ng-invalid/);
    await expect(page.getByRole('heading', { name: 'Nuevo servicio del Polo' })).toBeVisible();
  });

  test('"Propietario" / "Inquilino" muestran sus datos de contacto', async ({ page }) => {
    await abrirNuevo(page);
    await page.locator('#sp_propietario').selectOption({ label: 'Propietario' });
    await expect(page.locator('#sp_datos_prop_label')).toBeVisible();
    await page.locator('#sp_propietario').selectOption({ label: 'Inquilino' });
    await expect(page.locator('#sp_datos_inq_label')).toBeVisible();
    await expect(page.locator('#sp_datos_prop_label')).toHaveCount(0);
  });

  test('crea un coworking con propietario y queda asociado a la empresa', async ({ page, request }) => {
    await abrirNuevo(page);
    await page.locator('#sp_nombre').fill('E2E Coworking P3');
    await page.locator('#sp_tipo').selectOption({ label: 'coworking' });
    await page.locator('#sp_horario').fill('08-20');
    await page.locator('#sp_propietario').selectOption({ label: 'Propietario' });
    await page.locator('#sp_cuil').fill(String(CUIL.empresa));
    await page.locator('#sp_puestos').fill('15');
    await page.locator('#sp_m2_cw').fill('120');
    await modal(page).getByPlaceholder('Nombre').first().fill('E2E Dueño Cowork');
    await modal(page).getByPlaceholder('Contacto').first().fill('351-555-0000');
    await crear(page);
    await expect(alertMsg(page)).toHaveText('Servicio del polo creado exitosamente', { timeout: 30_000 });
    await buscar(page).fill('E2E Coworking P3');
    await expect(row(page, 'servicios', 'E2E Coworking P3')).toContainText('E2E_Empresa_Prueba');
    await expect(row(page, 'servicios', 'E2E Coworking P3')).toContainText('propietario');

    const s = (await list(request, '/serviciopolo')).find((x) => x.nombre === 'E2E Coworking P3');
    expect([s.cuil, s.horario, s.id_tipo_servicio_polo, s.datos.cant_puestos, s.datos.m2, s.datos.datos_prop.nombre]).toEqual(
      [CUIL.empresa, '08-20', 1, 15, 120, 'E2E Dueño Cowork']);
  });

  test('crea una nave con superficie', async ({ page, request }) => {
    await abrirNuevo(page);
    await page.locator('#sp_nombre').fill('E2E Nave P3');
    await page.locator('#sp_tipo').selectOption({ label: 'nave' });
    await page.locator('#sp_cuil').fill(String(CUIL.empresa));
    await page.locator('#sp_m2').fill('800');
    await crear(page);
    await expect(alertMsg(page)).toHaveText('Servicio del polo creado exitosamente', { timeout: 30_000 });
    expect((await list(request, '/serviciopolo')).find((x) => x.nombre === 'E2E Nave P3').datos.m2).toBe(800);
  });

  test('con un CUIL que no existe muestra un error claro (no un error del servidor)', async ({ page }) => {
    await abrirNuevo(page);
    await page.locator('#sp_nombre').fill('E2E Cuil Invalido');
    await page.locator('#sp_tipo').selectOption({ label: 'nave' });
    await page.locator('#sp_cuil').fill('20999999999');
    await page.locator('#sp_m2').fill('50');
    const resp = page.waitForResponse((r) => r.url() === `${API}/serviciopolo` && r.request().method() === 'POST');
    await crear(page);
    const r = await resp;
    expect(r.status(), `POST /serviciopolo con CUIL inexistente respondió ${r.status()}: ${(await r.text()).slice(0, 150)}`).toBe(400);
    await expect(modal(page)).toContainText('No existe una empresa registrada con CUIL 20999999999');
    await expect(page.getByText(/Error de conexión/)).toHaveCount(0);
  });

  test('"Ver mas" muestra el horario del servicio', async ({ page }) => {
    await openAdminPolo(page, 'Servicios Polo');
    await buscar(page).fill('E2E Coworking P3');
    const r = row(page, 'servicios', 'E2E Coworking P3');
    await r.getByRole('button', { name: 'Ver mas' }).click();
    await expect(r.locator('.horario-full')).toHaveText('08-20');
  });
});

// ─────────────────────────────── 3.3 Lotes ───────────────────────────────
test.describe('3.3 Lotes', () => {
  const buscarLote = (page: Page) => page.getByPlaceholder('Buscar por dueño, lote, manzana o servicio de polo…');
  async function abrirLote(page: Page, servicio: string) {
    await openAdminPolo(page, 'Servicios Polo');
    await page.getByPlaceholder('Buscar por nombre o empresa…').fill(servicio);
    await row(page, 'servicios', servicio).getByTitle('Agregar/Asignar lote').click();
    await expect(page.locator('#l_dueno')).toBeVisible();
  }
  async function crearLote(page: Page, dueno: string, manzana: number, lote: number) {
    await page.locator('#l_dueno').fill(dueno);
    await page.locator('#l_manzana').fill(String(manzana));
    await page.locator('#l_lote').fill(String(lote));
    const d = nextDialog(page, true);
    await modal(page).locator('button[type=submit]').click();
    await Promise.race([d, page.waitForTimeout(3000)]);
  }

  test('el dueño solo admite letras', async ({ page }) => {
    await abrirLote(page, 'E2E Coworking P3');
    await crearLote(page, 'Prueba 123', 990, 1);
    await expect(modal(page)).toContainText('solo puede contener letras y espacios', { timeout: 30_000 });
    await expect(modal(page)).not.toContainText('El dueño del lote es requerido');
  });

  test('asigna un lote al servicio', async ({ page, request }) => {
    await abrirLote(page, 'E2E Coworking P3');
    await crearLote(page, 'Prueba Automatica', 990, 1);
    await expect(alertMsg(page)).toHaveText('Lote creado exitosamente', { timeout: 30_000 });
    const l = (await list(request, '/lotes')).find((x) => x.dueno === 'Prueba Automatica');
    expect([l.manzana, l.lote, l.latitud]).toEqual([990, 1, null]);
  });

  test('no permite repetir manzana + lote', async ({ page }) => {
    await abrirLote(page, 'E2E Nave P3');
    await crearLote(page, 'Prueba Automatica Dos', 990, 1);
    await expect(page.getByText(/Ya existe un lote con número '1' en la manzana '990'/).first()).toBeVisible({ timeout: 30_000 });
  });

  test('la pestaña Lotes lo lista con su servicio y el buscador lo encuentra', async ({ page }) => {
    await openAdminPolo(page, 'Lotes');
    await buscarLote(page).fill('Prueba Automatica');
    const r = row(page, 'lotes', 'Prueba Automatica');
    await expect(r).toContainText('990');
    await expect(r).toContainText('E2E Coworking P3');
    await buscarLote(page).fill('990');
    await expect(r).toBeVisible();
  });

  test('editar ubicación: se marca un punto en el mapa y se guarda', async ({ page, request }) => {
    await openAdminPolo(page, 'Lotes');
    await buscarLote(page).fill('Prueba Automatica');
    await row(page, 'lotes', 'Prueba Automatica').getByTitle('Editar ubicación').click();
    await expect(page.getByRole('heading', { name: 'Ubicación del lote M990 - 1' })).toBeVisible();
    const guardar = page.locator('.overlay').getByRole('button', { name: 'Guardar' });
    await expect(guardar).toBeDisabled(); // sin punto marcado
    await expect(page.locator('.map-picker-error')).toHaveCount(0);
    const mapa = page.locator('google-map');
    await expect(mapa).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500); // que terminen de cargar los tiles
    await mapa.click({ position: { x: 200, y: 140 } });
    await expect(page.locator('.map-picker-coords')).toBeVisible();
    await guardar.click();
    await expect(alertMsg(page)).toHaveText('Ubicación actualizada exitosamente', { timeout: 30_000 });
    const l = (await list(request, '/lotes')).find((x) => x.dueno === 'Prueba Automatica');
    expect(l.latitud).not.toBeNull();
    expect(l.longitud).not.toBeNull();
  });

  test('eliminar un lote (con confirmación)', async ({ page, request }) => {
    await openAdminPolo(page, 'Lotes');
    await buscarLote(page).fill('Prueba Automatica');
    const d = nextDialog(page, true, '¿Está seguro de que desea eliminar este lote?');
    await row(page, 'lotes', 'Prueba Automatica').getByTitle('Eliminar lote').click();
    await d;
    await expect(alertMsg(page)).toHaveText('Lote eliminado exitosamente', { timeout: 30_000 });
    expect((await list(request, '/lotes')).find((x) => x.dueno === 'Prueba Automatica')).toBeUndefined();
  });

  test('eliminar un servicio borra también sus lotes', async ({ page, request }) => {
    await abrirLote(page, 'E2E Nave P3');
    await crearLote(page, 'Prueba Automatica Nave', 990, 2);
    await expect(alertMsg(page)).toHaveText('Lote creado exitosamente', { timeout: 30_000 });
    await page.getByPlaceholder('Buscar por nombre o empresa…').fill('E2E Nave P3');
    const d = nextDialog(page, true, '¿Está seguro de que desea eliminar este servicio del polo?');
    await row(page, 'servicios', 'E2E Nave P3').getByTitle('Eliminar servicio').click();
    await d;
    await expect(alertMsg(page)).toHaveText('Servicio del polo eliminado exitosamente', { timeout: 30_000 });
    expect((await list(request, '/serviciopolo')).find((x) => x.nombre === 'E2E Nave P3')).toBeUndefined();
    expect((await list(request, '/lotes')).find((x) => x.dueno === 'Prueba Automatica Nave')).toBeUndefined();
  });
});

// ─────────────────────────── 3.4 Dashboard y accesos ───────────────────────────
test.describe('3.4 Dashboard y accesos rápidos', () => {
  test('los contadores de servicios y lotes coinciden con la base', async ({ page, request }) => {
    const [servicios, lotes] = [await list(request, '/serviciopolo'), await list(request, '/lotes')];
    await openAdminPolo(page, 'Dashboard');
    await expect(page.locator('.kpi').filter({ hasText: 'Servicios del polo' }).locator('.kpi-number')).toHaveText(String(servicios.length));
    await expect(page.locator('.kpi').filter({ hasText: 'Lotes registrados' }).locator('.kpi-number')).toHaveText(String(lotes.length));
  });

  test('"Nuevo usuario" y "Servicio del polo" abren sus formularios', async ({ page }) => {
    await openAdminPolo(page, 'Dashboard');
    await page.locator('.quick-btn').filter({ hasText: 'Nuevo usuario' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo usuario' })).toBeVisible();
    await modal(page).getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click();
    await page.locator('.quick-btn').filter({ hasText: 'Servicio del polo' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo servicio del Polo' })).toBeVisible();
  });

  test('"Registrar lote" lleva a elegir el servicio del Polo (no lo asigna al primero sin preguntar)', async ({ page }) => {
    await openAdminPolo(page, 'Dashboard');
    await page.locator('.quick-btn').filter({ hasText: 'Registrar lote' }).click();
    await expect(page.locator('#l_dueno')).toHaveCount(0); // no abre el alta atada a ningún servicio
    await expect(alertMsg(page)).toContainText('Elegí el servicio del Polo al que pertenece el lote');
    await expect(page.getByRole('button', { name: /Nuevo servicio/ })).toBeVisible(); // pestaña Servicios Polo
  });
});

// ─────────────────────────── 3.5 Perfil del Polo ───────────────────────────
test.describe('3.5 Perfil del Polo (registro real: se restaura al final)', () => {
  test('muestra los datos del Polo', async ({ page }) => {
    await openAdminPolo(page);
    await page.getByRole('button', { name: 'Ver información del polo' }).click();
    await expect(page.locator('#ro-polo-cuil')).toHaveValue(String(POLO_CUIL));
    await expect(page.locator('#ro-polo-nombre')).toHaveValue('Parque Industrial Polo 52');
  });

  test('editar datos del Polo: guarda empleados, horario y descripción', async ({ page, request }) => {
    await openAdminPolo(page);
    await page.getByRole('button', { name: 'Ver información del polo' }).click();
    await page.getByRole('button', { name: /Editar datos/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Editar datos del Polo' })).toBeVisible();
    await page.locator('#p_cant_empleados').fill('7');
    await page.locator('#p_horario').fill('Lun-Vie 8-16 (E2E)');
    await page.locator('#p_obs').fill('Descripción temporal de la prueba E2E');
    const d = nextDialog(page, true);
    await modal(page).locator('button[type=submit]').click();
    await d;
    await expect(alertMsg(page)).toHaveText('Datos del polo actualizados exitosamente', { timeout: 30_000 });
    await expect(page.locator('#ro-polo-horario')).toHaveValue('Lun-Vie 8-16 (E2E)');
    const polo = await (await request.get(`${API}/polo/me`, auth())).json();
    expect([polo.cant_empleados, polo.horario_trabajo, polo.observaciones]).toEqual([7, 'Lun-Vie 8-16 (E2E)', 'Descripción temporal de la prueba E2E']);
  });

  test('información comercial: el formulario abre y se puede cancelar (no se guarda)', async ({ page }) => {
    await openAdminPolo(page);
    await page.getByRole('button', { name: 'Ver información del polo' }).click();
    await page.getByRole('button', { name: /Editar datos/ }).nth(1).click();
    await expect(page.getByRole('heading', { name: 'Editar informacion comercial' })).toBeVisible();
    await expect(page.locator('#ce-productos')).toBeVisible();
    await modal(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#ce-productos')).toHaveCount(0);
  });
});

// ─────────────────────────── 3.6 Configuración ───────────────────────────
test.describe('3.6 Configuración: contraseña y sesión', () => {
  // usuario propio (e2e_polo_pwd) para no romper la sesión de los demás tests
  test.use({ storageState: { cookies: [], origins: [] } });
  const NUEVA = 'E2e#PoloNueva2026!';

  async function abrirModal(page: Page) {
    await page.goto('/login');
    await page.locator('#username').fill('e2e_polo_pwd');
    await page.locator('#password').fill(PWD);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page).toHaveURL(/\/empresas$/, { timeout: 30_000 });
    await page.locator('button[aria-label="Cerrar"]:visible').first().click({ timeout: 5000 }).catch(() => {}); // bienvenida
    await page.getByRole('button', { name: 'Abrir configuración' }).click();
    await page.getByRole('button', { name: /Cambiar contraseña/ }).click();
    await expect(page.locator('#currentPassword')).toBeVisible();
  }
  const enviar = (page: Page) => page.locator('form:has(#newPassword) button[type=submit]');

  test('las contraseñas nuevas tienen que coincidir', async ({ page }) => {
    await abrirModal(page);
    await page.locator('#currentPassword').fill(PWD);
    await page.locator('#newPassword').fill(NUEVA);
    await page.locator('#confirmPassword').fill('E2e#Distinta2026!');
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
    await expect(enviar(page)).toBeDisabled();
  });

  test('contraseña actual incorrecta: lo avisa', async ({ page }) => {
    await abrirModal(page);
    await page.locator('#currentPassword').fill('E2e#Incorrecta2026!');
    await page.locator('#newPassword').fill(NUEVA);
    await page.locator('#confirmPassword').fill(NUEVA);
    await enviar(page).click();
    await expect(page.getByText(/Contraseña actual incorrecta|La contraseña actual es incorrecta/).first()).toBeVisible({ timeout: 30_000 });
  });

  test('cambia la contraseña: la nueva funciona y la vieja no', async ({ page, request }) => {
    await abrirModal(page);
    await page.locator('#currentPassword').fill(PWD);
    await page.locator('#newPassword').fill(NUEVA);
    await page.locator('#confirmPassword').fill(NUEVA);
    await enviar(page).click();
    await expect(page.getByText(/Contraseña actualizada|actualizada correctamente/i).first()).toBeVisible({ timeout: 30_000 });
    expect((await loginStatus(request, 'e2e_polo_pwd', NUEVA)).status).toBe(200);
    expect((await loginStatus(request, 'e2e_polo_pwd', PWD)).status).toBe(401);
  });

  test('"Cerrar sesión" desde Configuración', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill('e2e_polo_pwd');
    await page.locator('#password').fill(NUEVA);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page).toHaveURL(/\/empresas$/, { timeout: 30_000 });
    await page.locator('button[aria-label="Cerrar"]:visible').first().click({ timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: 'Abrir configuración' }).click();
    await page.locator('main').getByRole('button', { name: /Cerrar sesión/ }).click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
