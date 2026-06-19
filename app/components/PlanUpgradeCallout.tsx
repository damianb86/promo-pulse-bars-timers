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
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <div className="counterpulse-upgrade-callout">
        <div>
          <div className="counterpulse-empty-state__title">{title}</div>
          <div className="counterpulse-empty-state__message">{message}</div>
        </div>
        <Link className="counterpulse-button" to={actionHref}>
          {actionLabel}
        </Link>
      </div>
    </s-box>
  );
}
