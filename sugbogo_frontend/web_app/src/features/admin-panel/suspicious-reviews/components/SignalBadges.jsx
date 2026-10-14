import { SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";

function SignalBadges({ reasons = [], roundedClassName = "rounded-full" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => (
        <span key={reason} className={`inline-flex items-center ${roundedClassName} border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary`}>
          {SIGNAL_LABELS[reason] ?? "Reliability signal"}
        </span>
      ))}
    </div>
  );
}

export default SignalBadges;
