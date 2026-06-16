type StatCardProps = {
  label: string;
  value: string | number;
  caption?: string;
};

export function StatCard({ label, value, caption }: StatCardProps) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <div className="counterpulse-stat-card">
        <div className="counterpulse-stat-card__label">{label}</div>
        <div className="counterpulse-stat-card__value">{value}</div>
        {caption && (
          <div className="counterpulse-stat-card__caption">{caption}</div>
        )}
      </div>
    </s-box>
  );
}
