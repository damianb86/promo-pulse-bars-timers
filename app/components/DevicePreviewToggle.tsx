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
        className={value === "desktop" ? "is-active" : ""}
        type="button"
        onClick={() => onChange("desktop")}
      >
        Desktop
      </button>
      <button
        className={value === "mobile" ? "is-active" : ""}
        type="button"
        onClick={() => onChange("mobile")}
      >
        Mobile
      </button>
    </div>
  );
}
