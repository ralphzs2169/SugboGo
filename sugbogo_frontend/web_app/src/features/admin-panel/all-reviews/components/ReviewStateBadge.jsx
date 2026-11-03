import StatusBadge from "@/shared/components/StatusBadge";
import {
  REPORT_STATUSES,
  REVIEW_STATUSES,
} from "../utils/allReviewPresentation";

/** Retain semantic badge fills/dots with readable text in both Admin themes. */
export default function ReviewStateBadge({ status, report = false }) {
  const config = (report ? REPORT_STATUSES : REVIEW_STATUSES)[status];
  return (
    <span className="[&>span]:text-text-primary">
      <StatusBadge variant={config?.variant || "mutedSoft"}>
        {config?.label || "Status not recorded"}
      </StatusBadge>
    </span>
  );
}
