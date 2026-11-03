export const BUSINESS_STATUS_CONFIG = {
  active: {
    label: "Active",
    variant: "successSoft",
  },
  suspended: {
    label: "Suspended",
    variant: "warningSoft",
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
