/**
 * PARTE 1 — Acceso público: login, bloqueo por intentos, estados de cuenta,
 * recuperación y restablecimiento de contraseña, registro de empresas y
 * guards de rutas.
 */
import { test, expect, Page } from '@playwright/test';
import { API, PWD, CUIL, USER, e2eData, apiLogin, fakeJwt, fillLogin, loginError, storageFor, refreshSessionsIfOld } from './helpers';

// sesiones guardadas vigentes (el token dura 30 min y la suite completa tarda más)
test.beforeAll(async ({ request }) => refreshSessionsIfOld(request));

/** Login real por UI. Si el backend responde 429 (rate limit), espera y reintenta. */
async function uiLogin(page: Page, username: string, password = PWD) {
  for (let i = 0; i < 4; i++) {
    await page.goto('/login');
    await fillLogin(page, username, password);
    const r = await page.waitForResponse((r) => r.url() === `${API}/login` && r.request().method() === 'POST');
    if (r.status() !== 429) return r;
    await page.waitForTimeout((Number(r.headers()['retry-after']) || 15) * 1000);
  }
  throw new Error('rate limit de /login persistente');
}

/** Respuesta simulada del backend para /login (sin tocar el backend real). */
async function mockLogin(page: Page, status: number, body: object = { detail: 'x' }) {
  await page.route(`${API}/login`, (route) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })
  );
}

test.describe('1.1 Login: formulario', () => {
  test('la raíz y cualquier ruta desconocida llevan a /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/una-ruta-que-no-existe');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('"Iniciar Sesión" se habilita solo con usuario y contraseña', async ({ page }) => {
    await page.goto('/login');
    const btn = page.getByRole('button', { name: 'Iniciar Sesión' });
    await expect(btn).toBeDisabled();
    await page.locator('#username').fill('alguien');
    await expect(btn).toBeDisabled();
    await page.locator('#password').fill('algo123');
    await expect(btn).toBeEnabled();
  });

  test('el ojo muestra y oculta la contraseña', async ({ page }) => {
    await page.goto('/login');
    const pwd = page.locator('#password');
    await pwd.fill('secreto123');
    await expect(pwd).toHaveAttribute('type', 'password');
    await page.locator('#password ~ button, #password + button, button:near(#password)').first().click();
    await expect(pwd).toHaveAttribute('type', 'text');
  });

  test('los links llevan a registro y a Google', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Registrá tu empresa' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    // Google: solo verificamos que redirige al backend (no se completa el OAuth)
    const nav = page.waitForRequest((r) => r.url().includes('/google') || r.url().includes('accounts.google.com'));
    await page.getByRole('button', { name: /Google/ }).click();
    expect((await nav).url()).toMatch(/google/);
  });
});

