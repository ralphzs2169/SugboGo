import { useQuery } from "@tanstack/react-query";
import { CreditCard, Clock3, CheckCircle2, Flag } from "lucide-react";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import MetricCard from "../../components/MetricCard";
import DashboardSkeleton from "../../dashboard/components/DashboardSkeleton";
import { paymentSummaryOptions } from "../queries/paymentQueries";

const METRICS = [
  {
    key: "total_payments",
    title: "Total Payments",
    icon: CreditCard,
    description: "All Merchant Plus purchases",
  },
  {
    key: "pending",
    title: "Pending",
    icon: Clock3,
    description: "Payment not yet confirmed",
  },
  {
    key: "paid",
    title: "Paid",
    icon: CheckCircle2,
    description: "Payments recorded as paid",
  },
  {
    key: "needs_review",
    title: "Needs Review",
    icon: Flag,
    description: "Records flagged for investigation",
  },
];
const GRID = "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** Reuse the All Reviews summary-card interaction and global-count semantics. */
export default function PaymentMetrics({ filters, onFilterChange }) {
  const query = useQuery(paymentSummaryOptions());
  useApiErrorNotification(query.error, {
    toastId: "admin-payments-metrics-load-error",
    fallbackMessage: "Unable to load payment metrics. Please try again.",
  });
  const hasData = query.data != null;

  function updates(key) {
    if (key === "total_payments")
      return { financial_status: "", needs_review: "" };
    if (key === "needs_review") return { needs_review: "true" };
    return { financial_status: key };
  }

  function active(key) {
    if (key === "total_payments")
      return !filters.financial_status && !filters.needs_review;
    if (key === "needs_review") return filters.needs_review === "true";
    return filters.financial_status === key;
  }

  return (
    <section
      className="mb-8"
      aria-label="Global payment metrics"
      aria-busy={query.isFetching}
    >
      {query.error && (
        <DataErrorState
          compact
          framed
          retainedData={hasData}
          title="Unable to load payment metrics"
          message="The payments table is still available. Retry to load the global counts."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}
      {query.isLoading && !hasData && (
        <div className={GRID}>
          {METRICS.map((metric) => (
            <DashboardSkeleton
              key={metric.key}
              label={metric.title}
              variant="activity"
            />
          ))}
        </div>
      )}
      {hasData && (
        <div className={GRID}>
          {METRICS.map((metric) => (
            <button
              key={metric.key}
              type="button"
              aria-pressed={active(metric.key)}
              aria-label={`${metric.title}: ${query.data[metric.key]}. Filter ${metric.title.toLowerCase()}`}
              onClick={() => onFilterChange(updates(metric.key))}
              className="min-w-0 cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info [&>div]:h-full hover:[&>div]:border-text-secondary"
            >
              <MetricCard
                wrapTitle
                title={metric.title}
                icon={metric.icon}
                value={
                  <span className="text-4xl tabular-nums">
                    {query.data[metric.key].toLocaleString("en-PH")}
                  </span>
                }
                footerValue={metric.description}
              />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-text-secondary">
        Global counts include Test and Live records. Records flagged for review
        may also appear in the Paid or Pending counts.
        {hasData && query.isFetching && (
          <span role="status"> Refreshing metrics…</span>
        )}
      </p>
    </section>
  );
}
