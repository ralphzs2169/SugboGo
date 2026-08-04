import MetricBadge from "./MetricBadge";

function MetricCard({
  title,
  value,
  badgeVariant,
  badgeText,
  footerText,
  footerColor = "text-text-secondary",
  Icon,
}) {
  return (
    <div className="relative flex min-h-[165px] flex-col justify-between overflow-hidden rounded-lg border border-stroke bg-background p-6 shadow-sm hover:shadow-md">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <h3 className="max-w-[160px] text-[11px] font-bold uppercase leading-relaxed tracking-widest text-text-secondary">
          {title}
        </h3>

        {badgeText && <MetricBadge variant={badgeVariant} text={badgeText} />}
      </div>

      <div className="relative z-10 mt-5">
        <div className="text-3xl font-bold tracking-tight text-text-primary">
          {value}
        </div>

        {footerText && (
          <p
            className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${footerColor}`}
          >
            {footerText}
          </p>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
