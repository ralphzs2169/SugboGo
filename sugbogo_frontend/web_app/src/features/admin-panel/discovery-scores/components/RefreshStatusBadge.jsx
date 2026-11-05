import StatusBadge from "@/shared/components/StatusBadge";

const STATUSES = {
  SUCCEEDED: { label: "Succeeded", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  PENDING: { label: "Pending", variant: "warning" },
  NOT_REQUESTED: { label: "Not requested", variant: "neutral" },
};

/** Present the latest refresh state separately from the persisted score's freshness. */
export default function RefreshStatusBadge({ status }) {
  const config = STATUSES[status] ?? { label: status || "Unavailable", variant: "neutral" };
  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
}
