export type TimerMode =
  | "FIXED_DATE"
  | "EVERGREEN_SESSION"
  | "RECURRING_DAILY"
  | "RECURRING_WEEKLY";

export type TimerResetBehavior =
  | "NEVER"
  | "ON_SESSION_END"
  | "DAILY"
  | "WEEKLY";

export type TimerStorageState = {
  startedAt?: string | Date | null;
  endsAt?: string | Date | null;
};

export type TimerSettingsInput = {
  mode: TimerMode;
  endsAt?: string | Date | null;
  durationMinutes?: number | null;
  recurringDays?: unknown;
  resetBehavior?: TimerResetBehavior | string | null;
  cutoffHour?: number | null;
  cutoffMinute?: number | null;
};

export type TimerState = {
  mode: TimerMode;
  isActive: boolean;
  isExpired: boolean;
  remainingMs: number;
  startedAt: Date | null;
  endsAt: Date | null;
  nextStorageState?: Required<TimerStorageState>;
};

type RecurringRule = {
  day?: number | string | null;
  weekday?: number | string | null;
  cutoffHour?: number | null;
  cutoffMinute?: number | null;
  hour?: number | null;
  minute?: number | null;
};

const minuteMs = 60_000;
const dayMs = 86_400_000;

export function calculateTimerState(
  settings: TimerSettingsInput,
  now: Date,
  timezone: string,
  storageState?: TimerStorageState,
): TimerState {
  if (!isValidDate(now)) {
    return inactiveTimerState(settings.mode);
  }

  if (settings.mode === "FIXED_DATE") {
    return calculateFixedDateTimer(settings, now);
  }

  if (settings.mode === "EVERGREEN_SESSION") {
    return calculateEvergreenTimer(settings, now, timezone, storageState);
  }

  if (settings.mode === "RECURRING_DAILY") {
    return calculateRecurringDailyTimer(settings, now, timezone);
  }

  return calculateRecurringWeeklyTimer(settings, now, timezone);
}

export function formatTimeRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function isCampaignExpired(
  campaign: { status?: string | null; endsAt?: string | Date | null },
  now: Date,
) {
  if (campaign.status === "EXPIRED") return true;

  const endsAt = parseDate(campaign.endsAt);
  if (!endsAt || !isValidDate(now)) return false;

  return endsAt.getTime() <= now.getTime();
}

function calculateFixedDateTimer(
  settings: TimerSettingsInput,
  now: Date,
): TimerState {
  const endsAt = parseDate(settings.endsAt);

  if (!endsAt) {
    return inactiveTimerState(settings.mode);
  }

  return buildTimerState(settings.mode, now, null, endsAt);
}

function calculateEvergreenTimer(
  settings: TimerSettingsInput,
  now: Date,
  timezone: string,
  storageState?: TimerStorageState,
): TimerState {
  const durationMinutes = Number(settings.durationMinutes);

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return inactiveTimerState(settings.mode);
  }

  const resetBehavior = normalizeResetBehavior(settings.resetBehavior);
  const storedStartedAt = parseDate(storageState?.startedAt);
  const storedEndsAt = parseDate(storageState?.endsAt);
  const canReuseStoredState =
    storedStartedAt &&
    storedEndsAt &&
    shouldReuseStorageState(storedStartedAt, now, timezone, resetBehavior);

  if (canReuseStoredState) {
    return buildTimerState(settings.mode, now, storedStartedAt, storedEndsAt, {
      startedAt: storedStartedAt.toISOString(),
      endsAt: storedEndsAt.toISOString(),
    });
  }

  const endsAt = new Date(
    now.getTime() + Math.round(durationMinutes) * minuteMs,
  );
  const nextStorageState = {
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
  };

  return buildTimerState(settings.mode, now, now, endsAt, nextStorageState);
}

function calculateRecurringDailyTimer(
  settings: TimerSettingsInput,
  now: Date,
  timezone: string,
): TimerState {
  const cutoff = getRecurringCutoff(settings);

  if (!cutoff) {
    return inactiveTimerState(settings.mode);
  }

  const nowParts = getZonedParts(now, timezone);
  const endsAt = zonedTimeToUtc(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    cutoff.hour,
    cutoff.minute,
    0,
    timezone,
  );

  return buildTimerState(settings.mode, now, null, endsAt);
}

function calculateRecurringWeeklyTimer(
  settings: TimerSettingsInput,
  now: Date,
  timezone: string,
): TimerState {
  const rules = getWeeklyRules(settings);

  if (rules.length === 0) {
    return inactiveTimerState(settings.mode);
  }

  const nowParts = getZonedParts(now, timezone);
  const todayRule = rules.find(
    (rule) => rule.isoWeekday === nowParts.isoWeekday,
  );

  if (todayRule) {
    const todayEndsAt = zonedTimeToUtc(
      nowParts.year,
      nowParts.month,
      nowParts.day,
      todayRule.hour,
      todayRule.minute,
      0,
      timezone,
    );

    if (todayEndsAt.getTime() <= now.getTime()) {
      return buildTimerState(settings.mode, now, null, todayEndsAt);
    }
  }

  const upcomingEndsAt = rules
    .flatMap((rule) => buildWeeklyCandidates(rule, now, timezone))
    .filter((endsAt) => endsAt.getTime() > now.getTime())
    .sort((first, second) => first.getTime() - second.getTime())[0];

  if (!upcomingEndsAt) {
    return inactiveTimerState(settings.mode);
  }

  return buildTimerState(settings.mode, now, null, upcomingEndsAt);
}

