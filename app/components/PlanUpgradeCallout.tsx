import { Link } from "react-router";

type PlanUpgradeCalloutProps = {
  title?: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function PlanUpgradeCallout({
  title = "Upgrade required",
  message,
  actionHref = "/app/billing",
  actionLabel = "View pricing",
}: PlanUpgradeCalloutProps) {
  const showProBadge = /\bPro plan\b/i.test(message);

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <div className="counterpulse-upgrade-callout">
        <div>
          <div className="counterpulse-empty-state__title counterpulse-upgrade-callout__title">
            <span>{title}</span>
            {showProBadge && (
              <span
                className="counterpulse-pro-badge"
                title="Requires Pro plan"
              >
                <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
                  <path d="M8 1.5 9.8 5l3.9.6-2.8 2.7.7 3.9L8 10.3l-3.5 1.9.7-3.9-2.8-2.7L6.2 5 8 1.5Z" />
                </svg>
                Pro
              </span>
            )}
          </div>
          <div className="counterpulse-empty-state__message">{message}</div>
        </div>
        <Link className="counterpulse-button" to={actionHref}>
          {actionLabel}
        </Link>
      </div>
    </s-box>
  );
}
