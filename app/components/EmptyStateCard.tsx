type EmptyStateCardProps = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyStateCard({
  title,
  message,
  actionLabel,
  actionHref,
}: EmptyStateCardProps) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <div className="counterpulse-empty-state">
        <div>
          <div className="counterpulse-empty-state__title">{title}</div>
          <div className="counterpulse-empty-state__message">{message}</div>
        </div>
        {actionLabel && actionHref && (
          <s-button href={actionHref}>{actionLabel}</s-button>
        )}
      </div>
    </s-box>
  );
}
