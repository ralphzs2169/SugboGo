const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});

/** Match the Business Management creation date and secondary time presentation. */
export default function DateAddedCell({ value }) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return <span className="text-sm text-text-secondary">—</span>;
  }

  return (
    <time
      dateTime={date.toISOString()}
      className="flex min-w-0 flex-col gap-0.5"
    >
      <span className="whitespace-nowrap text-sm font-medium text-text-primary">
        {dateFormatter.format(date)}
      </span>
      <span className="text-xs text-text-secondary">
        {timeFormatter.format(date)}
      </span>
    </time>
  );
}
