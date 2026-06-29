export type AfterCutoffBehavior =
  | "SHOW_NEXT_WINDOW"
  | "SHOW_AFTER_CUTOFF_MESSAGE"
  | "HIDE";

export type DeliveryPromiseSettings = {
  cutoffHour: number;
  cutoffMinute?: number | null;
  timezone?: string | null;
  processingDays?: number | null;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  workingDays?: unknown;
  holidays?: unknown;
  countryRules?: unknown;
  country?: string | null;
  market?: string | null;
  afterCutoffBehavior?: AfterCutoffBehavior | string | null;
};

export type DeliveryPromise = {
  beforeCutoff: boolean;
  timeRemainingMs: number;
  shipsDate: Date;
  minDeliveryDate: Date;
  maxDeliveryDate: Date;
  afterCutoffBehavior: AfterCutoffBehavior;
  messageVariables: Record<string, string>;
};

type LocalDate = {
  year: number;
  month: number;
  day: number;
  isoWeekday: number;
};

export function calculateDeliveryPromise(
  settings: DeliveryPromiseSettings,
  now: Date,
  locale: string,
): DeliveryPromise {
  const resolvedSettings = resolveCountryRule(settings);
  const timezone = safeTimezone(resolvedSettings.timezone || "UTC");
  const cutoffMinute = clampInteger(resolvedSettings.cutoffMinute ?? 0, 0, 59);
  const cutoffHour = clampInteger(resolvedSettings.cutoffHour, 0, 23);
  const processingDays = nonNegativeInteger(
    resolvedSettings.processingDays ?? 0,
  );
  const minDeliveryDays = nonNegativeInteger(resolvedSettings.minDeliveryDays);
  const maxDeliveryDays = Math.max(
    minDeliveryDays,
    nonNegativeInteger(resolvedSettings.maxDeliveryDays),
  );
  const workingDays = parseWorkingDays(resolvedSettings.workingDays);
  const holidays = parseHolidays(resolvedSettings.holidays);
  const today = toLocalDate(getZonedParts(now, timezone));
  const cutoffDate = zonedTimeToUtc(
    today.year,
    today.month,
    today.day,
    cutoffHour,
    cutoffMinute,
    timezone,
  );
  const beforeCutoff =
    isWorkingDate(today, workingDays, holidays) &&
    now.getTime() < cutoffDate.getTime();
  const shipBaseDate = beforeCutoff
    ? today
    : nextWorkingDate(addDays(today, 1), workingDays, holidays);
  const shipsLocalDate = addWorkingDays(
    shipBaseDate,
    processingDays,
    workingDays,
    holidays,
  );
  const minDeliveryLocalDate = addWorkingDays(
    shipsLocalDate,
    minDeliveryDays,
    workingDays,
    holidays,
  );
  const maxDeliveryLocalDate = addWorkingDays(
    shipsLocalDate,
    maxDeliveryDays,
    workingDays,
    holidays,
  );
  const shipsDate = toDisplayDate(shipsLocalDate);
  const minDeliveryDate = toDisplayDate(minDeliveryLocalDate);
  const maxDeliveryDate = toDisplayDate(maxDeliveryLocalDate);
  const timeRemainingMs = beforeCutoff
    ? Math.max(0, cutoffDate.getTime() - now.getTime())
    : 0;
  const afterCutoffBehavior = normalizeAfterCutoffBehavior(
    resolvedSettings.afterCutoffBehavior,
  );

  return {
    beforeCutoff,
    timeRemainingMs,
    shipsDate,
    minDeliveryDate,
    maxDeliveryDate,
    afterCutoffBehavior,
    messageVariables: buildMessageVariables({
      locale,
      timezone,
      cutoffDate,
      timeRemainingMs,
      shipsDate,
      minDeliveryDate,
      maxDeliveryDate,
    }),
  };
}

