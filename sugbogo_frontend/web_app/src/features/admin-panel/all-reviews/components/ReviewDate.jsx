import { reviewDateParts } from "../utils/allReviewPresentation";

/** Match the Businesses date/time hierarchy with an explicit Manila timezone. */
export default function ReviewDate({ value }) {
  const parts = reviewDateParts(value);
  if (!parts)
    return <span className="text-sm text-text-secondary">Not recorded</span>;
  return (
    <time dateTime={parts.iso} className="flex min-w-0 flex-col gap-0.5">
      <span className="whitespace-nowrap text-sm font-medium text-text-primary">
        {parts.date}
      </span>
      <span className="text-xs text-text-secondary">{parts.time} PHT</span>
    </time>
  );
}
