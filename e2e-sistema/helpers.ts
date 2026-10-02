import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { expect, Page, APIRequestContext } from '@playwright/test';

/**
 * Suite E2E del sistema completo (frontend + backend + base reales).
 *
 * Requiere el backend corriendo en API y el repo del backend en
 * E2E_BACKEND_DIR (por defecto ../../../tesis-back/totem_polo52/backend),
 * porque los datos de prueba se crean/borran con su scripts/e2e_data.py.
 */
export const API = process.env.E2E_API_URL || 'http://localhost:8000';
export const BACKEND_DIR =
  process.env.E2E_BACKEND_DIR || path.resolve(__dirname, '../../../tesis-back/totem_polo52/backend');
export const PWD = 'E2e#Prueba2026!';
export const AUTH_DIR = path.join(__dirname, '.auth');

export const CUIL = {
  poloE2E: 20999000001,
  empresa: 20999000002,
  empresa2: 20999000003,
  pendiente: 20999000010,
  rechazada: 20999000011,
  // libres, para registrar empresas nuevas desde los tests
  registro1: 20999000020,
  registro2: 20999000021,
};

export type Rol = 'admin_polo' | 'admin_empresa' | 'publico';
export const USER: Record<Rol, string> = {
  admin_polo: 'e2e_admin_polo',
  admin_empresa: 'e2e_admin_empresa',
  publico: 'e2e_publico',
};
export const storageFor = (rol: Rol) => path.join(AUTH_DIR, `${rol}.json`);

/** Corre backend/scripts/e2e_data.py y devuelve la última línea de stdout. */
export function e2eData(...args: string[]): string {
  const out = execFileSync(process.env.E2E_PYTHON || 'python', ['scripts/e2e_data.py', ...args], {
    cwd: BACKEND_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 300_000, // la conexión a Supabase a veces tarda bastante en abrirse
  });
  return out.trim().split(/\r?\n/).pop() || '';
}

/** Login por API; reintenta si el rate limit del backend (10/min por IP) devuelve 429. */
export async function apiLogin(request: APIRequestContext, username: string, password = PWD) {
  for (let i = 0; i < 8; i++) {
    const r = await request.post(`${API}/login`, { form: { username, password } });
    if (r.status() === 429) {
      await new Promise((res) => setTimeout(res, (Number(r.headers()['retry-after']) || 10) * 1000));
      continue;
    }
    expect(r.status(), `login de ${username}: ${await r.text()}`).toBe(200);
    return (await r.json()) as { access_token: string; tipo_rol: Rol };
  }
  throw new Error(`login de ${username}: rate limit persistente`);
}

export async function writeStorageState(request: APIRequestContext, rol: Rol, baseURL: string) {
  const { access_token, tipo_rol } = await apiLogin(request, USER[rol]);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(
    storageFor(rol),
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: 'sessionToken', value: access_token },
            { name: 'rol', value: tipo_rol },
            { name: 'mostrarBienvenida', value: 'false' },
          ],
        },
      ],
    })
  );
}

/**
 * El token de login dura 30 minutos y la suite completa tarda más: cada parte
 * llama a esto en su beforeAll para renovar las sesiones guardadas si tienen
 * más de 20 minutos (el storageState se lee al crear cada contexto, después).
 */
export async function refreshSessionsIfOld(request: APIRequestContext, baseURL = 'http://localhost:4200') {
  for (const rol of ['admin_polo', 'admin_empresa', 'publico'] as Rol[]) {
    const file = storageFor(rol);
    const edadMin = fs.existsSync(file) ? (Date.now() - fs.statSync(file).mtimeMs) / 60000 : Infinity;
    if (edadMin > 20) await writeStorageState(request, rol, baseURL);
  }
}

