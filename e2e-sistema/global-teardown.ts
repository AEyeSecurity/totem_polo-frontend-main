import { e2eData } from './helpers';

// Siempre se borra lo E2E, aunque haya tests fallidos. E2E_KEEP_DATA=1 lo
// deja en la base para inspeccionar a mano.
export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DATA === '1') return;
  const counts = JSON.parse(e2eData('cleanup'));
  const leftovers = Object.entries(counts).filter(([, n]) => n);
  if (leftovers.length) throw new Error(`Quedaron datos E2E sin borrar: ${JSON.stringify(counts)}`);
}
