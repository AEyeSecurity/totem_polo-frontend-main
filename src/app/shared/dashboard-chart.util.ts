// Utilidades de presentacion para los graficos del dashboard (paneles del
// Polo y de Empresa). No consultan al backend: solo transforman datos que
// los componentes ya tienen cargados.

export interface ChartSegment {
  label: string;
  count: number;
  pct: number;
  color: string;
}

/** Paleta institucional: rojo Polo 52, azul marino y tonos de apoyo. */
export const CHART_PALETTE = [
  '#a20000',
  '#2b3a62',
  '#d97706',
  '#0f766e',
  '#7c3aed',
  '#0284c7',
  '#64748b',
];

const TRACK = '#eceff4';

export function toSegments(items: { label: string; count: number }[]): ChartSegment[] {
  const total = items.reduce((acc, i) => acc + i.count, 0);
  return items.map((i, idx) => ({
    label: i.label,
    count: i.count,
    pct: total ? Math.round((i.count / total) * 100) : 0,
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
  }));
}

/** Fondo conic-gradient para un grafico de anillo con varios segmentos. */
export function donutBackground(segments: ChartSegment[]): string {
  const total = segments.reduce((acc, s) => acc + s.count, 0);
  if (!total) return `conic-gradient(${TRACK} 0 100%)`;
  let acc = 0;
  const parts = segments.map((s) => {
    const start = (acc / total) * 100;
    acc += s.count;
    const end = (acc / total) * 100;
    return `${s.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

/** Anillo de progreso de un solo valor (0-100). */
export function ringBackground(pct: number, color: string, track = 'rgba(255,255,255,0.18)'): string {
  const p = Math.max(0, Math.min(100, pct));
  return `conic-gradient(${color} 0 ${p}%, ${track} ${p}% 100%)`;
}
