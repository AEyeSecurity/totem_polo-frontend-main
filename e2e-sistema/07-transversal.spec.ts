/**
 * PARTE 7 — Transversal: matriz de permisos por API (cada endpoint contra
 * cada rol), sesión (usuario/empresa desactivados con el token vigente,
 * logout, tokens falsificados), asignación masiva de campos, CORS y headers
 * de seguridad, límite de intentos de login y vista mobile.
 *
 * Los tests de rate limit van al final: dejan /login bloqueado ~60 s para esta IP.
 */
import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, CUIL, storageFor, apiLogin, fakeJwt, refreshSessionsIfOld } from './helpers';

test.describe.configure({ mode: 'default' });

type Quien = 'anonimo' | 'publico' | 'admin_empresa' | 'admin_polo';
const tokens: Record<Quien, string> = { anonimo: '', publico: '', admin_empresa: '', admin_polo: '' };
const auth = (t: string) => (t ? { headers: { Authorization: `Bearer ${t}` } } : {});

test.beforeAll(async ({ request }) => {
  await refreshSessionsIfOld(request);
  tokens.publico = (await apiLogin(request, 'e2e_publico')).access_token;
  tokens.admin_empresa = (await apiLogin(request, 'e2e_admin_empresa')).access_token;
  tokens.admin_polo = (await apiLogin(request, 'e2e_admin_polo')).access_token;
});

// ─────────────────────────── 7.1 Matriz de permisos ───────────────────────────
test.describe('7.1 Permisos por API (cada endpoint contra cada rol)', () => {
  // [endpoint, códigos esperados para anónimo / publico / admin_empresa / admin_polo]
  const OK = [200];
  const OK_O_SIN_DATOS = [200, 404];
  const matriz: [string, Record<Quien, number[]>][] = [
    // solo admin_polo
    ...['/empresas', '/usuarios', '/serviciopolo', '/lotes', '/polo/me', '/empresas/solicitudes', '/roles'].map(
      (p) => [p, { anonimo: [401], publico: [403], admin_empresa: [403], admin_polo: OK }] as [string, Record<Quien, number[]>]
    ),
    // solo admin_empresa
    ['/me', { anonimo: [401], publico: [403], admin_empresa: OK, admin_polo: [403] }],
    ['/companies/me/comercial', { anonimo: [401], publico: [403], admin_empresa: OK_O_SIN_DATOS, admin_polo: [403] }],
    // cualquier usuario logueado
    ['/empresas/directorio', { anonimo: [401], publico: OK, admin_empresa: OK, admin_polo: OK }],
    ['/search/contactos', { anonimo: [401], publico: OK_O_SIN_DATOS, admin_empresa: OK_O_SIN_DATOS, admin_polo: OK_O_SIN_DATOS }],
    ['/api/voice/status', { anonimo: [401], publico: OK, admin_empresa: OK, admin_polo: OK }],
    ['/api/voice/history', { anonimo: [401], publico: OK, admin_empresa: OK, admin_polo: OK }],
    // catálogos públicos
    ['/tipos/vehiculo', { anonimo: OK, publico: OK, admin_empresa: OK, admin_polo: OK }],
  ];

  for (const [path, esperado] of matriz) {
    test(`GET ${path}`, async ({ request }) => {
      const obtenido: Record<string, number> = {};
      for (const quien of Object.keys(esperado) as Quien[]) {
        obtenido[quien] = (await request.get(`${API}${path}`, auth(tokens[quien]))).status();
      }
      for (const quien of Object.keys(esperado) as Quien[]) {
        expect(esperado[quien], `${quien} → ${path} respondió ${obtenido[quien]} (todo: ${JSON.stringify(obtenido)})`).toContain(obtenido[quien]);
      }
    });
  }

  test('escrituras con el rol equivocado se rechazan', async ({ request }) => {
    const intentos: [string, Promise<{ status: () => number }>][] = [
      ['admin_empresa desactiva otra empresa', request.put(`${API}/empresas/${CUIL.empresa2}/desactivar`, auth(tokens.admin_empresa))],
      ['admin_empresa aprueba una solicitud', request.post(`${API}/empresas/${CUIL.pendiente}/aprobar`, auth(tokens.admin_empresa))],
      ['publico crea un contacto de empresa', request.post(`${API}/contactos`, { ...auth(tokens.publico), data: { id_tipo_contacto: 1, nombre: 'x', telefono: '1', direccion: 'x' } })],
      ['publico crea un usuario', request.post(`${API}/usuarios`, { ...auth(tokens.publico), data: { email: 'e2e_x@example.com', nombre: 'e2e_x', id_rol: 3, cuil: CUIL.empresa, estado: true } })],
      ['admin_polo crea un vehículo (no es empresa)', request.post(`${API}/vehiculos`, { ...auth(tokens.admin_polo), data: { id_tipo_vehiculo: 1, horarios: 'x', frecuencia: 'x', datos: {} } })],
    ];
    for (const [caso, p] of intentos) expect((await p).status(), caso).toBe(403);
  });
});

