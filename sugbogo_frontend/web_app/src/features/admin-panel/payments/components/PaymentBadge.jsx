import StatusBadge from "@/shared/components/StatusBadge";
import { PAYMENT_STATES } from "../utils/paymentPresentation";

/** Use the shared Admin status treatment for stored payment states and environments. */
export default function PaymentBadge({ value }) {
  const state = PAYMENT_STATES[value];
  return (
    <StatusBadge variant={state?.variant || "mutedSoft"}>
      {state?.label || "Not recorded"}
    </StatusBadge>
  );
}
