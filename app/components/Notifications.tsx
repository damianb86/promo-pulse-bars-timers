import { type ReactNode, useEffect, useId, useRef, useState } from "react";

export type NoticeTone = "info" | "success" | "warning" | "critical";

type AppAlertProps = {
  tone?: NoticeTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

type AppToastProps = AppAlertProps & {
  dismissLabel?: string;
};

type ConfirmModalProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel: string;
  open: boolean;
  title: string;
  tone?: "critical" | "warning";
  onCancel: () => void;
  onConfirm: () => void;
};

export function AppAlert({
  action,
  children,
  title,
  tone = "info",
}: AppAlertProps) {
  return (
    <div
      className={`counterpulse-alert counterpulse-alert--${tone}`}
      role={tone === "critical" || tone === "warning" ? "alert" : "status"}
    >
      <span className="counterpulse-alert__icon" aria-hidden="true">
        <NoticeIcon tone={tone} />
      </span>
      <div className="counterpulse-alert__content">
        <strong>{title}</strong>
        {children && <div className="counterpulse-alert__body">{children}</div>}
      </div>
      {action && <div className="counterpulse-alert__action">{action}</div>}
    </div>
  );
}

export function AppToast({
  action,
  children,
  dismissLabel = "Close",
  title,
  tone = "success",
}: AppToastProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      className={`counterpulse-toast counterpulse-toast--${tone}`}
      role={tone === "critical" || tone === "warning" ? "alert" : "status"}
    >
      <span className="counterpulse-alert__icon" aria-hidden="true">
        <NoticeIcon tone={tone} />
      </span>
      <div className="counterpulse-alert__content">
        <strong>{title}</strong>
        {children && <div className="counterpulse-alert__body">{children}</div>}
      </div>
      {action && <div className="counterpulse-alert__action">{action}</div>}
      <button
        aria-label={dismissLabel}
        className="counterpulse-toast__dismiss"
        type="button"
        onClick={() => setVisible(false)}
      >
        {dismissLabel}
      </button>
    </div>
  );
}

export function ConfirmModal({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  open,
  title,
  tone = "critical",
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const titleId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="counterpulse-modal-backdrop">
      <button
        aria-label="Cancel"
        className="counterpulse-modal-backdrop__dismiss"
        tabIndex={-1}
        type="button"
        onClick={onCancel}
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="counterpulse-modal"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <span
            className={`counterpulse-modal__icon counterpulse-modal__icon--${tone}`}
            aria-hidden="true"
          >
            <NoticeIcon tone={tone} />
          </span>
          <div>
            <h2 id={titleId}>{title}</h2>
            {children && (
              <div className="counterpulse-modal__body">{children}</div>
            )}
          </div>
        </div>
        <div className="counterpulse-modal__actions">
          <button
            className="counterpulse-button-secondary"
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={
              tone === "critical"
                ? "counterpulse-button-danger"
                : "counterpulse-button"
            }
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoticeIcon({ tone }: { tone: NoticeTone | "critical" | "warning" }) {
  if (tone === "success") {
    return (
      <svg fill="none" height="18" viewBox="0 0 20 20" width="18">
        <path
          d="m5.5 10.4 2.7 2.7 6.3-6.6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (tone === "warning" || tone === "critical") {
    return (
      <svg fill="none" height="18" viewBox="0 0 20 20" width="18">
        <path
          d="M10 3 2.8 16h14.4L10 3Zm0 5v3.5m0 2.5h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg fill="none" height="18" viewBox="0 0 20 20" width="18">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10 9.5V14m0-8h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
