// Campos candidatos por defecto para inferir la fecha de un registro cuando
// el llamador no especifica una lista propia.
const DEFAULT_DATE_FIELDS = ['updated_at', 'created_at', 'fecha'];

export function getItemDateSource(
  item: Record<string, unknown> | null | undefined,
  dateFields: string[] = DEFAULT_DATE_FIELDS
): string | null {
  if (!item) return null;
  for (const field of dateFields) {
    const candidate = item[field];
    if (
      candidate !== null &&
      candidate !== undefined &&
      String(candidate).trim() !== ''
    ) {
      return String(candidate);
    }
  }
  return null;
}

export function getItemTimestamp(
  item: Record<string, unknown> | null | undefined,
  dateFields: string[] = DEFAULT_DATE_FIELDS
): number {
  const raw = getItemDateSource(item, dateFields);
  if (!raw) return 0;
  const value = new Date(raw).getTime();
  return Number.isNaN(value) ? 0 : value;
}

/** Formatea una fecha/hora para las listas de "actividad reciente" (zona horaria Argentina). */
export function formatActivityMoment(raw?: string): string {
  if (!raw) return '-';
  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const timeZone = 'America/Argentina/Buenos_Aires';
    const dateFormatter = new Intl.DateTimeFormat('es-AR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const trimmed = String(raw).trim();
    const isDateOnly =
      /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
      /^\d{4}-\d{2}-\d{2}T00:00(?::00)?(?:\.000)?(?:Z)?$/.test(trimmed);

    return isDateOnly
      ? dateFormatter.format(date)
      : dateTimeFormatter.format(date);
  } catch {
    return '-';
  }
}