/** JWT con la forma correcta pero firma falsa (el backend lo rechaza). */
export function fakeJwt(expSecondsFromNow: number, sub = 'e2e_admin_polo'): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.firma-falsa`;
}

/** Intenta loguear por API y devuelve status/detail (sin fallar si no es 200). Espera si hay 429. */
export async function loginStatus(request: APIRequestContext, username: string, password = PWD) {
  for (let i = 0; i < 6; i++) {
    const r = await request.post(`${API}/login`, { form: { username, password } });
    if (r.status() !== 429) return { status: r.status(), detail: (await r.json()).detail as string | undefined };
    await new Promise((res) => setTimeout(res, (Number(r.headers()['retry-after']) || 10) * 1000));
  }
  throw new Error('rate limit persistente');
}

/** Responde el próximo confirm() y, al resolverse, verifica su texto
 *  (se responde siempre primero, para no dejar la página colgada). */
export function nextDialog(page: Page, accept: boolean, text?: string | RegExp) {
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

/** Abre el panel de Admin Polo y espera a que carguen los datos (si se cambia
 *  de pestaña antes, al terminar la carga el componente vuelve al Dashboard). */
export async function openAdminPolo(page: Page, tab?: string) {
  await page.goto('/empresas');
  await expect(page.locator('.kpi-number').first()).not.toHaveText('0', { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  // la pestaña Solicitudes lleva el contador en el nombre ("Solicitudes 4")
  if (tab) await page.getByRole('button', { name: new RegExp(`^${tab}( \\d+)?$`) }).first().click();
}

/** WAV con una pregunta hablada (Google TTS), generado por global-setup; Chromium
 *  lo usa como micrófono simulado para probar el circuito de voz completo. */
export const PREGUNTA_WAV = path.join(AUTH_DIR, 'pregunta.wav');
export const PREGUNTA_HABLADA = 'Hola, ¿qué empresas hay en el parque industrial?';

const bearer = (t: string) => ({ headers: { Authorization: `Bearer ${t}` } });

/** Servicio del Polo "E2E Nave Empresa" con un lote ubicado en el mapa, para la empresa E2E (idempotente). */
export async function ensureServicioPoloConLote(request: APIRequestContext) {
  const polo = (await apiLogin(request, 'e2e_admin_polo')).access_token;
  const servicios = await (await request.get(`${API}/serviciopolo`, bearer(polo))).json();
  if (servicios.some((s: any) => s.nombre === 'E2E Nave Empresa')) return;
  const sp = await (await request.post(`${API}/serviciopolo`, {
    ...bearer(polo),
    data: { nombre: 'E2E Nave Empresa', id_tipo_servicio_polo: 2, cuil: CUIL.empresa, horario: '06-22', propietario: 'inquilino', datos: { m2: 300 } },
  })).json();
  const lote = await request.post(`${API}/lotes`, {
    ...bearer(polo),
    data: { dueno: 'Prueba Automatica Cinco', manzana: 995, lote: 1, id_servicio_polo: sp.id_servicio_polo, latitud: -31.3201, longitud: -64.1302 },
  });
  expect(lote.status(), await lote.text()).toBe(200);
}

/** Contactos de la segunda empresa: uno comercial y uno interno (empresarial) (idempotente). */
export async function ensureContactosEmpresa2(request: APIRequestContext) {
  const otra = (await apiLogin(request, 'e2e_admin_empresa2')).access_token;
  const otraMe = await (await request.get(`${API}/me`, bearer(otra))).json();
  if (otraMe.contactos.length) return;
  for (const data of [
    { id_tipo_contacto: 1, nombre: 'E2E Ventas Dos', telefono: '351-000-1111', direccion: 'Calle Dos 1', datos: { correo: 'ventas.dos@example.com', pagina_web: 'https://dos.example.com' } },
    { id_tipo_contacto: 2, nombre: 'E2E Gerencia Interna', telefono: '351-000-9999', direccion: 'Oficina interna', datos: {} },
  ]) {
    const r = await request.post(`${API}/contactos`, { ...bearer(otra), data });
    expect(r.status(), await r.text()).toBe(200);
  }
}

export async function fillLogin(page: Page, username: string, password: string) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
}

export const loginError = (page: Page) => page.locator('.error-message');
