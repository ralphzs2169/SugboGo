import type { MerchantPlusStatus } from "../types/merchantPlusAnalytics.types";

/** Identifies backend-issued paid access independently of preview or demo report access. */
export function hasPaidMerchantPlus(status?: MerchantPlusStatus) {
  return (
    !!status?.has_plus_access &&
    ["maya_test", "maya_live", "paymongo_test", "paymongo_live"].includes(
      status.access_source,
    ) &&
    typeof status.paid_payment_id === "number" &&
    status.paid_payment_id > 0 &&
    Number.isFinite(Date.parse(status.entitlement_expires_at ?? ""))
  );
}

/** Resolves merchant-facing states from backend evidence, independently of return hints. */
export function merchantPlusPaymentState(status?: MerchantPlusStatus) {
  if (!status) return "checking";
  if (hasPaidMerchantPlus(status)) return "active";
  if (status.unresolved_payment_status === "paid") {
    return status.unresolved_fulfilment_status === "needs_attention"
      ? "unknown"
      : "activating";
  }
  if (status.checkout_outcome === "cancelled") return "cancelled";
  if (status.checkout_outcome === "failed") return "failed";
  if (status.checkout_outcome === "expired") return "expired";
  if (status.unresolved_payment_id) {
    return status.checkout_outcome === "pending" ? "checking" : "unknown";
  }
  return "inactive";
}

/** Formats backend entitlement dates using the application's Manila reporting timezone. */
export function merchantPlusExpiry(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

/** Allows only the exact HTTPS Sandbox hosted origins already accepted by the backend. */
export function isMayaSandboxCheckoutUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\\\u0000-\u001f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        "payments-web-sandbox.paymaya.com",
        "payments-web-sandbox.maya.ph",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
