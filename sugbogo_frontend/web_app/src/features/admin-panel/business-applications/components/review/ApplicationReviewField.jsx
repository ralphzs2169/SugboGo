/**
 * Displays one piece of submitted application information using
 * the consistent label/value treatment used throughout the review page.
 */
export default function ApplicationReviewField({
  label,
  value,
  className = "",
  isBusinessName = false,
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </dt>

      <dd
        className={`mt-1.5 ${isBusinessName ? "font-bold text-primary text-3xl" : "text-text-primary text-sm"}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
