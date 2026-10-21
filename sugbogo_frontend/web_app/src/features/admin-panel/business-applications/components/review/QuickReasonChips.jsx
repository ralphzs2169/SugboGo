/** Reuse the rejection drawer's quick-reason controls without selecting or submitting a decision. */
export default function QuickReasonChips({
  reasons,
  onSelect,
  disabled = false,
  canAppend = () => true,
}) {
  return (
    <div
      className="mb-4 flex flex-wrap gap-2"
      aria-label="Quick rejection reasons"
    >
      {reasons.map((reason) => {
        const label = typeof reason === "string" ? reason : reason.label;
        const message = typeof reason === "string" ? reason : reason.message;
        return (
          <button
            key={label}
            type="button"
            disabled={disabled || !canAppend(message)}
            onClick={() => onSelect(message)}
            className="cursor-pointer rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary shadow-sm ring-1 ring-inset ring-stroke transition-all hover:bg-surface-hover hover:text-text-primary hover:ring-stroke-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
