import { Flag } from "lucide-react";
import StatusBadge from "@/shared/components/StatusBadge";
import ReviewDate from "../../all-reviews/components/ReviewDate";
import BusinessImage from "../../businesses/components/business-detail/BusinessImage";
import { reviewDateParts } from "../../all-reviews/utils/allReviewPresentation";
import PaymentBadge from "./PaymentBadge";
import {
  checkoutOutcomeState,
  financialState,
  fulfilmentState,
  paymentAccessLabel,
  paymentAmount,
  paymentReviewReasons,
  paymentVerificationLabel,
} from "../utils/paymentPresentation";

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
function Fields({ rows, compact = false, technical = false }) {
  return (
    <dl
      className={`grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 ${compact ? "" : "rounded-lg border border-stroke bg-surface p-4"}`}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="mb-1 text-xs text-text-secondary">{label}</dt>
          <dd className={`[overflow-wrap:anywhere] ${technical ? "font-mono text-xs text-text-secondary" : "text-sm text-text-primary"}`}>
            {value === null || value === undefined || value === ""
              ? <span className="text-text-secondary">Unavailable</span>
              : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Keep attention tied to the stored flag and its available evidence. */
function ReviewAttention({ payment }) {
  if (payment.needs_review !== true) {
    return payment.needs_review === false ? "No attention needed" : "Unavailable";
  }

  const reasons = paymentReviewReasons(payment);
  return (
    <>
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Flag aria-hidden="true" className="h-4 w-4 shrink-0 text-danger" />
        Needs review
      </span>
      {reasons.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-text-secondary">
          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-text-secondary">
          Reason unavailable in stored details.
        </p>
      )}
    </>
  );
}

/** Summarize the stored payment, access, environment, and review status. */
function PaymentSummary({ payment }) {
  return (
    <section
      aria-label="Status summary"
      className="rounded-xl border border-stroke bg-surface p-4"
    >
      <h3 className="mb-4 text-base font-semibold text-text-primary">
        Status summary
      </h3>
      <Fields
        compact
        rows={[
          [
            "Payment",
            <PaymentBadge value={financialState(payment.financial_status)} />,
          ],
          ["Merchant Plus access", paymentAccessLabel(payment)],
          ["Verification", paymentVerificationLabel(payment)],
          [
            "Fulfilment",
            <PaymentBadge value={fulfilmentState(payment.fulfilment_status)} />,
          ],
          ["Provider", <PaymentBadge value={payment.provider} />],
          [
            "Environment",
            <PaymentBadge value={payment.mode === "test" ? "sandbox" : payment.mode} />,
          ],
          ["Attention", <ReviewAttention payment={payment} />],
        ]}
      />
      {payment.mode === "test" && (
        <p className="mt-4 border-t border-stroke pt-3 text-xs text-text-secondary">
          Sandbox / test activity. Payments and access apply only in Sandbox.
        </p>
      )}
    </section>
  );
}

/** Keep provider and processing timestamps compact in Philippine time. */
function EvidenceDate({ value }) {
  const parts = reviewDateParts(value);
  if (!parts) return "Unavailable";

  return (
    <time dateTime={parts.iso}>
      {parts.date} · {parts.time} PHT
    </time>
  );
}

/** Present only stored, allowlisted evidence with no financial action controls. */
export default function PaymentDetail({ payment }) {
  const entitlement = payment.entitlement;
  const verification = payment.verification;
  const date = (value) => value ? <ReviewDate value={value} /> : null;
  return (
    <div className="space-y-6">
      <PaymentSummary payment={payment} />
      <Section title="Payment">
        <Fields
          rows={[
            ["Product", "Merchant Plus"],
            [
              "Amount",
              paymentAmount(payment.amount_centavos, payment.currency),
            ],
            ["Currency", payment.currency],
            ["Provider", <PaymentBadge value={payment.provider} />],
            ["Environment", <PaymentBadge value={payment.mode} />],
            [
              "Financial status",
              <PaymentBadge value={financialState(payment.financial_status)} />,
            ],
            [
              "Access duration",
              payment.access_duration_days == null
                ? null
                : `${payment.access_duration_days} days · One-time`,
            ],
            ["Created", date(payment.created_at)],
            ["Paid", date(payment.paid_at)],
            ["Verified", date(payment.verified_at)],
          ]}
        />
        <div className="mt-3 px-1">
          <Fields
            compact
            technical
            rows={[
              ["Payment reference", payment.reference],
              ["Payment record ID", payment.id],
              ["Product version", payment.product_version],
            ]}
          />
        </div>
      </Section>
      <Section title="Merchant & Business">
        <Fields
          rows={[
            ["Merchant", payment.merchant.name],
            ["Merchant email", payment.merchant.email],
            [
              "Business",
              <div className="flex items-center gap-2.5">
                <BusinessImage
                  src={payment.business.cover_photo_url}
                  alt=""
                  fallback=""
                  className="h-10 w-10 shrink-0 rounded-lg border border-stroke"
                />
                <span className="min-w-0">{payment.business.name}</span>
              </div>,
            ],
            ["Business identity", `Business #${payment.business.id}`],
          ]}
        />
      </Section>
      <Section title="Checkout history">
        {payment.checkouts.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No checkout operation is recorded.
          </p>
        ) : (
          <ol className="space-y-4">
            {payment.checkouts.map((checkout) => (
              <li
                key={checkout.id}
                className="space-y-4 rounded-lg border border-stroke bg-surface p-4"
              >
                <Fields
                  compact
                  rows={[
                    ["Checkout status", <PaymentBadge value={checkout.state} />],
                    [
                      "Checkout outcome",
                      <PaymentBadge
                        value={checkoutOutcomeState(
                          checkout.outcome,
                          payment.financial_status,
                          checkout.state,
                        )}
                      />,
                    ],
                  ]}
                />
                <Fields
                  compact
                  technical
                  rows={[
                    ["Operation reference", checkout.operation_reference],
                    ["Checkout record ID", checkout.id],
                    ["Provider checkout ID", checkout.provider_session_id],
                    [
                      "Provider-reported status",
                      checkout.provider_status,
                    ],
                    ["Created", <EvidenceDate value={checkout.created_at} />],
                    ["Updated", <EvidenceDate value={checkout.updated_at} />],
                    ["Provider status checked", <EvidenceDate value={checkout.checked_at} />],
                    ["Creation lease until", <EvidenceDate value={checkout.lease_until} />],
                  ]}
                />
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Creation leases track how long SugboGo reserved checkout creation work.
        </p>
      </Section>
      <Section title="Verification">
        <Fields
          rows={[
            [
              "Successful verification recorded",
              verification?.verified === true
                ? "Yes"
                : verification?.verified === false
                  ? "No"
                  : null,
            ],
            [
              "Verified purchase amount",
              verification?.verified === true
                ? paymentAmount(
                    verification.amount_centavos,
                    verification.currency,
                  )
                : null,
            ],
            ["Currency", verification?.currency],
            ["Verified at", date(verification?.verified_at)],
            ["Payment method", verification?.payment_method],
            ["Card brand", verification?.card_brand],
          ]}
        />
        <div className="mt-3 px-1">
          <Fields
            compact
            technical
            rows={[
              ["Provider payment ID", verification?.provider_payment_id],
              ["Completed checkout reference", verification?.request_reference],
            ]}
          />
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Shows verification evidence already stored for this payment.
        </p>
      </Section>
      <Section title="Fulfilment / Merchant Plus entitlement">
        <Fields
          rows={[
            [
              "Fulfilment status",
              <PaymentBadge value={fulfilmentState(payment.fulfilment_status)} />,
            ],
            ["Fulfilled", date(payment.fulfilled_at)],
            [
              "Entitlement created",
              entitlement ? "Yes" : entitlement === null ? "No" : null,
            ],
            ["Access source", entitlement?.access_source],
            ["Starts", date(entitlement?.starts_at)],
            ["Expires", date(entitlement?.expires_at)],
            [
              "Active in stored environment",
              entitlement?.active_in_stored_mode === true
                ? "Yes"
                : entitlement?.active_in_stored_mode === false
                  ? "No"
                  : null,
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
                            <EvidenceDate value={event.provider_created_at} />,
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
