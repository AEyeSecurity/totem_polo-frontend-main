import { request, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import { API, e2eData, writeStorageState, Rol, PREGUNTA_WAV, PREGUNTA_HABLADA } from './helpers';

// Parte de una base limpia: borra restos de corridas anteriores, crea los
// datos E2E y deja una sesión guardada por rol (login por API, no por UI,
// para no gastar el rate limit de /login en cada test).
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const ctx = await request.newContext();
  const health = await ctx.get(`${API}/docs`).catch(() => null);
  if (!health || !health.ok()) throw new Error(`El backend no responde en ${API}. Levantalo con uvicorn antes de correr la suite.`);

  e2eData('cleanup');
  e2eData('setup');
  for (const rol of ['admin_polo', 'admin_empresa', 'publico'] as Rol[]) {
    await writeStorageState(ctx, rol, baseURL);
  }
  await ctx.dispose();

  // Pregunta hablada para el micrófono simulado (parte 6). Si Google TTS no
  // está disponible, el test de voz por micrófono se saltea solo.
  if (!fs.existsSync(PREGUNTA_WAV)) {
    try {
      e2eData('tts-wav', PREGUNTA_HABLADA, PREGUNTA_WAV);
    } catch (e) {
      console.warn('No se pudo generar el audio de prueba (Google TTS):', e);
    }
  }
}
