import { Clock3, ShieldAlert, UsersRound } from "lucide-react";

import { SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";

const SIGNAL_ICONS = {
  duplicate_content: ShieldAlert,
  rapid_submission: Clock3,
  shared_installation_accounts: UsersRound,
};

function SignalBadges({ reasons = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => {
        const Icon = SIGNAL_ICONS[reason] ?? ShieldAlert;
        return (
          <span key={reason} className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-text-primary">
            <Icon className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            {SIGNAL_LABELS[reason] ?? "Reliability signal"}
          </span>
        );
      })}
    </div>
  );
}

export default SignalBadges;
