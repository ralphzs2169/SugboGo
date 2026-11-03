import StatusBadge from "@/shared/components/StatusBadge";
import {
  REPORT_STATUSES,
  REVIEW_STATUSES,
} from "../utils/allReviewPresentation";

/** Reuse the same semantic status badge treatment as the Businesses table. */
export default function ReviewStateBadge({ status, report = false }) {
  const config = (report ? REPORT_STATUSES : REVIEW_STATUSES)[status];
  return (
    <StatusBadge variant={config?.variant || "mutedSoft"}>
      {config?.label || "Status not recorded"}
    </StatusBadge>
  );
}
