import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

import { formatModerationCategory } from "../utils/underReviewPresentation";

function FindingRow({ label, checked, categories }) {
  const hasFindings = categories.length > 0;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-stroke py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="mt-1 text-xs text-text-secondary">
          {hasFindings
            ? "Automated moderation found potential concerns"
            : checked
              ? "No findings"
              : "Not checked"}
        </p>
      </div>
      <div className="flex max-w-[60%] flex-wrap justify-end gap-1.5">
        {hasFindings ? (
          categories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              {formatModerationCategory(category)}
            </span>
          ))
        ) : checked ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-label="No findings" />
        ) : (
          <span className="text-xs text-text-secondary">—</span>
        )}
      </div>
    </div>
  );
}

export default function UnderReviewFindings({ review }) {
  const moderation = review.moderation;

  return (
    <section className="rounded-xl border border-stroke bg-background p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-text-secondary" />
        <h3 className="text-sm font-semibold text-text-primary">Moderation findings</h3>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        Moderation findings are supporting evidence for your decision.
      </p>

      {moderation.local_safety_findings?.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Potential violent threat
          </p>
          <dl className="mt-2 space-y-1 text-xs text-amber-900">
            <div className="flex gap-2">
              <dt className="font-semibold">Detected in</dt>
              <dd>Review text</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">Source</dt>
              <dd>Local Cebuano safety fallback</dd>
            </div>
          </dl>
        </div>
      )}

      {moderation.provider_unavailable && (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Automated moderation unavailable
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {moderation.retry_state === "retrying"
                ? "A background check may still be retried. Review the content directly before deciding."
                : moderation.retry_state === "exhausted"
                  ? "Automated retries were exhausted. Review the content directly before deciding."
                  : "Review the content directly before deciding."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3">
        <FindingRow
          label="Review text"
          checked={moderation.text_checked}
          categories={moderation.text_flagged_categories}
        />
        {review.photos.map((photo, index) => (
          <FindingRow
            key={photo.id}
            label={`Photo ${index + 1}`}
            checked={photo.checked}
            categories={photo.flagged_categories}
          />
        ))}
      </div>
    </section>
  );
}
