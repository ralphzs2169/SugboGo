import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ShieldAlert,
} from "lucide-react";

import { formatModerationCategory } from "../utils/underReviewPresentation";

function FindingRow({ label, checked, categories }) {
  const hasFindings = categories.length > 0;
  const Icon = hasFindings
    ? AlertTriangle
    : checked
      ? CheckCircle2
      : CircleHelp;
  const stateClasses = hasFindings
    ? "border-danger/25 bg-danger/10"
    : "border-stroke bg-surface-muted/50";
  const iconClasses = hasFindings
    ? "text-danger"
    : checked
      ? "text-success"
      : "text-text-secondary";

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${stateClasses}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClasses}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {hasFindings
            ? "Potentially inappropriate content detected"
            : checked
              ? "No findings"
              : "Not checked"}
        </p>
        {hasFindings && (
          <p className="mt-2 text-xs text-text-secondary">
            Category: <span className="font-medium text-text-primary">
              {categories.map(formatModerationCategory).join(" · ")}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function UnderReviewFindings({ review }) {
  const moderation = review.moderation;

  return (
    <section>
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-text-secondary" />
        <h3 className="text-base font-semibold text-text-primary">Moderation findings</h3>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Moderation findings are supporting evidence for your decision.
      </p>

      {moderation.local_safety_findings?.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
          <p className="text-sm font-semibold text-text-primary">
            Potential violent threat
          </p>
          <dl className="mt-2 space-y-1 text-xs text-text-secondary">
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
        <div className="mt-4 flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Automated moderation unavailable
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {moderation.retry_state === "retrying"
                ? "The automated safety check could not be completed. Another attempt may run automatically. You can still review the content directly before deciding."
                : moderation.retry_state === "exhausted"
                  ? "The automated safety check could not be completed after multiple attempts. Review the content directly before deciding."
                  : "The automated safety check could not be completed. Review the content directly before deciding."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
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