test.describe('1.2 Login: credenciales reales', () => {
  for (const [rol, destino] of [['admin_polo', /\/empresas$/], ['admin_empresa', /\/me$/], ['publico', /\/chat$/]] as const) {
    test(`${rol} entra y va a su pantalla`, async ({ page }) => {
      const r = await uiLogin(page, USER[rol]);
      expect(r.status()).toBe(200);
      await expect(page.getByText('¡Inicio de sesión exitoso! Redirigiendo...')).toBeVisible();
      await expect(page).toHaveURL(destino);
      expect(await page.evaluate(() => localStorage.getItem('rol'))).toBe(rol);
    });
  }

  test('también se puede entrar con el email en vez del usuario', async ({ page }) => {
    const r = await uiLogin(page, `${USER.publico}@example.com`);
    expect(r.status()).toBe(200);
    await expect(page).toHaveURL(/\/chat$/);
  });

  test('contraseña incorrecta: mensaje con intentos restantes', async ({ page }) => {
    const r = await uiLogin(page, USER.publico, 'Incorrecta123');
    expect(r.status()).toBe(401);
    await expect(loginError(page)).toHaveText('Usuario o contraseña incorrectos. Te quedan 4 intentos.');
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('sessionToken'))).toBeNull();
  });

  const bloqueos: [string, string][] = [
    ['e2e_deshabilitado', 'Su cuenta ha sido deshabilitada. Contacte con el administrador para más información.'],
    ['e2e_pendiente', 'Tu registro está pendiente de aprobación por el administrador del Polo.'],
    ['e2e_rechazado', 'Tu solicitud de registro fue rechazada. Contactá al administrador del Polo para más información.'],
  ];
  for (const [user, msg] of bloqueos) {
    test(`cuenta bloqueada (${user}): muestra el motivo y no descuenta intentos`, async ({ page }) => {
      const r = await uiLogin(page, user);
      expect(r.status()).toBe(403);
      await expect(loginError(page)).toHaveText(msg);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});

test.describe('1.3 Login: bloqueo y errores de red (backend simulado)', () => {
  test('tras 5 intentos fallidos se bloquea 5 minutos, y el bloqueo sobrevive a recargar', async ({ page }) => {
    await mockLogin(page, 401, { detail: 'Credenciales inválidas' });
    await page.goto('/login');
    for (let quedan = 4; quedan >= 1; quedan--) {
      await fillLogin(page, 'alguien', 'Incorrecta123');
      await expect(loginError(page)).toHaveText(`Usuario o contraseña incorrectos. Te quedan ${quedan} intentos.`);
    }
    await fillLogin(page, 'alguien', 'Incorrecta123');
    await expect(loginError(page)).toContainText('Demasiados intentos fallidos. Intenta en');

    // bloqueado: un nuevo intento no llega al backend
    let llamadas = 0;
    page.on('request', (r) => r.url() === `${API}/login` && llamadas++);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await page.waitForTimeout(800);
    expect(llamadas).toBe(0);

    await page.reload();
    await expect(loginError(page)).toContainText('Demasiados intentos fallidos. Intenta en');
    await page.evaluate(() => localStorage.removeItem('loginBlock')); // no dejar el bloqueo para otros tests
  });

  test('el servidor también bloquea la cuenta tras 5 intentos (aunque se borre el bloqueo del navegador)', async ({ page, request }) => {
    // cuenta propia para no bloquear a los usuarios que usan otros tests
    const cuenta = 'e2e_deshabilitado';
    const intento = async (password: string) => {
      for (let i = 0; i < 6; i++) {
        const r = await request.post(`${API}/login`, { form: { username: cuenta, password } });
        const detail = r.status() === 429 ? (await r.json()).detail : '';
        if (r.status() === 429 && !detail.includes('esta cuenta')) {
          // es el límite por IP, no el de la cuenta: esperar y reintentar
          await page.waitForTimeout((Number(r.headers()['retry-after']) || 10) * 1000);
          continue;
        }
        return { status: r.status(), detail };
      }
      throw new Error('rate limit por IP persistente');
    };
    for (let i = 0; i < 5; i++) expect((await intento('Incorrecta123')).status).toBe(401);
    const bloqueado = await intento(PWD); // ahora con la contraseña correcta
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.detail).toContain('Demasiados intentos fallidos para esta cuenta');

    // desde el navegador, sin bloqueo local, el servidor lo sigue frenando
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('loginBlock'));
    await fillLogin(page, cuenta, PWD);
    await expect(loginError(page)).toHaveText('Demasiados intentos. Intenta más tarde.');
  });

  test('429 del backend: "Demasiados intentos. Intenta más tarde."', async ({ page }) => {
    await mockLogin(page, 429, { detail: 'Demasiadas solicitudes.' });
    await page.goto('/login');
    await fillLogin(page, 'alguien', 'Incorrecta123');
    await expect(loginError(page)).toHaveText('Demasiados intentos. Intenta más tarde.');
  });

  test('backend caído: "Error de conexión..."', async ({ page }) => {
    await page.route(`${API}/login`, (route) => route.abort('connectionrefused'));
    await page.goto('/login');
    await fillLogin(page, 'alguien', 'Incorrecta123');
    await expect(loginError(page)).toHaveText('Error de conexión. Verifica tu conexión a internet.');
  });
});

test.describe('1.4 Recuperar contraseña (modal del login)', () => {
  async function openModal(page: Page) {
    await page.goto('/login');
    await page.getByText('¿Olvidaste tu contraseña?').click();
    await expect(page.locator('#reset-email')).toBeVisible();
  }
  const enviar = (page: Page) => page.locator('form:has(#reset-email) button[type=submit]');

  test('valida el formato del email', async ({ page }) => {
    await openModal(page);
    await page.locator('#reset-email').fill('no-es-un-email');
    await expect(enviar(page)).toBeDisabled();
  });

  test('responde lo mismo exista o no el email (no permite averiguar qué cuentas hay)', async ({ page }) => {
    const respuestas: string[] = [];
    for (const email of [`${USER.publico}@example.com`, 'e2e_no_existe_nunca@example.com', 'e2e_deshabilitado@example.com']) {
      await openModal(page);
      await page.locator('#reset-email').fill(email);
      await enviar(page).click();
      const ok = page.locator('.alert--success');
      await expect(ok).toBeVisible({ timeout: 30_000 });
      respuestas.push((await ok.innerText()).trim());
    }
    expect(respuestas[0]).toContain('Si el email corresponde a una cuenta habilitada');
    expect(new Set(respuestas).size, `respuestas distintas: ${JSON.stringify(respuestas)}`).toBe(1);
  });

  test('el modal se cierra con la X', async ({ page }) => {
    await openModal(page);
    await page.locator('button[aria-label="Cerrar"]:visible').click();
    await expect(page.locator('#reset-email')).toBeHidden();
  });
});

