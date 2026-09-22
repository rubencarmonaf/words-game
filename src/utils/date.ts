/**
 * El reto diario cambia de día a medianoche en España, no a medianoche UTC — en verano
 * (CEST, UTC+2) eso son las 2 de la madrugada española, y el reto cambiaba dos horas antes
 * de lo que debía. `Intl` con `timeZone: 'Europe/Madrid'` ya sabe cuándo cambia el horario de
 * verano, así que no hace falta calcular el desfase a mano ni mantenerlo actualizado.
 */
const SPAIN_TZ = 'Europe/Madrid';

const wallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SPAIN_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

function spainWallClock(date: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of wallClockFormatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

/** La fecha de hoy en España, en formato YYYY-MM-DD. */
export function todayInSpain(date: Date = new Date()): string {
  const p = spainWallClock(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Milisegundos que faltan hasta la próxima medianoche en España (para la cuenta atrás del
 * reto diario). El día de un cambio de hora dura menos o más de 24h de verdad — es correcto,
 * no un fallo: esta cuenta sale siempre de la hora española real en este instante. */
export function msUntilNextMidnightInSpain(date: Date = new Date()): number {
  const p = spainWallClock(date);
  const hour = Number(p.hour) % 24; // Intl puede dar "24" justo en la medianoche
  const msSinceMidnight = (hour * 3600 + Number(p.minute) * 60 + Number(p.second)) * 1000 + date.getMilliseconds();
  return 24 * 60 * 60 * 1000 - msSinceMidnight;
}
