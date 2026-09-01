export const BUSINESS_STATUS_CONFIG = {
  active: {
    label: "Active",
    variant: "success",
  },
  suspended: {
    label: "Suspended",
    variant: "warning",
  },
};

export function getBusinessStatusConfig(status) {
  return (
    BUSINESS_STATUS_CONFIG[status] ?? {
      label: status ?? "Unknown",
      variant: "neutral",
    }
  );
}
