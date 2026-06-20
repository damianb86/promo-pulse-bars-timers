import { type ReactNode, useId, useMemo, useState } from "react";

type TimezoneOption = {
  label: string;
  offsetMinutes: number;
  value: string;
};

type TimezoneComboboxProps = {
  defaultValue?: string;
  error?: string;
  info?: ReactNode;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  value?: string;
};

const representativeTimezoneOptions: TimezoneOption[] = [
  option("Etc/GMT+12", -720, "International Date Line West"),
  option("Pacific/Pago_Pago", -660, "Samoa representative"),
  option("Pacific/Honolulu", -600, "Hawaii representative"),
  option("Pacific/Marquesas", -570, "Marquesas representative"),
  option("America/Anchorage", -540, "Alaska representative"),
  option("America/Los_Angeles", -480, "Pacific Time representative"),
  option("America/Denver", -420, "Mountain Time representative"),
  option("America/Chicago", -360, "Central Time representative"),
  option("America/New_York", -300, "Eastern Time representative"),
  option("America/Santo_Domingo", -240, "Atlantic representative"),
  option("America/St_Johns", -210, "Newfoundland representative"),
  option("America/Argentina/Cordoba", -180, "Argentina representative"),
  option("Atlantic/South_Georgia", -120, "South Georgia representative"),
  option("Atlantic/Cape_Verde", -60, "Cape Verde representative"),
  option("UTC", 0, "Coordinated Universal Time"),
  option("Europe/Madrid", 60, "Central Europe representative"),
  option("Europe/Athens", 120, "Eastern Europe representative"),
  option("Europe/Istanbul", 180, "Turkey representative"),
  option("Asia/Tehran", 210, "Iran representative"),
  option("Asia/Dubai", 240, "Gulf representative"),
  option("Asia/Kabul", 270, "Afghanistan representative"),
  option("Asia/Karachi", 300, "Pakistan representative"),
  option("Asia/Kolkata", 330, "India representative"),
  option("Asia/Kathmandu", 345, "Nepal representative"),
  option("Asia/Dhaka", 360, "Bangladesh representative"),
  option("Asia/Yangon", 390, "Myanmar representative"),
  option("Asia/Bangkok", 420, "Indochina representative"),
  option("Asia/Shanghai", 480, "China representative"),
  option("Australia/Eucla", 525, "Eucla representative"),
  option("Asia/Tokyo", 540, "Japan representative"),
  option("Australia/Adelaide", 570, "Central Australia representative"),
  option("Australia/Brisbane", 600, "Eastern Australia representative"),
  option("Australia/Lord_Howe", 630, "Lord Howe representative"),
  option("Pacific/Noumea", 660, "New Caledonia representative"),
  option("Pacific/Auckland", 720, "New Zealand representative"),
  option("Pacific/Chatham", 765, "Chatham representative"),
  option("Pacific/Tongatapu", 780, "Tonga representative"),
  option("Pacific/Kiritimati", 840, "Line Islands representative"),
].sort((first, second) => {
  if (first.offsetMinutes !== second.offsetMinutes) {
    return first.offsetMinutes - second.offsetMinutes;
  }

  return first.value.localeCompare(second.value);
});

export function TimezoneCombobox({
  defaultValue = "UTC",
  error,
  info,
  label,
  name,
  onChange,
  value,
}: TimezoneComboboxProps) {
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue);
  const options = useMemo(
    () => ensureSelectedTimezoneOption(selectedValue),
    [selectedValue],
  );
  const selectedOption =
    options.find((item) => item.value === selectedValue) ?? options[0];
  const [query, setQuery] = useState(selectedOption.label);
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const inputId = useId();

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) return options;

    return options.filter((item) =>
      normalizeSearchValue(`${item.label} ${item.value}`).includes(
        normalizedQuery,
      ),
    );
  }, [options, query]);

  const selectOption = (optionToSelect: TimezoneOption) => {
    setSelectedValue(optionToSelect.value);
    setQuery(optionToSelect.label);
    setOpen(false);
    onChange?.(optionToSelect.value);
  };

  const labelClassName = error
    ? "counterpulse-form-field counterpulse-timezone-combobox has-error"
    : "counterpulse-form-field counterpulse-timezone-combobox";

  return (
    <div className={labelClassName}>
      <div className="counterpulse-field-label-row">
        <label htmlFor={inputId}>{label}</label>
        {info}
      </div>
      <input name={name} type="hidden" value={selectedValue} />
      <div className="counterpulse-combobox">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
          id={inputId}
          role="combobox"
          value={query}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }

            if (event.key === "Enter" && filteredOptions[0]) {
              event.preventDefault();
              selectOption(filteredOptions[0]);
            }
          }}
        />
        {open && (
          <div
            className="counterpulse-combobox__list"
            id={listboxId}
            role="listbox"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((optionItem) => (
                <button
                  aria-selected={optionItem.value === selectedValue}
                  className="counterpulse-combobox__option"
                  key={optionItem.value}
                  role="option"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(optionItem)}
                >
                  <span>{optionItem.label}</span>
                  <small>{optionItem.value}</small>
                </button>
              ))
            ) : (
              <div className="counterpulse-combobox__empty">
                No matching timezone.
              </div>
            )}
          </div>
        )}
      </div>
      <small className="counterpulse-field-hint">
        Search by UTC offset or representative region. One region is shown for
        each supported offset.
      </small>
      {error && <span className="counterpulse-form-error">{error}</span>}
    </div>
  );
}

function ensureSelectedTimezoneOption(selectedValue: string) {
  const currentOptions = representativeTimezoneOptions;

  if (
    !selectedValue ||
    currentOptions.some((item) => item.value === selectedValue)
  ) {
    return currentOptions;
  }

  return [
    {
      label: `${getRuntimeOffsetLabel(selectedValue)} - ${selectedValue} (current saved zone)`,
      offsetMinutes: getRuntimeOffsetMinutes(selectedValue),
      value: selectedValue,
    },
    ...currentOptions,
  ].sort((first, second) => {
    if (first.offsetMinutes !== second.offsetMinutes) {
      return first.offsetMinutes - second.offsetMinutes;
    }

    return first.value.localeCompare(second.value);
  });
}

function option(
  value: string,
  offsetMinutes: number,
  description: string,
): TimezoneOption {
  return {
    label: `${formatOffset(offsetMinutes)} - ${value} (${description})`,
    offsetMinutes,
    value,
  };
}

function formatOffset(offsetMinutes: number) {
  if (offsetMinutes === 0) return "UTC+00:00";

  const sign = offsetMinutes > 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getRuntimeOffsetLabel(timezone: string) {
  return formatOffset(getRuntimeOffsetMinutes(timezone));
}

function getRuntimeOffsetMinutes(timezone: string) {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(now);
    const valueFor = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    const zonedTimestamp = Date.UTC(
      valueFor("year"),
      valueFor("month") - 1,
      valueFor("day"),
      valueFor("hour"),
      valueFor("minute"),
      valueFor("second"),
    );

    return Math.round((zonedTimestamp - now.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function normalizeSearchValue(valueToNormalize: string) {
  return valueToNormalize.toLowerCase().replace(/[\s_/-]+/g, "");
}