function buildTimerState(
  mode: TimerMode,
  now: Date,
  startedAt: Date | null,
  endsAt: Date,
  nextStorageState?: Required<TimerStorageState>,
): TimerState {
  const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
  const isExpired = endsAt.getTime() <= now.getTime();

  return {
    mode,
    isActive: !isExpired,
    isExpired,
    remainingMs,
    startedAt,
    endsAt,
    ...(nextStorageState ? { nextStorageState } : {}),
  };
}

function inactiveTimerState(mode: TimerMode): TimerState {
  return {
    mode,
    isActive: false,
    isExpired: false,
    remainingMs: 0,
    startedAt: null,
    endsAt: null,
  };
}

function getRecurringCutoff(settings: TimerSettingsInput) {
  const firstRule = Array.isArray(settings.recurringDays)
    ? (settings.recurringDays.find((rule) => isRecord(rule)) as
        | RecurringRule
        | undefined)
    : isRecord(settings.recurringDays)
      ? (settings.recurringDays as RecurringRule)
      : undefined;
  const hour = readHour(
    settings.cutoffHour ?? firstRule?.cutoffHour ?? firstRule?.hour,
  );
  const minute = readMinute(
    settings.cutoffMinute ?? firstRule?.cutoffMinute ?? firstRule?.minute ?? 0,
  );

  if (hour === null || minute === null) return null;

  return { hour, minute };
}

function getWeeklyRules(settings: TimerSettingsInput) {
  const fallbackCutoff = getRecurringCutoff(settings) ?? {
    hour: 23,
    minute: 59,
  };
  const rawRules = Array.isArray(settings.recurringDays)
    ? settings.recurringDays
    : [];

  return rawRules
    .filter(isRecord)
    .map((rule) => {
      const typedRule = rule as RecurringRule;
      const isoWeekday = normalizeIsoWeekday(
        typedRule.weekday ?? typedRule.day,
      );
      const hour = readHour(
        typedRule.cutoffHour ?? typedRule.hour ?? fallbackCutoff.hour,
      );
      const minute = readMinute(
        typedRule.cutoffMinute ?? typedRule.minute ?? fallbackCutoff.minute,
      );

      if (!isoWeekday || hour === null || minute === null) return null;

      return { isoWeekday, hour, minute };
    })
    .filter(
      (rule): rule is { isoWeekday: number; hour: number; minute: number } =>
        rule !== null,
    );
}

function buildWeeklyCandidates(
  rule: { isoWeekday: number; hour: number; minute: number },
  now: Date,
  timezone: string,
) {
  const nowParts = getZonedParts(now, timezone);
  const todayLocalMidnight = zonedTimeToUtc(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    0,
    0,
    0,
    timezone,
  );
  const daysUntil = (rule.isoWeekday - nowParts.isoWeekday + 7) % 7;

  return [daysUntil, daysUntil + 7].map((daysToAdd) => {
    const candidateLocalDate = addUtcDays(todayLocalMidnight, daysToAdd);
    const candidateParts = getZonedParts(candidateLocalDate, timezone);

    return zonedTimeToUtc(
      candidateParts.year,
      candidateParts.month,
      candidateParts.day,
      rule.hour,
      rule.minute,
      0,
      timezone,
    );
  });
}

function shouldReuseStorageState(
  storedStartedAt: Date,
  now: Date,
  timezone: string,
  resetBehavior: TimerResetBehavior,
) {
  if (resetBehavior === "DAILY") {
    return isSameZonedDay(storedStartedAt, now, timezone);
  }

  if (resetBehavior === "WEEKLY") {
    return isSameZonedWeek(storedStartedAt, now, timezone);
  }

  return true;
}

function isSameZonedDay(first: Date, second: Date, timezone: string) {
  const firstParts = getZonedParts(first, timezone);
  const secondParts = getZonedParts(second, timezone);

  return (
    firstParts.year === secondParts.year &&
    firstParts.month === secondParts.month &&
    firstParts.day === secondParts.day
  );
}

function isSameZonedWeek(first: Date, second: Date, timezone: string) {
  const firstParts = getZonedParts(first, timezone);
  const secondParts = getZonedParts(second, timezone);
  const firstWeekStart = startOfIsoWeekUtc(firstParts, timezone);
  const secondWeekStart = startOfIsoWeekUtc(secondParts, timezone);

  return firstWeekStart.getTime() === secondWeekStart.getTime();
}

function startOfIsoWeekUtc(
  parts: ReturnType<typeof getZonedParts>,
  timezone: string,
) {
  const currentLocalMidnight = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    0,
    0,
    0,
    timezone,
  );

  return addUtcDays(currentLocalMidnight, -(parts.isoWeekday - 1));
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    isoWeekday: weekdayMap[parts.weekday] ?? 1,
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
) {
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcTimestamp = localTimestamp;

  for (let index = 0; index < 3; index += 1) {
    const zonedTimestamp = getZonedTimestamp(
      new Date(utcTimestamp),
      safeTimezone(timezone),
    );
    const offset = zonedTimestamp - utcTimestamp;
    utcTimestamp = localTimestamp - offset;
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

function safeTimezone(timezone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return isValidDate(date) ? date : null;
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function normalizeResetBehavior(
  value: TimerSettingsInput["resetBehavior"],
): TimerResetBehavior {
  if (value === "ON_SESSION_END" || value === "DAILY" || value === "WEEKLY") {
    return value;
  }

  return "NEVER";
}

function readHour(value: unknown) {
  const hour = Number(value);

  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function readMinute(value: unknown) {
  const minute = Number(value);

  return Number.isInteger(minute) && minute >= 0 && minute <= 59
    ? minute
    : null;
}

function normalizeIsoWeekday(value: unknown) {
  if (typeof value === "number") {
    if (value >= 1 && value <= 7) return value;
    if (value === 0) return 7;
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  const weekdays: Record<string, number> = {
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
    sunday: 7,
    sun: 7,
  };

  return weekdays[normalized] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