// ─────────────────────────────── 7.2 Sesión ───────────────────────────────
test.describe('7.2 Sesión y tokens', () => {
  const idDe = async (request: APIRequestContext, nombre: string) =>
    ((await (await request.get(`${API}/usuarios`, auth(tokens.admin_polo))).json()) as any[]).find((u) => u.nombre === nombre).id_usuario;

  test('si deshabilitan al usuario, su token deja de servir en el próximo pedido', async ({ request }) => {
    const t = (await apiLogin(request, 'e2e_admin_empresa2')).access_token;
    expect((await request.get(`${API}/me`, auth(t))).status()).toBe(200);
    const id = await idDe(request, 'e2e_admin_empresa2');
    await request.put(`${API}/usuarios/${id}`, { ...auth(tokens.admin_polo), data: { estado: false } });
    try {
      const r = await request.get(`${API}/me`, auth(t));
      expect(r.status()).toBe(403);
      expect((await r.json()).detail).toContain('deshabilitada');
    } finally {
      await request.put(`${API}/usuarios/${id}`, { ...auth(tokens.admin_polo), data: { estado: true } });
    }
    expect((await request.get(`${API}/me`, auth(t))).status()).toBe(200);
  });

  test('si desactivan la empresa, el token de sus usuarios deja de servir', async ({ request }) => {
    const t = (await apiLogin(request, 'e2e_admin_empresa2')).access_token;
    await request.put(`${API}/empresas/${CUIL.empresa2}/desactivar`, auth(tokens.admin_polo));
    try {
      const r = await request.get(`${API}/me`, auth(t));
      expect(r.status()).toBe(403);
      // desactivar la empresa también deshabilita a sus usuarios, pero el motivo
      // que tiene que ver el usuario es el de la empresa
      expect((await r.json()).detail).toBe('La empresa asociada está desactivada.');
    } finally {
      await request.put(`${API}/empresas/${CUIL.empresa2}/activar`, auth(tokens.admin_polo));
    }
  });

  test('tokens falsificados se rechazan (firma inválida, alg "none", vencido)', async ({ request }) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const algNone = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'e2e_admin_polo', exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    for (const [caso, t] of [['firma inválida', fakeJwt(3600)], ['alg none', algNone], ['vencido', fakeJwt(-60)], ['basura', 'no-es-un-token']]) {
      expect((await request.get(`${API}/empresas`, auth(t))).status(), caso).toBe(401);
    }
  });

  test('cerrar sesión invalida el token en el servidor', async ({ request }) => {
    const t = (await apiLogin(request, 'e2e_admin_empresa2')).access_token;
    expect((await request.get(`${API}/me`, auth(t))).status()).toBe(200);
    expect((await request.post(`${API}/logout`, auth(t))).status()).toBe(200);
    const despues = await request.get(`${API}/me`, auth(t));
    expect(despues.status(), 'el token siguió sirviendo después del logout').toBe(401);
    expect((await despues.json()).detail).toBe('Sesión cerrada');
  });
});

