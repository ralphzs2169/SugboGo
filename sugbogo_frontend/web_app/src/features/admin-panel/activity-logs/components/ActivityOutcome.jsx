import StatusBadge from "@/shared/components/StatusBadge";
import { activityLabel } from "../utils/activityLogPresentation";

const OUTCOMES = {
  succeeded: { label: "Completed", variant: "success" },
  success: { label: "Success", variant: "success" },
  accepted: { label: "Accepted for processing", variant: "info" },
  failed: { label: "Failed", variant: "danger" },
  unavailable: { label: "Unavailable", variant: "warning" },
};

/** Show only the technical outcome actually recorded by the source. */
export default function ActivityOutcome({ value, emptyLabel = "Not recorded" }) {
  if (!value) {
    return <span aria-label="Outcome not recorded" className="text-sm text-text-secondary">{emptyLabel}</span>;
  }
  const outcome = OUTCOMES[value];
  return (
    <span className="inline-flex whitespace-nowrap">
      <StatusBadge variant={outcome?.variant ?? "neutral"}>
        {outcome?.label ?? activityLabel(value)}
      </StatusBadge>
    </span>
  );
}