test.describe('1.5 Restablecer contraseña (link del email)', () => {
  test('sin token o con token inválido: "Error en el Enlace"', async ({ page }) => {
    await page.goto('/reset-password?token=esto-no-es-un-token');
    await expect(page.getByRole('heading', { name: 'Error en el Enlace' }).first()).toBeVisible();
  });

  test('token vencido: "Enlace Expirado"', async ({ page }) => {
    const token = e2eData('reset-token', 'e2e_reset@example.com', '-5');
    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByText('Enlace Expirado').first()).toBeVisible();
  });

  test('token válido: cambia la contraseña, el nuevo login anda y el link no se puede reusar', async ({ page, request }) => {
    const token = e2eData('reset-token', 'e2e_reset@example.com', '60');
    await page.goto(`/reset-password?token=${token}`);
    const nueva = 'E2e#Nueva2026!';
    await page.locator('#newPassword').fill(nueva);
    await page.locator('#confirmPassword').fill(nueva);
    await page.locator('button[type=submit]').click();
    await expect(page.getByText('¡Contraseña Restablecida!').first()).toBeVisible();

    // la nueva contraseña funciona y la vieja no
    await apiLogin(request, 'e2e_reset', nueva);
    const vieja = await request.post(`${API}/login`, { form: { username: 'e2e_reset', password: PWD } });
    expect([401, 429]).toContain(vieja.status());

    // el mismo link ya no sirve
    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByText('Enlace Ya Utilizado').first()).toBeVisible();
  });

  test('las contraseñas tienen que coincidir y cumplir los requisitos', async ({ page }) => {
    const token = e2eData('reset-token', 'e2e_reset@example.com', '60');
    await page.goto(`/reset-password?token=${token}`);
    const submit = page.locator('button[type=submit]');
    await page.locator('#newPassword').fill('corta');
    await page.locator('#confirmPassword').fill('corta');
    await expect(submit).toBeDisabled();
    await page.locator('#newPassword').fill('E2e#Valida2026!');
    await page.locator('#confirmPassword').fill('E2e#Distinta2026!');
    await expect(submit).toBeDisabled();
  });
});

test.describe('1.6 Registro de empresa', () => {
  async function completar(page: Page, o: Partial<Record<'cuil' | 'nombre' | 'usuario' | 'email' | 'pwd' | 'pwd2', string>> = {}) {
    await page.goto('/register');
    await page.fill('#r_cuil', o.cuil ?? String(CUIL.registro1));
    await page.fill('#r_nombre', o.nombre ?? 'E2E_Registro_Nuevo');
    await page.fill('#r_rubro', 'Testing E2E');
    await page.fill('#r_empleados', '4');
    await page.fill('#r_horario', 'Lun-Vie 8-17');
    await page.fill('#r_obs', 'Solicitud creada por la suite E2E');
    await page.fill('#r_usuario', o.usuario ?? 'e2e_registro_nuevo');
    await page.fill('#r_email', o.email ?? 'e2e_registro_nuevo@example.com');
    await page.fill('#r_password', o.pwd ?? PWD);
    await page.fill('#r_password_confirm', o.pwd2 ?? o.pwd ?? PWD);
  }
  const enviar = (page: Page) => page.getByRole('button', { name: 'Enviar solicitud' });
  const error = (page: Page) => page.locator('.error-message');

  test('con campos vacíos no deja enviar y marca los obligatorios', async ({ page }) => {
    await page.goto('/register');
    await expect(enviar(page)).toBeDisabled();
    for (const id of ['#r_cuil', '#r_nombre', '#r_rubro', '#r_empleados', '#r_horario', '#r_usuario', '#r_email']) {
      await page.locator(id).focus();
      await page.locator(id).blur();
    }
    for (const msg of ['Ingresá el CUIL de la empresa.', 'Ingresá el nombre de la empresa.', 'Ingresá el rubro de la empresa.',
      'Ingresá la cantidad de empleados.', 'Ingresá el horario de trabajo.', 'Entre 3 y 50 caracteres.', 'Ingresá un email válido.']) {
      await expect(page.getByText(msg)).toBeVisible();
    }
  });

  test('contraseña débil: explica los requisitos', async ({ page }) => {
    await completar(page, { pwd: 'debilsinmayus1' });
    await enviar(page).click();
    await expect(error(page)).toContainText('La contraseña no cumple los requisitos');
  });

  test('contraseñas distintas: "Las contraseñas no coinciden."', async ({ page }) => {
    await completar(page, { pwd: PWD, pwd2: 'E2e#Otra2026!' });
    await enviar(page).click();
    await expect(error(page)).toHaveText('Las contraseñas no coinciden.');
  });

  test('CUIL ya registrado: lo rechaza', async ({ page }) => {
    await completar(page, { cuil: String(CUIL.empresa) });
    await enviar(page).click();
    await expect(error(page)).toContainText(/CUIL|existe|registrad/i);
  });

  test('usuario ya existente: lo rechaza', async ({ page }) => {
    await completar(page, { cuil: String(CUIL.registro2), usuario: USER.publico });
    await enviar(page).click();
    await expect(error(page)).toContainText(/usuario|existe|nombre/i);
  });

  test('registro correcto: queda como solicitud pendiente y todavía no puede entrar', async ({ page, request }) => {
    await completar(page);
    await enviar(page).click();
    await expect(page.getByText('¡Solicitud enviada!')).toBeVisible();
    await expect(page.getByText('Tu registro quedó pendiente de aprobación')).toBeVisible();

    const { access_token } = await apiLogin(request, USER.admin_polo);
    const sol = await (await request.get(`${API}/empresas/solicitudes`, { headers: { Authorization: `Bearer ${access_token}` } })).json();
    expect(sol.map((s: any) => s.nombre)).toContain('E2E_Registro_Nuevo');

    const r = await uiLogin(page, 'e2e_registro_nuevo');
    expect(r.status()).toBe(403);
    await expect(loginError(page)).toHaveText('Tu registro está pendiente de aprobación por el administrador del Polo.');
  });
});

