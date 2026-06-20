export type PreviewDevice = "desktop" | "mobile";

type DevicePreviewToggleProps = {
  value: PreviewDevice;
  onChange: (value: PreviewDevice) => void;
};

export function DevicePreviewToggle({
  value,
  onChange,
}: DevicePreviewToggleProps) {
  return (
    <div className="counterpulse-segmented" aria-label="Preview device">
      <button
        aria-pressed={value === "desktop"}
        className={value === "desktop" ? "is-active" : ""}
        type="button"
        onClick={() => onChange("desktop")}
      >
        <DesktopIcon />
        Desktop
      </button>
      <button
        aria-pressed={value === "mobile"}
        className={value === "mobile" ? "is-active" : ""}
        type="button"
        onClick={() => onChange("mobile")}
      >
        <MobileIcon />
        Mobile
      </button>
    </div>
  );
}

function DesktopIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <rect
        height="12"
        rx="2"
        width="17"
        x="3.5"
        y="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 20h6M12 16.5V20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <rect
        height="17"
        rx="2.5"
        width="10"
        x="7"
        y="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M11 17.5h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
