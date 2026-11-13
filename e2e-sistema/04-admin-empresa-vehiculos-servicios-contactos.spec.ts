/**
 * PARTE 4 — Admin Empresa: vehículos, servicios y contactos (alta según el
 * tipo, validaciones, edición, búsqueda, borrado), contadores del dashboard y
 * aislamiento entre empresas (una empresa no puede tocar datos de otra).
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API, CUIL, storageFor, apiLogin, nextDialog, refreshSessionsIfOld } from './helpers';

// sesiones guardadas vigentes (el token dura 30 min y la suite completa tarda más)
test.beforeAll(async ({ request }) => refreshSessionsIfOld(request));

test.use({ storageState: storageFor('admin_empresa') });
// Orden fijo (workers: 1) pero sin cortar al primer fallo, para ver el estado completo.
test.describe.configure({ mode: 'default' });

let token = '';
const auth = (t = token) => ({ headers: { Authorization: `Bearer ${t}` } });
const me = async (request: APIRequestContext) => (await (await request.get(`${API}/me`, auth())).json()) as any;

const modal = (page: Page) => page.locator('form:visible').last();
const rows = (page: Page) => page.locator('main .row');
const row = (page: Page, text: string) => rows(page).filter({ hasText: text });
const msg = (page: Page, text: string) => expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

/** Abre /me en una pestaña, esperando a que cargue la empresa (si se cambia antes, vuelve al Dashboard). */
async function abrir(page: Page, tab: string) {
  await page.goto('/me');
  await expect(page.getByText('E2E_Empresa_Prueba').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: tab, exact: true }).first().click();
}
async function enviar(page: Page, boton: RegExp) {
  const d = nextDialog(page, true);
  await modal(page).getByRole('button', { name: boton }).click();
  await Promise.race([d, page.waitForTimeout(3000)]);
}

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'e2e_admin_empresa')).access_token;
});

