export const PAYMENT_STATES = {
  pending: { label: "Pending", variant: "warningSoft" },
  paid: { label: "Paid", variant: "successSoft" },
  not_started: { label: "Not started", variant: "mutedSoft" },
  fulfilled: { label: "Fulfilled", variant: "successSoft" },
  needs_attention: { label: "Needs attention", variant: "dangerSoft" },
  creating: { label: "Creating", variant: "infoSoft" },
  creation_unknown: { label: "Creation unknown", variant: "warningSoft" },
  creation_failed: { label: "Creation failed", variant: "dangerSoft" },
  ready: { label: "Ready", variant: "infoSoft" },
  completed: { label: "Completed", variant: "successSoft" },
  expired: { label: "Expired", variant: "mutedSoft" },
  cancelled: { label: "Cancelled", variant: "mutedSoft" },
  failed: { label: "Failed", variant: "dangerSoft" },
  unknown: { label: "Unknown", variant: "warningSoft" },
  queued: { label: "Queued", variant: "infoSoft" },
  processing: { label: "Processing", variant: "infoSoft" },
  processed: { label: "Processed", variant: "successSoft" },
  ignored: { label: "Ignored", variant: "mutedSoft" },
  test: { label: "Test", variant: "warningSoft" },
  live: { label: "Live", variant: "infoSoft" },
  maya: { label: "Maya", variant: "mutedSoft" },
  paymongo: { label: "PayMongo", variant: "mutedSoft" },
};

/** Build filter labels from the same closed states displayed by the table. */
function options(values) {
  return values.map((value) => ({ value, label: PAYMENT_STATES[value].label }));
}

export const PAYMENT_FILTERS = {
  financial_status: options(["pending", "paid"]),
  fulfilment_status: options([
    "not_started",
    "pending",
    "fulfilled",
    "needs_attention",
  ]),
  provider: options(["maya", "paymongo"]),
  mode: options(["test", "live"]),
  checkout_outcome: options([
    "pending",
    "cancelled",
    "failed",
    "expired",
    "unknown",
  ]),
  needs_review: [
    { value: "true", label: "Needs review" },
    { value: "false", label: "No stored review flag" },
  ],
};

export const PAYMENT_FILTER_LABELS = {
  financial_status: "Financial status",
  fulfilment_status: "Fulfilment",
  provider: "Provider",
  mode: "Mode",
  checkout_outcome: "Checkout outcome",
  needs_review: "Review evidence",
};

/** Format centavos for presentation without altering the stored payment snapshot. */
export function paymentAmount(centavos, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(centavos / 100);
}
