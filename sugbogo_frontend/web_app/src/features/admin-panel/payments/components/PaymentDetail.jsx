import StatusBadge from "@/shared/components/StatusBadge";
import ReviewDate from "../../all-reviews/components/ReviewDate";
import PaymentBadge from "./PaymentBadge";
import { paymentAmount } from "../utils/paymentPresentation";

/** Follow the All Reviews drawer's section rhythm and wrapping definition-list treatment. */
function Section({ title, children }) {
  return (
    <section aria-label={title} className="border-t border-stroke pt-5">
      <h3 className="mb-3 text-base font-semibold text-text-primary">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Keep long references and missing historical evidence readable at narrow widths. */
function Fields({ rows, compact = false }) {
  return (
    <dl
      className={`grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 ${compact ? "" : "rounded-lg border border-stroke bg-surface p-4"}`}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="mb-1 text-xs text-text-secondary">{label}</dt>
          <dd className="break-words text-sm text-text-primary [overflow-wrap:anywhere]">
            {value ?? "Not recorded"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Present only stored, allowlisted evidence with no financial action controls. */
export default function PaymentDetail({ payment }) {
  const entitlement = payment.entitlement;
  const verification = payment.verification;
  const date = (value) =>
    value ? <ReviewDate value={value} /> : "Not recorded";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">
          Merchant Plus · Read-only inspection
        </p>
        <div className="flex flex-wrap gap-2">
          <PaymentBadge value={payment.provider} />
          <PaymentBadge value={payment.mode} />
          <PaymentBadge value={payment.financial_status} />
        </div>
      </div>
      {payment.mode === "test" && (
        <p className="text-xs text-text-secondary">
          Sandbox / test activity. This record does not represent a live
          transaction.
        </p>
      )}
      {payment.needs_review && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 p-4">
          <p className="text-sm font-semibold text-text-primary">
            Needs review
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Stored attention or uncertainty requires investigation. Inspection
            does not change the purchase.
          </p>
        </div>
      )}
      {payment.financial_status === "paid" &&
        payment.fulfilment_status !== "fulfilled" && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-text-primary">
              Paid · Fulfilment not completed
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Payment is verified. Merchant Plus activation has not completed.
            </p>
          </div>
        )}
      <Section title="Payment">
        <Fields
          rows={[
            ["Public reference", payment.reference],
            ["Product", "Merchant Plus"],
            [
              "Amount",
              paymentAmount(payment.amount_centavos, payment.currency),
            ],
            ["Currency", payment.currency],
            ["Provider", <PaymentBadge value={payment.provider} />],
            ["Mode", <PaymentBadge value={payment.mode} />],
            [
              "Financial status",
              <PaymentBadge value={payment.financial_status} />,
            ],
            ["Fulfilment", <PaymentBadge value={payment.fulfilment_status} />],
            ["Product version", payment.product_version],
            [
              "Access duration",
              `${payment.access_duration_days} days · One-time`,
            ],
            ["Created", date(payment.created_at)],
            ["Paid", date(payment.paid_at)],
            ["Verified", date(payment.verified_at)],
          ]}
        />
      </Section>
      <Section title="Merchant & Business">
        <Fields
          rows={[
            ["Merchant", payment.merchant.name],
            ["Merchant email", payment.merchant.email],
            ["Business", payment.business.name],
            ["Business identity", `Business #${payment.business.id}`],
          ]}
        />
      </Section>
      <Section title="Checkout">
        {payment.checkouts.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No checkout operation is recorded.
          </p>
        ) : (
          <ol className="space-y-4">
            {payment.checkouts.map((checkout) => (
              <li key={checkout.id}>
                <Fields
                  rows={[
                    ["Operation reference", checkout.operation_reference],
                    ["State", <PaymentBadge value={checkout.state} />],
                    [
                      "Checkout outcome",
                      <PaymentBadge value={checkout.outcome} />,
                    ],
                    ["Provider checkout ID", checkout.provider_session_id],
                    [
                      "Provider status",
                      checkout.provider_status || "Not recorded",
                    ],
                    ["Created", date(checkout.created_at)],
                    ["Updated", date(checkout.updated_at)],
                    ["Provider checked", date(checkout.checked_at)],
                    ["Creation lease until", date(checkout.lease_until)],
                  ]}
                />
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Creation leases are local work timing, not provider expiration or
          payment confirmation. Hosted checkout links are withheld.
        </p>
      </Section>
      <Section title="Verification">
        <Fields
          rows={[
            [
              "Stored successful verification",
              verification.verified ? "Yes" : "No",
            ],
            ["Provider payment ID", verification.provider_payment_id],
            [
              "Verified purchase amount",
              verification.verified
                ? paymentAmount(
                    verification.amount_centavos,
                    verification.currency,
                  )
                : "Not verified",
            ],
            ["Currency", verification.currency],
            ["Completed checkout reference", verification.request_reference],
            ["Verification timestamp", date(verification.verified_at)],
            ["Payment method", verification.payment_method],
            ["Card brand", verification.card_brand],
          ]}
        />
        <p className="mt-3 text-xs text-text-secondary">
          Stored evidence only. Opening this drawer does not contact Maya or
          reverify a payment. Missing historical fields remain unavailable.
        </p>
      </Section>
      <Section title="Fulfilment / Merchant Plus entitlement">
        <Fields
          rows={[
            [
              "Fulfilment status",
              <PaymentBadge value={payment.fulfilment_status} />,
            ],
            ["Fulfilled", date(payment.fulfilled_at)],
            ["Entitlement created", entitlement ? "Yes" : "No"],
            ["Access source", entitlement?.access_source],
            ["Starts", date(entitlement?.starts_at)],
            ["Expires", date(entitlement?.expires_at)],
            [
              "Active in stored environment",
              entitlement?.active_in_stored_mode ? "Yes" : "No",
            ],
          ]}
        />
      </Section>
      <Section title="Provider events">
        <p className="text-xs text-text-secondary">
          Oldest received first · Processing metadata only
        </p>
        {payment.events.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            No provider events are recorded for this purchase.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-stroke border-t border-stroke">
            {payment.events.map((event) => (
              <li key={event.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="min-w-0 break-words text-sm font-semibold text-text-primary">
                    {event.type}
                  </h4>
                  <PaymentBadge value={event.state} />
                </div>
                {(event.needs_review || event.has_conflict) && (
                  <StatusBadge variant="dangerSoft">
                    {event.has_conflict
                      ? "Conflicting provider evidence"
                      : "Review required"}
                  </StatusBadge>
                )}
                <Fields
                  compact
                  rows={[
                    ["Received", date(event.received_at)],
                    ["Processed", date(event.processed_at)],
                    ["Processing attempts", event.attempts],
                    ...(event.provider_created_at
                      ? [
                          [
                            "Provider timestamp",
                            date(event.provider_created_at),
                          ],
                        ]
                      : []),
                    ...(event.retry_at
                      ? [["Retry scheduled", date(event.retry_at)]]
                      : []),
                    ...(event.lease_until
                      ? [["Processing lease", date(event.lease_until)]]
                      : []),
                  ]}
                />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