export function formatDeliveryPromiseMessage(
  template: string,
  variables: Record<string, string>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

export function formatDeliveryTimeRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function buildMessageVariables({
  locale,
  timezone,
  cutoffDate,
  timeRemainingMs,
  shipsDate,
  minDeliveryDate,
  maxDeliveryDate,
}: {
  locale: string;
  timezone: string;
  cutoffDate: Date;
  timeRemainingMs: number;
  shipsDate: Date;
  minDeliveryDate: Date;
  maxDeliveryDate: Date;
}) {
  const dateFormatter = new Intl.DateTimeFormat(locale || "en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(locale || "en", {
    timeZone: "UTC",
    weekday: "long",
  });
  const cutoffFormatter = new Intl.DateTimeFormat(locale || "en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const minDate = dateFormatter.format(minDeliveryDate);
  const maxDate = dateFormatter.format(maxDeliveryDate);

  // Canonical snake_case tokens only — no camelCase or legacy aliases.
  return {
    cutoff_time: cutoffFormatter.format(cutoffDate),
    delivery_range: `${minDate}-${maxDate}`,
    max_delivery_date: maxDate,
    max_delivery_weekday: weekdayFormatter.format(maxDeliveryDate),
    min_delivery_date: minDate,
    min_delivery_weekday: weekdayFormatter.format(minDeliveryDate),
    ships_date: dateFormatter.format(shipsDate),
    ships_weekday: weekdayFormatter.format(shipsDate),
    time_left: formatDeliveryTimeRemaining(timeRemainingMs),
  };
}

function resolveCountryRule(settings: DeliveryPromiseSettings) {
  const rules = jsonObject(settings.countryRules) ?? {};
  const country = settings.country?.toUpperCase() ?? "";
  const market = settings.market?.toUpperCase() ?? "";
  const countryRules = jsonObject(rules.countries) ?? {};
  const marketRules = jsonObject(rules.markets) ?? {};
  const override =
    jsonObject(marketRules[market]) ||
    jsonObject(countryRules[country]) ||
    jsonObject(rules[market]) ||
    jsonObject(rules[country]) ||
    null;

  return override ? { ...settings, ...override } : settings;
}

function parseWorkingDays(value: unknown) {
  const days = new Set(
    Array.isArray(value)
      ? value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7)
      : [1, 2, 3, 4, 5],
  );

  return days.size > 0 ? days : new Set([1, 2, 3, 4, 5]);
}

function parseHolidays(value: unknown) {
  return new Set(
    Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item),
        )
      : [],
  );
}

function addWorkingDays(
  startDate: LocalDate,
  days: number,
  workingDays: Set<number>,
  holidays: Set<string>,
) {
  if (days <= 0) {
    return isWorkingDate(startDate, workingDays, holidays)
      ? startDate
      : nextWorkingDate(startDate, workingDays, holidays);
  }

  let date = startDate;
  let addedDays = 0;

  while (addedDays < days) {
    date = addDays(date, 1);

    if (isWorkingDate(date, workingDays, holidays)) {
      addedDays += 1;
    }
  }

  return date;
}

function nextWorkingDate(
  startDate: LocalDate,
  workingDays: Set<number>,
  holidays: Set<string>,
) {
  let date = startDate;

  for (let index = 0; index < 370; index += 1) {
    if (isWorkingDate(date, workingDays, holidays)) return date;
    date = addDays(date, 1);
  }

  return startDate;
}

function isWorkingDate(
  date: LocalDate,
  workingDays: Set<number>,
  holidays: Set<string>,
) {
  return workingDays.has(date.isoWeekday) && !holidays.has(formatDateKey(date));
}

function addDays(date: LocalDate, days: number): LocalDate {
  const utcDate = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days, 12),
  );
  const day = utcDate.getUTCDay();

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    isoWeekday: day === 0 ? 7 : day,
  };
}

function getZonedParts(date: Date, timezone: string) {
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
  const weekdays: Record<string, number> = {
    Fri: 5,
    Mon: 1,
    Sat: 6,
    Sun: 7,
    Thu: 4,
    Tue: 2,
    Wed: 3,
  };

  formatter.formatToParts(date).forEach((part) => {
    values[part.type] = part.value;
  });

  return {
    day: Number(values.day),
    hour: Number(values.hour),
    isoWeekday: weekdays[values.weekday] ?? 1,
    minute: Number(values.minute),
    month: Number(values.month),
    second: Number(values.second),
    year: Number(values.year),
  };
}

function zonedTimeToUtc(
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

function toLocalDate(parts: {
  year: number;
  month: number;
  day: number;
  isoWeekday: number;
}) {
  return {
    day: parts.day,
    isoWeekday: parts.isoWeekday,
    month: parts.month,
    year: parts.year,
  };
}

function toDisplayDate(date: LocalDate) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
}

function formatDateKey(date: LocalDate) {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function safeTimezone(timezone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function normalizeAfterCutoffBehavior(
  value: DeliveryPromiseSettings["afterCutoffBehavior"],
): AfterCutoffBehavior {
  if (
    value === "SHOW_NEXT_WINDOW" ||
    value === "SHOW_AFTER_CUTOFF_MESSAGE" ||
    value === "HIDE"
  ) {
    return value;
  }

  return "SHOW_NEXT_WINDOW";
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clampInteger(value: number, min: number, max: number) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : min;
}

function nonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
