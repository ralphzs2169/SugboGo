const QUEUE_STATUS_CONFIG = {
  on_time: {
    label: "On time",
    bars: 1,
    className: "text-success",
  },
  approaching: {
    label: "Approaching",
    bars: 2,
    className: "text-warning",
  },
  overdue: {
    label: "Overdue",
    bars: 3,
    className: "text-danger",
  },
  resolved: {
    label: "Resolved",
    bars: 0,
    className: "text-success",
  },
};

function formatElapsedTime(submittedAt, resolvedAt, days, status) {
  if (!submittedAt) {
    return "—";
  }

  // Use the backend's authoritative business-day duration once
  // the application has completed at least one business day.
  if (days >= 1) {
    return `${days} ${days === 1 ? "business day" : "business days"}`;
  }

  const start = new Date(submittedAt);

  let end;

  if (status === "resolved") {
    // Resolved applications must use the fixed review timestamp.
    // Never fall back to the current time after resolution.
    if (!resolvedAt) {
      return "—";
    }

    end = new Date(resolvedAt);
  } else {
    // Active applications continue counting until now.
    end = new Date();
  }

  const elapsedMilliseconds = Math.max(0, end.getTime() - start.getTime());

  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60000);

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"}`;
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (minutes === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Displays an application's queue duration and current queue status.
 *
 * Uses the backend-provided business-day duration for completed business
 * days and timestamp-based elapsed time for applications still within
 * their first business day.
 */
export default function ApplicationQueueStatus({
  submittedAt,
  resolvedAt,
  days,
  status,
  compact = false,
}) {
  if (days === null || days === undefined) {
    return <span className="text-sm text-text-secondary">—</span>;
  }

  const queueInfo = QUEUE_STATUS_CONFIG[status];

  const duration = formatElapsedTime(submittedAt, resolvedAt, days, status);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Compact queue status */}
        <div
          className={`flex items-center gap-1.5 text-xs font-medium ${
            queueInfo?.className ?? "text-text-secondary"
          }`}
        >
          {status === "resolved" ? (
            <span className="text-sm">✓</span>
          ) : (
            <div className="flex h-4 items-end gap-0.5">
              {[1, 2, 3].map((bar) => (
                <span
                  key={bar}
                  className={`w-1 rounded-sm ${
                    bar <= (queueInfo?.bars ?? 0) ? "bg-current" : "bg-stroke"
                  }`}
                  style={{
                    height: `${bar * 3 + 3}px`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {/* Queue duration */}
        <span
          className={`text-sm font-medium ${
            status === "resolved" ? "text-text-secondary" : "text-text-primary"
          }`}
        >
          {duration}
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Queue duration */}
      <span
        className={`text-sm font-medium ${
          status === "resolved" ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {duration}
      </span>

      {/* Queue status */}
      <div
        className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
          queueInfo?.className ?? "text-text-secondary"
        }`}
      >
        {status === "resolved" ? (
          <span className="text-sm">✓</span>
        ) : (
          <div className="flex h-4 items-end gap-0.5">
            {[1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={`w-1 rounded-sm ${
                  bar <= (queueInfo?.bars ?? 0) ? "bg-current" : "bg-stroke"
                }`}
                style={{
                  height: `${bar * 3 + 3}px`,
                }}
              />
            ))}
          </div>
        )}

        <span>{queueInfo?.label ?? "—"}</span>
      </div>
    </div>
  );
}
