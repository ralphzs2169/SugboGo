import { ClipboardList, MessageSquareText, ThumbsUp } from "lucide-react";
import { formatCount, formatTimestamp } from "../../analytics/utils/presentation";
import { dashboardLinkClass } from "../utils/dashboardPresentation";

/** Show recorded activity in the server-defined calendar window without deriving trend comparisons. */
export default function PlatformActivity({ activity }) {
  const metrics = [
    { key: "applications_submitted", label: "Applications submitted", icon: ClipboardList },
    { key: "reviews_published", label: "Reviews published", icon: MessageSquareText },
    { key: "vouches_created", label: "Vouches created", icon: ThumbsUp },
  ];
  const window = activity?.window;

  return (
    <div>
      {/* Event counts are separate from the current-state inventory cards */}
      <dl className="divide-y divide-stroke">
        {metrics.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between gap-3 py-4 first:pt-1">
            <dt className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              {label}
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-text-primary">{formatCount(activity?.[key])}</dd>
          </div>
        ))}
      </dl>
      {/* Explicit effective bounds keep a partial day from looking like a complete reporting period */}
      <div className="mt-3 space-y-1 text-xs leading-relaxed text-text-secondary">
        {window ? (
          <>
            <p>{formatTimestamp(window.start)} – {formatTimestamp(window.end_exclusive)}</p>
            <p>{window.timezone} · End exclusive{window.includes_partial_day ? " · Today is partial" : ""}</p>
          </>
        ) : <p>Activity window unavailable.</p>}
      </div>
      {activity?.definitions && (
        <details className="mt-3 text-xs text-text-secondary">
          <summary className={`${dashboardLinkClass} text-xs`}>Activity definitions</summary>
          <dl className="mt-3 space-y-3 leading-relaxed">
            {metrics.map(({ key, label }) => (
              <div key={key}>
                <dt className="font-medium text-text-primary">{label}</dt>
                <dd className="mt-1">{activity.definitions[key]}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
