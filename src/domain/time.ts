const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_OFFSET = "-03:00";

function argentinaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function toArgentinaDateTimeLocal(date = new Date()) {
  const parts = argentinaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function argentinaLocalInputToIso(value: string) {
  return new Date(`${value}:00${ARGENTINA_OFFSET}`).toISOString();
}

export function getArgentinaDayRange(date = new Date()) {
  const parts = argentinaDateParts(date);
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00${ARGENTINA_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function formatArgentinaTime(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
