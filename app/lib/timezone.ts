// Timezone-aware conversion helpers shared across the app. All merchant-entered
// dates use `<input type="datetime-local">`, which yields a wall-clock string
// ("YYYY-MM-DDTHH:mm") with no timezone. These helpers interpret and render that
// wall time in an explicit IANA timezone (the campaign's / shop's configured
// zone) instead of the Node process timezone, so stored UTC instants are
// correct regardless of where the server runs.

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoWeekday: number;
};

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

// Falls back to UTC when the timezone is not a valid IANA identifier.
export function safeTimezone(timezone: string | null | undefined) {
  if (!timezone) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

// The wall-clock parts (year/month/day/hour/...) of a UTC instant as seen in a
// given timezone.
export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
  });
  const values: Record<string, string> = {};

  formatter.formatToParts(date).forEach((part) => {
    values[part.type] = part.value;
  });

  return {
    day: Number(values.day),
    hour: Number(values.hour),
    isoWeekday: WEEKDAYS[values.weekday] ?? 1,
    minute: Number(values.minute),
    month: Number(values.month),
    second: Number(values.second),
    year: Number(values.year),
  };
}

function getZonedTimestamp(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);

  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

// A wall-clock time in `timezone` -> the corresponding UTC Date. Iterates to
// resolve DST offset changes.
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
) {
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcTimestamp = localTimestamp;

  for (let index = 0; index < 3; index += 1) {
    utcTimestamp =
      localTimestamp -
      (getZonedTimestamp(new Date(utcTimestamp), timezone) - utcTimestamp);
  }

  return new Date(utcTimestamp);
}

const DATE_TIME_LOCAL_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// Parses a `datetime-local` string as wall time in `timezone` and returns the
// UTC Date. Returns null for empty/invalid input.
export function parseDateTimeLocalInZone(
  value: string,
  timezone: string,
): Date | null {
  if (!value) return null;
  const match = DATE_TIME_LOCAL_RE.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = zonedTimeToUtc(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    safeTimezone(timezone),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

// Renders a UTC Date as a `datetime-local` string ("YYYY-MM-DDTHH:mm") showing
// the wall time in `timezone`. Returns "" for null/invalid input.
export function formatDateTimeLocalInZone(
  date: Date | string | null | undefined,
  timezone: string,
): string {
  if (!date) return "";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "";

  const parts = getZonedParts(parsed, safeTimezone(timezone));

  return (
    `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` +
    `T${pad2(parts.hour)}:${pad2(parts.minute)}`
  );
}
