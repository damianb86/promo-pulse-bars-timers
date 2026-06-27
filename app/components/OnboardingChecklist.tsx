export type OnboardingChecklistItem = {
  label: string;
  completed: boolean;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
};

type OnboardingChecklistProps = {
  items: OnboardingChecklistItem[];
  isRunning?: boolean;
  onRunChecks?: () => void;
};

export function OnboardingChecklist({
  items,
  isRunning = false,
  onRunChecks,
}: OnboardingChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length;

  return (
    <s-section
      heading={`Onboarding checklist (${completedCount}/${items.length})`}
    >
      <div className="counterpulse-checklist__toolbar">
        <s-paragraph>
          Campaign and analytics steps are checked automatically. Run the checks
          to also detect your theme app embed and blocks (this asks for theme
          access the first time).
        </s-paragraph>
        {onRunChecks && (
          <button
            className="counterpulse-button-secondary"
            disabled={isRunning}
            type="button"
            onClick={onRunChecks}
          >
            {isRunning ? "Running checks…" : "Run setup checks"}
          </button>
        )}
      </div>
      <div className="counterpulse-checklist">
        {items.map((item) => (
          <div className="counterpulse-checklist__item" key={item.label}>
            <span
              aria-hidden="true"
              className={
                item.completed
                  ? "counterpulse-checklist__marker counterpulse-checklist__marker--complete"
                  : "counterpulse-checklist__marker"
              }
            >
              {item.completed ? "✓" : ""}
            </span>
            <div className="counterpulse-checklist__content">
              <div className="counterpulse-checklist__label">{item.label}</div>
              {item.description && (
                <div className="counterpulse-checklist__description">
                  {item.description}
                </div>
              )}
            </div>
            {!item.completed && item.actionHref && (
              <a
                className="counterpulse-button-secondary counterpulse-checklist__action"
                href={item.actionHref}
                rel={
                  item.actionHref.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                target={item.actionHref.startsWith("http") ? "_blank" : undefined}
              >
                {item.actionLabel ?? "Fix this"}
              </a>
            )}
          </div>
        ))}
      </div>
    </s-section>
  );
}
