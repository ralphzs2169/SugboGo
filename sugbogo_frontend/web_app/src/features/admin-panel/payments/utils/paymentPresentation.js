import { reviewDateParts } from "../../all-reviews/utils/allReviewPresentation";

export const PAYMENT_STATES = {
  payment_pending: { label: "Payment pending", variant: "warningSoft" },
  fulfilment_pending: { label: "Activation pending", variant: "warningSoft" },
  checkout_pending: { label: "Checkout in progress", variant: "warningSoft" },
  paid: { label: "Paid", variant: "successSoft" },
  not_started: { label: "Not started", variant: "mutedSoft" },
  fulfilled: { label: "Fulfilled", variant: "successSoft" },
  needs_attention: { label: "Needs attention", variant: "dangerSoft" },
  creating: { label: "Creating", variant: "infoSoft" },
  creation_unknown: { label: "Creation unconfirmed", variant: "warningSoft" },
  creation_failed: { label: "Creation failed", variant: "dangerSoft" },
  ready: { label: "Ready", variant: "infoSoft" },
  completed: { label: "Completed", variant: "successSoft" },
  expired: { label: "Expired", variant: "mutedSoft" },
  superseded: { label: "Replaced", variant: "mutedSoft" },
  cancelled: { label: "Cancelled", variant: "mutedSoft" },
  failed: { label: "Failed", variant: "dangerSoft" },
  unknown: { label: "Outcome undetermined", variant: "warningSoft" },
  no_checkout: { label: "No checkout recorded", variant: "mutedSoft" },
  paid_checkout_outcome: { label: "Not applicable · Paid", variant: "mutedSoft" },
  queued: { label: "Queued", variant: "infoSoft" },
  processing: { label: "Processing", variant: "infoSoft" },
  processed: { label: "Processed", variant: "successSoft" },
  ignored: { label: "Ignored", variant: "mutedSoft" },
  test: { label: "Test", variant: "warningSoft" },
  sandbox: { label: "Sandbox", variant: "warningSoft" },
  live: { label: "Live", variant: "infoSoft" },
  maya: { label: "Maya", variant: "mutedSoft" },
  paymongo: { label: "PayMongo", variant: "mutedSoft" },
};

/** Build filter labels from the same closed states displayed by the table. */
function options(values, pendingState) {
  return values.map((value) => ({
    value,
    label: PAYMENT_STATES[value === "pending" ? pendingState : value].label,
  }));
}

export const PAYMENT_FILTERS = {
  financial_status: options(["pending", "paid"], "payment_pending"),
  fulfilment_status: options([
    "not_started",
    "pending",
    "fulfilled",
    "needs_attention",
  ], "fulfilment_pending"),
  provider: options(["maya", "paymongo"]),
  mode: options(["test", "live"]),
  checkout_outcome: options([
    "pending",
    "cancelled",
    "failed",
    "expired",
    "unknown",
  ], "checkout_pending"),
  needs_review: [
    { value: "true", label: "Needs review" },
    { value: "false", label: "No stored review flag" },
  ],
};

export const PAYMENT_FILTER_LABELS = {
  financial_status: "Financial status",
  fulfilment_status: "Fulfilment status",
  provider: "Provider",
  mode: "Environment",
  checkout_outcome: "Checkout outcome",
  needs_review: "Review flag",
};

/** Present each payment status in the context of its own backend field. */
export function financialState(status) {
  return status === "pending" ? "payment_pending" : status;
}

export function fulfilmentState(status) {
  return status === "pending" ? "fulfilment_pending" : status;
}

export function checkoutOutcomeState(outcome, financialStatus, checkoutState) {
  if (financialStatus === "paid" && outcome == null) {
    return "paid_checkout_outcome";
  }
  if (outcome === "unknown" && checkoutState === null) {
    return "no_checkout";
  }
  return outcome === "pending" ? "checkout_pending" : outcome;
}

/** Explain only the evidence that can account for a stored review flag. */
export function paymentReviewReasons(payment) {
  if (payment.needs_review !== true) return [];

  const reasons = [];
  if (payment.fulfilment_status === "needs_attention") {
    reasons.push("Merchant Plus fulfilment needs attention.");
  }
  if (
    payment.checkout_state === "creation_unknown" ||
    payment.checkouts?.some((checkout) => checkout.state === "creation_unknown")
  ) {
    reasons.push("Checkout creation could not be confirmed.");
  }

  const flaggedEvents = payment.events?.filter(
    (event) => event.needs_review || event.state === "needs_attention",
  );
  if (flaggedEvents?.some((event) => event.has_conflict)) {
    reasons.push("Provider events contain conflicting payment evidence.");
  }
  if (flaggedEvents?.some((event) => !event.has_conflict)) {
    reasons.push("Provider event processing needs attention.");
  }
  return reasons;
}

/** Report the server's verification assessment independently of financial status. */
export function paymentVerificationLabel({
  verification,
  provider,
  financial_status,
}) {
  if (verification?.verified === true) {
    const providerName = PAYMENT_STATES[provider]?.label;
    return providerName ? `Verified via ${providerName}` : "Verified";
  }
  if (verification?.verified !== false) {
    return "Verification unavailable";
  }
  return financial_status === "paid"
    ? "Verification evidence incomplete"
    : "Verification not recorded";
}

/** Describe access using the server's stored-environment activity flag. */
export function paymentAccessLabel({ entitlement, financial_status, fulfilment_status }) {
  if (entitlement?.active_in_stored_mode === true) {
    const expiry = reviewDateParts(entitlement.expires_at);
    return expiry ? `Active until ${expiry.date}` : "Active · Expiry unavailable";
  }
  if (entitlement?.active_in_stored_mode === false) {
    return "Inactive in this environment";
  }
  if (entitlement === null) {
    if (financial_status === "paid" && fulfilment_status === "pending") {
      return "Activation pending";
    }
    return "No entitlement recorded";
  }
  return "Access status unavailable";
}

/** Format centavos for presentation without altering the stored payment snapshot. */
export function paymentAmount(centavos, currency) {
  if (!Number.isFinite(centavos) || !/^[A-Z]{3}$/.test(currency ?? "")) {
    return "Amount unavailable";
  }
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(centavos / 100);
}