// ─────────────────────── 7.3 Integridad y configuración ───────────────────────
test.describe('7.3 Integridad de datos, CORS y headers', () => {
  test('una empresa no puede cambiarse nombre, rubro, estado ni CUIL desde su perfil', async ({ request }) => {
    const antes = await (await request.get(`${API}/me`, auth(tokens.admin_empresa))).json();
    const r = await request.put(`${API}/companies/me`, {
      ...auth(tokens.admin_empresa),
      data: { nombre: 'HACKEADA', rubro: 'HACKEADO', estado: false, cuil: 1, estado_solicitud: 'pendiente', horario_trabajo: 'Lun-Vie 8-17 (E2E p7)' },
    });
    expect([200, 422]).toContain(r.status());
    const despues = await (await request.get(`${API}/me`, auth(tokens.admin_empresa))).json();
    expect([despues.nombre, despues.rubro, despues.cuil, despues.estado]).toEqual([antes.nombre, antes.rubro, antes.cuil, true]);
  });

  test('CORS: solo responde a orígenes permitidos', async ({ request }) => {
    const permitido = await request.get(`${API}/tipos/vehiculo`, { headers: { Origin: 'http://localhost:4200' } });
    expect(permitido.headers()['access-control-allow-origin']).toBe('http://localhost:4200');
    const ajeno = await request.get(`${API}/tipos/vehiculo`, { headers: { Origin: 'https://sitio-malicioso.example' } });
    expect(ajeno.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('las respuestas llevan los headers de seguridad (también los errores)', async ({ request }) => {
    for (const r of [await request.get(`${API}/tipos/vehiculo`), await request.get(`${API}/empresas`)]) {
      const h = r.headers();
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['referrer-policy']).toBeTruthy();
      expect(h['strict-transport-security']).toBeTruthy();
    }
  });
});

// ─────────────────────────────── 7.4 Mobile ───────────────────────────────
test.describe('7.4 Vista mobile (Chromium con pantalla de celular)', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });
  const sinScrollHorizontal = async (page: Page, donde: string) => {
    const [ancho, visible] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(ancho, `${donde}: la página es más ancha que la pantalla (${ancho}px > ${visible}px)`).toBeLessThanOrEqual(visible + 1);
  };

  test('login y registro entran en la pantalla', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeInViewport();
    await sinScrollHorizontal(page, '/login');
    await page.goto('/register');
    await expect(page.locator('#r_cuil')).toBeVisible();
    await sinScrollHorizontal(page, '/register');
  });

  test.describe(() => {
    test.use({ storageState: storageFor('admin_polo') });
    test('Admin Polo: el menú hamburguesa navega entre pestañas y nada se desborda', async ({ page }) => {
      await page.goto('/empresas');
      await expect(page.locator('.kpi-number').first()).not.toHaveText('0', { timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      for (const tab of ['Empresas', 'Usuarios', 'Servicios Polo', 'Lotes']) {
        await page.getByRole('button', { name: 'Abrir menu' }).click();
        const menu = page.locator('.mobile-sidebar.open');
        await expect(menu).toBeVisible();
        await menu.getByRole('button', { name: new RegExp(`^${tab}( \\d+)?$`) }).click();
        await expect(page.locator('.mobile-sidebar.open')).toHaveCount(0); // se cierra al elegir
        await page.waitForTimeout(800);
        await sinScrollHorizontal(page, `Admin Polo › ${tab}`);
      }
    });
  });

  test.describe(() => {
    test.use({ storageState: storageFor('admin_empresa') });
    test('Admin Empresa: menú, pestañas y el formulario de alta entran en la pantalla', async ({ page }) => {
      await page.goto('/me');
      await expect(page.getByText('E2E_Empresa_Prueba').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      for (const tab of ['Vehiculos', 'Servicios', 'Contactos', 'Empresas']) {
        await page.getByRole('button', { name: 'Abrir menu' }).click();
        await page.locator('.mobile-sidebar.open').getByRole('button', { name: tab, exact: true }).click();
        await page.waitForTimeout(800);
        await sinScrollHorizontal(page, `Admin Empresa › ${tab}`);
      }
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await page.locator('.mobile-sidebar.open').getByRole('button', { name: 'Vehiculos', exact: true }).click();
      await page.getByRole('button', { name: /Nuevo vehiculo/ }).first().click();
      const caja = await page.locator('.modal:visible').first().boundingBox();
      expect(caja!.width, 'el formulario es más ancho que la pantalla').toBeLessThanOrEqual(412);
      await expect(page.locator('form:visible').last().getByRole('button', { name: 'Agregar' })).toBeVisible();
    });
  });

  test.describe(() => {
    test.use({ storageState: storageFor('publico') });
    test('Chat: el tótem entra en la pantalla y se puede escribir', async ({ page }) => {
      await page.goto('/chat');
      await page.getByRole('button', { name: /Texto/ }).click();
      await expect(page.getByPlaceholder('Escribe tu consulta...')).toBeInViewport();
      await sinScrollHorizontal(page, '/chat');
    });
  });
});

// ─────────────────── 7.5 Límite de intentos de login (al final) ───────────────────
test.describe('7.5 Límite de intentos de login', () => {
  test('después de 10 intentos por minuto desde la misma IP responde 429', async ({ request }) => {
    let primero429 = 0;
    for (let i = 1; i <= 12; i++) {
      // un usuario distinto por intento: así el 429 es el límite por IP y no el bloqueo por cuenta
      const r = await request.post(`${API}/login`, { form: { username: `e2e_ip_${i}`, password: 'Incorrecta123' } });
      if (r.status() === 429) { primero429 = i; break; }
    }
    expect(primero429, 'nunca respondió 429').toBeGreaterThan(0);
    expect(primero429).toBeLessThanOrEqual(11);
  });

  test('fuerza bruta contra una cuenta rotando IPs falsas: la frena el bloqueo por cuenta', async ({ request }) => {
    // Localmente uvicorn le cree a X-Forwarded-For porque la conexión viene de
    // 127.0.0.1 (proxy_headers): rotándolo cada intento "viene" de otra IP. Aun
    // así, al 6.º intento contra la MISMA cuenta el servidor la bloquea.
    const objetivo = 'e2e_cuenta_objetivo'; // no existe: no bloquea a ningún usuario de la suite
    const respuestas: { status: number; detail: string }[] = [];
    for (let i = 1; i <= 7; i++) {
      const r = await request.post(`${API}/login`, {
        form: { username: objetivo, password: `Intento${i}!` },
        headers: { 'X-Forwarded-For': `203.0.113.${100 + i}` },
      });
      respuestas.push({ status: r.status(), detail: (await r.json()).detail });
    }
    expect(respuestas.slice(0, 5).map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    expect(respuestas[5].status).toBe(429);
    expect(respuestas[5].detail).toContain('para esta cuenta');
  });
});