test.describe('1.7 Guards de rutas', () => {
  for (const ruta of ['/empresas', '/me', '/chat']) {
    test(`sin sesión, ${ruta} vuelve a /login`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  const cruzados: [('admin_polo' | 'admin_empresa' | 'publico'), string, RegExp][] = [
    ['publico', '/empresas', /\/chat$/],
    ['publico', '/me', /\/chat$/],
    ['admin_empresa', '/empresas', /\/me$/],
    ['admin_polo', '/me', /\/empresas$/],
    ['admin_polo', '/chat', /\/empresas$/],
  ];
  for (const [rol, ruta, destino] of cruzados) {
    test.describe(() => {
      test.use({ storageState: storageFor(rol) });
      test(`${rol} no puede entrar a ${ruta} (lo manda a su pantalla)`, async ({ page }) => {
        await page.goto(ruta);
        await expect(page).toHaveURL(destino);
      });
    });
  }

  test.describe(() => {
    test.use({ storageState: storageFor('admin_empresa') });
    test('admin_empresa sí puede usar /chat', async ({ page }) => {
      await page.goto('/chat');
      await expect(page).toHaveURL(/\/chat$/);
    });
  });

  test('token vencido: se limpia la sesión y vuelve a /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate((t) => { localStorage.setItem('sessionToken', t); localStorage.setItem('rol', 'admin_polo'); }, fakeJwt(-60));
    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('sessionToken'))).toBeNull();
  });

  test('token basura (no es JWT): vuelve a /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => { localStorage.setItem('sessionToken', 'basura'); localStorage.setItem('rol', 'admin_polo'); });
    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('token con firma falsa: el backend lo rechaza y la app vuelve a /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate((t) => { localStorage.setItem('sessionToken', t); localStorage.setItem('rol', 'admin_polo'); }, fakeJwt(3600));
    const r401 = page.waitForResponse((r) => r.url().startsWith(API) && r.status() === 401);
    await page.goto('/empresas');
    await r401; // el backend no acepta el token
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  });

  test('cerrar sesión borra la sesión guardada', async ({ page }) => {
    await page.goto('/login');
    const { access_token } = await apiLogin(page.request, USER.admin_polo);
    await page.evaluate((t) => { localStorage.setItem('sessionToken', t); localStorage.setItem('rol', 'admin_polo'); localStorage.setItem('mostrarBienvenida', 'false'); }, access_token);
    await page.goto('/empresas');
    await page.getByRole('button', { name: /Cerrar sesión/ }).first().click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => [localStorage.getItem('sessionToken'), localStorage.getItem('rol')])).toEqual([null, null]);
    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/login$/);
  });
});