// ─────────────────────────────── 4.1 Vehículos ───────────────────────────────
test.describe('4.1 Vehículos', () => {
  const buscar = (page: Page) => page.getByPlaceholder('Buscar por tipo, patente o datos...');
  async function nuevo(page: Page) {
    await abrir(page, 'Vehiculos');
    await page.getByRole('button', { name: /Nuevo vehiculo/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuevo vehiculo' })).toBeVisible();
  }

  test('viene con "corporativos" elegido; sin completar no se guarda y marca los obligatorios', async ({ page }) => {
    await nuevo(page);
    await expect(page.locator('#v_tipo option:checked')).toHaveText('corporativos');
    await enviar(page, /^Agregar$/);
    await expect(modal(page).getByText('Campo obligatorio.')).toHaveCount(3); // horarios, frecuencia, patente
    await expect(modal(page).getByText('Ingresa una cantidad ≥ 1.')).toBeVisible();
    await expect(modal(page).getByText('Selecciona la carga.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nuevo vehiculo' })).toBeVisible();
  });

  // Cada tipo de la tabla tipo_vehiculo (1 corporativos, 2 terceros, 3 personales)
  // tiene que mostrar SUS campos: personales lleva patente, terceros lleva carga.
  test('cada tipo muestra sus campos', async ({ page }) => {
    await nuevo(page);
    await page.locator('#v_tipo').selectOption({ label: 'corporativos' });
    for (const id of ['#v_cant_corp', '#v_pat_corp', '#v_carga_corp']) await expect(page.locator(id)).toBeVisible();
    await page.locator('#v_tipo').selectOption({ label: 'personales' });
    for (const id of ['#v_cant_per', '#v_pat_per']) await expect(page.locator(id)).toBeVisible();
    await expect(page.locator('#v_carga_corp')).toHaveCount(0);
    await page.locator('#v_tipo').selectOption({ label: 'terceros' });
    for (const id of ['#v_cant_ter', '#v_carga_ter']) await expect(page.locator(id)).toBeVisible();
    await expect(page.locator('#v_pat_per')).toHaveCount(0);
  });

  test('la cantidad tiene que ser al menos 1', async ({ page }) => {
    await nuevo(page);
    await page.locator('#v_tipo').selectOption({ label: 'terceros' });
    await page.locator('#v_cant_ter').fill('0');
    await page.locator('#v_cant_ter').blur();
    await expect(modal(page).getByText('Ingresa una cantidad ≥ 1.')).toBeVisible();
  });

  const altas: [string, (p: Page) => Promise<void>, Record<string, unknown>][] = [
    ['corporativos', async (p) => {
      await p.locator('#v_cant_corp').fill('2'); await p.locator('#v_pat_corp').fill('AE123EE'); await p.locator('#v_carga_corp').selectOption({ label: 'Alta' });
    }, { cantidad: 2, patente: 'AE123EE', carga: 'alta' }],
    ['personales', async (p) => {
      await p.locator('#v_cant_per').fill('5'); await p.locator('#v_pat_per').fill('ABC123');
    }, { cantidad: 5, patente: 'ABC123' }],
    ['terceros', async (p) => {
      await p.locator('#v_cant_ter').fill('3'); await p.locator('#v_carga_ter').selectOption({ label: 'Mediana' });
    }, { cantidad: 3, carga: 'mediana' }],
  ];
  for (const [tipo, completar, datos] of altas) {
    test(`alta de vehículos ${tipo}`, async ({ page, request }) => {
      await nuevo(page);
      await page.locator('#v_tipo').selectOption({ label: tipo });
      await page.locator('#v_horarios').fill('07-19');
      await page.locator('#v_frecuencia').fill(`E2E ${tipo}`);
      await completar(page);
      await enviar(page, /^Agregar$/);
      await msg(page, 'Vehiculo creado exitosamente');
      await expect(row(page, `E2E ${tipo}`)).toContainText(tipo);
      await expect(row(page, `E2E ${tipo}`)).toContainText('07-19');
      const v = (await me(request)).vehiculos.find((x: any) => x.frecuencia === `E2E ${tipo}`);
      expect(v.datos).toMatchObject(datos);
    });
  }

  test('el buscador filtra por tipo y por patente', async ({ page }) => {
    await abrir(page, 'Vehiculos');
    await expect(row(page, 'E2E corporativos')).toBeVisible();
    await buscar(page).fill('terceros');
    await expect(row(page, 'E2E terceros')).toBeVisible();
    await expect(row(page, 'E2E corporativos')).toHaveCount(0);
    await buscar(page).fill('AE123EE');
    await expect(row(page, 'E2E corporativos')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar' }).first().click();
    await expect(row(page, 'E2E personales')).toBeVisible();
  });

  test('editar: viene precargado y guarda los cambios', async ({ page, request }) => {
    await abrir(page, 'Vehiculos');
    await row(page, 'E2E corporativos').getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar vehiculo' })).toBeVisible();
    await expect(page.locator('#v_pat_corp')).toHaveValue('AE123EE');
    await page.locator('#v_frecuencia').fill('E2E corporativos editado');
    await page.locator('#v_cant_corp').fill('4');
    await enviar(page, /^Actualizar$/);
    await msg(page, 'Vehiculo actualizado exitosamente');
    const v = (await me(request)).vehiculos.find((x: any) => x.frecuencia === 'E2E corporativos editado');
    expect(v?.datos?.cantidad).toBe(4);
  });

  test('eliminar: cancelar no borra; confirmar sí', async ({ page, request }) => {
    await abrir(page, 'Vehiculos');
    let d = nextDialog(page, false, 'Estas seguro de que deseas eliminar este vehiculo?');
    await row(page, 'E2E terceros').getByTitle('Eliminar').click();
    await d;
    await expect(row(page, 'E2E terceros')).toBeVisible();
    d = nextDialog(page, true);
    await row(page, 'E2E terceros').getByTitle('Eliminar').click();
    await d;
    await msg(page, 'Vehiculo eliminado exitosamente');
    await expect(row(page, 'E2E terceros')).toHaveCount(0);
    expect((await me(request)).vehiculos.find((x: any) => x.frecuencia === 'E2E terceros')).toBeUndefined();
  });

  test('la patente se valida (formato viejo o Mercosur) y se guarda normalizada', async ({ page, request }) => {
    await nuevo(page);
    await page.locator('#v_tipo').selectOption({ label: 'personales' });
    await page.locator('#v_horarios').fill('07-19');
    await page.locator('#v_frecuencia').fill('E2E patente validada');
    await page.locator('#v_cant_per').fill('2');
    await page.locator('#v_pat_per').fill('!!no es patente!!');
    await page.locator('#v_pat_per').blur();
    await expect(modal(page).getByText('Formato de patente: ABC123 o AB123CD')).toBeVisible();
    // formulario inválido: no pide confirmación ni se guarda
    await modal(page).getByRole('button', { name: /^Agregar$/ }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo vehiculo' })).toBeVisible();

    await page.locator('#v_pat_per').fill('ab-123-cd, abc 123');
    await expect(modal(page).getByText('Formato de patente: ABC123 o AB123CD')).toHaveCount(0);
    await enviar(page, /^Agregar$/);
    await msg(page, 'Vehiculo creado exitosamente');
    expect((await me(request)).vehiculos.find((x: any) => x.frecuencia === 'E2E patente validada').datos.patente).toBe('AB123CD, ABC123');
  });
});

// ─────────────────────────────── 4.2 Servicios ───────────────────────────────
test.describe('4.2 Servicios', () => {
  async function nuevo(page: Page) {
    await abrir(page, 'Servicios');
    await page.getByRole('button', { name: /Nuevo servicio/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuevo servicio' })).toBeVisible();
  }

  test('viene con "agua" elegido; sin completar no se guarda', async ({ page }) => {
    await nuevo(page);
    await expect(page.locator('#s_tipo option:checked')).toHaveText('agua');
    await enviar(page, /^Agregar$/);
    await expect(modal(page).getByText('Campo obligatorio.')).toHaveCount(2); // biofiltro, aguas grises
    await expect(page.getByRole('heading', { name: 'Nuevo servicio' })).toBeVisible();
  });

  const tipos: [string, Record<string, string>, Record<string, unknown>][] = [
    ['agua', { '#s_biofiltro': 'E2E si', '#s_aguas': 'E2E reutiliza' }, { biofiltro: 'E2E si', tratamiento_aguas_grises: 'E2E reutiliza' }],
    ['espacios verdes', { '#s_abierto': 'E2E abierto', '#s_m2': '250' }, { abierto: 'E2E abierto', m2: 250 }],
    ['internet', { '#s_tipo_con': 'E2E fibra', '#s_proveedor': 'E2E Proveedor' }, { tipo: 'E2E fibra', proveedor: 'E2E Proveedor' }],
    ['residuos', { '#s_tipo_e': 'E2E reciclables', '#s_cantidad': '12' }, { tipo: 'E2E reciclables', cantidad: 12 }],
  ];
  for (const [tipo, campos, datos] of tipos) {
    test(`alta de servicio "${tipo}" con sus campos propios`, async ({ page, request }) => {
      await nuevo(page);
      await page.locator('#s_tipo').selectOption({ label: tipo });
      for (const [id, valor] of Object.entries(campos)) await page.locator(id).fill(valor);
      await enviar(page, /^Agregar$/);
      await msg(page, 'Servicio creado exitosamente');
      const s = (await me(request)).servicios.find((x: any) => JSON.stringify(x.datos).includes(Object.values(campos)[0]));
      expect(s?.datos).toMatchObject(datos);
    });
  }

  test('espacios verdes: la superficie tiene que ser al menos 1', async ({ page }) => {
    await nuevo(page);
    await page.locator('#s_tipo').selectOption({ label: 'espacios verdes' });
    await page.locator('#s_m2').fill('0');
    await page.locator('#s_m2').blur();
    await expect(modal(page).getByText('Ingresa un valor ≥ 1.')).toBeVisible();
  });

  test('el buscador encuentra un servicio por sus datos', async ({ page }) => {
    await abrir(page, 'Servicios');
    await page.getByPlaceholder('Buscar por tipo o datos...').fill('E2E Proveedor');
    await expect(rows(page)).toHaveCount(1);
  });

  test('editar un servicio', async ({ page, request }) => {
    await abrir(page, 'Servicios');
    await page.getByPlaceholder('Buscar por tipo o datos...').fill('E2E Proveedor');
    await rows(page).first().getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar servicio' })).toBeVisible();
    await expect(page.locator('#s_proveedor')).toHaveValue('E2E Proveedor');
    await page.locator('#s_proveedor').fill('E2E Proveedor Nuevo');
    await enviar(page, /^Actualizar$/);
    await msg(page, 'Servicio actualizado exitosamente');
    expect((await me(request)).servicios.some((x: any) => x.datos?.proveedor === 'E2E Proveedor Nuevo')).toBe(true);
  });

  test('eliminar un servicio', async ({ page, request }) => {
    await abrir(page, 'Servicios');
    await page.getByPlaceholder('Buscar por tipo o datos...').fill('E2E reciclables');
    const d = nextDialog(page, true, 'Estas seguro de que deseas eliminar este servicio?');
    await rows(page).first().getByTitle('Eliminar').click();
    await d;
    await msg(page, 'Servicio eliminado exitosamente');
    expect((await me(request)).servicios.some((x: any) => x.datos?.tipo === 'E2E reciclables')).toBe(false);
  });
});

// ─────────────────────────────── 4.3 Contactos ───────────────────────────────
test.describe('4.3 Contactos', () => {
  const buscar = (page: Page) => page.getByPlaceholder('Buscar por nombre, telefono o datos...');
  async function nuevo(page: Page) {
    await abrir(page, 'Contactos');
    await page.getByRole('button', { name: /Nuevo contacto/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuevo contacto' })).toBeVisible();
  }

  test('viene con "comercial" elegido; sin completar no se guarda y marca los obligatorios', async ({ page }) => {
    await nuevo(page);
    await enviar(page, /^Agregar$/);
    await expect(page.locator('#c_tipo option:checked')).toHaveText('comercial');
    for (const t of ['Ingresa un nombre.', 'Ingresa un telefono.', 'Ingresa una direccion.']) {
      await expect(modal(page).getByText(t)).toBeVisible();
    }
  });

  test('"comercial" muestra los datos comerciales y "empresarial" no', async ({ page }) => {
    await nuevo(page);
    await page.locator('#c_tipo').selectOption({ label: 'comercial' });
    await expect(page.locator('#c_datos_comerciales')).toBeVisible();
    await page.locator('#c_tipo').selectOption({ label: 'empresarial' });
    await expect(page.locator('#c_datos_comerciales')).toHaveCount(0);
  });

  test('el correo comercial tiene que ser un email válido', async ({ page }) => {
    await nuevo(page);
    await page.locator('#c_tipo').selectOption({ label: 'comercial' });
    await page.getByPlaceholder('mail@empresa.com').fill('no-es-email');
    await page.getByPlaceholder('mail@empresa.com').blur();
    await expect(page.getByPlaceholder('mail@empresa.com')).toHaveClass(/ng-invalid/);
  });

  test('alta de un contacto comercial con web, correo y redes', async ({ page, request }) => {
    await nuevo(page);
    await page.locator('#c_tipo').selectOption({ label: 'comercial' });
    await page.locator('#c_nombre').fill('E2E Ventas');
    await page.locator('#c_telefono').fill('+54 9 351 555-1111');
    await page.locator('#c_direccion').fill('Calle E2E 123, Córdoba');
    await modal(page).getByPlaceholder('https://empresa.com').fill('https://e2e.example.com');
    await modal(page).getByPlaceholder('mail@empresa.com').fill('ventas@example.com');
    await modal(page).getByPlaceholder('@empresa', { exact: true }).fill('@e2e_ventas');
    await enviar(page, /^Agregar$/);
    await msg(page, 'Contacto creado exitosamente');
    const r = row(page, 'E2E Ventas');
    await expect(r).toContainText('+54 9 351 555-1111');
    await expect(r).toContainText('ventas@example.com');
    const c = (await me(request)).contactos.find((x: any) => x.nombre === 'E2E Ventas');
    expect(c.datos).toMatchObject({ pagina_web: 'https://e2e.example.com', correo: 'ventas@example.com', redes_sociales: '@e2e_ventas' });
  });

  test('alta de un contacto empresarial', async ({ page, request }) => {
    await nuevo(page);
    await page.locator('#c_tipo').selectOption({ label: 'empresarial' });
    await page.locator('#c_nombre').fill('E2E Gerencia');
    await page.locator('#c_telefono').fill('351-555-2222');
    await page.locator('#c_direccion').fill('Oficina E2E');
    await enviar(page, /^Agregar$/);
    await msg(page, 'Contacto creado exitosamente');
    expect((await me(request)).contactos.some((x: any) => x.nombre === 'E2E Gerencia')).toBe(true);
  });

  test('el buscador filtra por nombre y por teléfono', async ({ page }) => {
    await abrir(page, 'Contactos');
    await buscar(page).fill('Gerencia');
    await expect(row(page, 'E2E Gerencia')).toBeVisible();
    await expect(row(page, 'E2E Ventas')).toHaveCount(0);
    await buscar(page).fill('555-1111');
    await expect(row(page, 'E2E Ventas')).toBeVisible();
  });

  test('editar un contacto', async ({ page, request }) => {
    await abrir(page, 'Contactos');
    await row(page, 'E2E Gerencia').getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar contacto' })).toBeVisible();
    await expect(page.locator('#c_nombre')).toHaveValue('E2E Gerencia');
    await page.locator('#c_nombre').fill('E2E Gerencia General');
    await enviar(page, /^Actualizar$/);
    await msg(page, 'Contacto actualizado exitosamente');
    expect((await me(request)).contactos.some((x: any) => x.nombre === 'E2E Gerencia General')).toBe(true);
  });

  test('eliminar un contacto', async ({ page, request }) => {
    await abrir(page, 'Contactos');
    const d = nextDialog(page, true, 'Estas seguro de que deseas eliminar este contacto?');
    await row(page, 'E2E Gerencia General').getByTitle('Eliminar').click();
    await d;
    await msg(page, 'Contacto eliminado exitosamente');
    expect((await me(request)).contactos.some((x: any) => x.nombre === 'E2E Gerencia General')).toBe(false);
  });
});

// ─────────────────────────── 4.4 Dashboard y seguridad ───────────────────────────
test.describe('4.4 Dashboard y aislamiento entre empresas', () => {
  test('los contadores del dashboard coinciden con los datos de la empresa', async ({ page, request }) => {
    const datos = await me(request);
    await page.goto('/me');
    await expect(page.getByText('E2E_Empresa_Prueba').first()).toBeVisible({ timeout: 30_000 });
    const kpi = (t: string) => page.locator('.kpi').filter({ hasText: t }).locator('.kpi-number');
    await expect(kpi('Vehiculos activos')).toHaveText(String(datos.vehiculos.length));
    await expect(kpi('Servicios')).toHaveText(String(datos.servicios.length));
    await expect(kpi('Contactos')).toHaveText(String(datos.contactos.length));
  });

  test('otra empresa no puede ver, editar ni borrar los registros de esta', async ({ request }) => {
    const propios = await me(request);
    const v = propios.vehiculos[0], s = propios.servicios[0], c = propios.contactos[0];
    expect(v && s && c, 'faltan registros propios para probar').toBeTruthy();
    const otra = (await apiLogin(request, 'e2e_admin_empresa2')).access_token;

    const deOtra = await (await request.get(`${API}/me`, auth(otra))).json();
    expect(deOtra.cuil).toBe(CUIL.empresa2);
    expect(deOtra.vehiculos.map((x: any) => x.id_vehiculo)).not.toContain(v.id_vehiculo);

    const intentos = [
      // body completo y válido (VehiculoUpdate exige las 5 claves), para que lo
      // que se pruebe sea el control de pertenencia y no la validación
      request.put(`${API}/vehiculos/${v.id_vehiculo}`, {
        ...auth(otra),
        data: { id_vehiculo: v.id_vehiculo, id_tipo_vehiculo: v.id_tipo_vehiculo, horarios: v.horarios, frecuencia: 'HACKEADO', datos: v.datos },
      }),
      request.delete(`${API}/vehiculos/${v.id_vehiculo}`, auth(otra)),
      request.put(`${API}/servicios/${s.id_servicio}`, { ...auth(otra), data: { datos: { x: 'HACKEADO' } } }),
      request.delete(`${API}/servicios/${s.id_servicio}`, auth(otra)),
      request.put(`${API}/contactos/${c.id_contacto}`, { ...auth(otra), data: { id_tipo_contacto: c.id_tipo_contacto, nombre: 'HACKEADO' } }),
      request.delete(`${API}/contactos/${c.id_contacto}`, auth(otra)),
    ];
    for (const r of await Promise.all(intentos)) {
      expect(r.status(), `${r.url()} respondió ${r.status()}`).toBe(404);
    }
    const despues = await me(request);
    expect(despues.vehiculos.find((x: any) => x.id_vehiculo === v.id_vehiculo).frecuencia).toBe(v.frecuencia);
    expect(despues.contactos.find((x: any) => x.id_contacto === c.id_contacto).nombre).toBe(c.nombre);
  });

  test('un usuario público no puede crear registros de empresa', async ({ request }) => {
    const publico = (await apiLogin(request, 'e2e_publico')).access_token;
    const r = await request.post(`${API}/vehiculos`, {
      ...auth(publico), data: { id_tipo_vehiculo: 1, horarios: '08-18', frecuencia: 'x', datos: { cantidad: 1 } },
    });
    expect(r.status()).toBe(403);
  });
});
