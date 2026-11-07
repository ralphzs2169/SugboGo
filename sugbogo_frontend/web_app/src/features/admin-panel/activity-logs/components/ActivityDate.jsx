import { activityDateParts } from "../utils/activityLogPresentation";

/** Display the original event instant using the established date/time cell hierarchy. */
export default function ActivityDate({ value }) {
  const parts = activityDateParts(value);
  if (!parts) return <span className="text-sm text-text-secondary">Not recorded</span>;
  return (
    <time dateTime={parts.original} className="flex min-w-0 flex-col gap-0.5 tabular-nums">
      <span className="whitespace-nowrap text-sm font-medium text-text-primary">{parts.date}</span>
      <span className="whitespace-nowrap text-xs text-text-secondary">{parts.time} PHT</span>
    </time>
  );
}
