import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  MessageSquareText,
  Quote,
} from "lucide-react";

import BusinessNameRequestSidebar from "./BusinessNameRequestSidebar";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatLabel } from "@/shared/utils/stringUtils";
import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";

/**
 * Displays the business name change review within one unified case card.
 *
 * Arranges the captured name comparison and merchant explanation beside
 * supporting request information while preserving all review content.
 */
export default function BusinessNameReviewCase({ request }) {
  const isStale =
    request.status === "pending" &&
    request.current_business_name !== request.previous_business_name;

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Unified case header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Change Request
        </h2>

        <StatusBadge
          variant={UPDATE_REQUEST_STATUS_VARIANTS[request.status] || "neutral"}
        >
          {formatLabel(request.status)}
        </StatusBadge>
      </div>

      {/* Main review and supporting information */}
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        {/* Requested changes and merchant explanation */}
        <div className="min-w-0 p-5 sm:p-6 xl:border-r xl:border-stroke">
          {/* Requested name heading */}
          <div className="flex items-center gap-2 text-text-secondary">
            <ArrowLeftRight size={15} aria-hidden="true" />

            <h3 className="text-xs font-bold uppercase tracking-wider">
              Requested Change
            </h3>
          </div>

          {/* Name comparison */}
          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-text-primary">
              Business name
            </p>

            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              {/* Name at submission */}
              <div className="min-w-0 rounded-xl bg-surface p-5">
                <p className="text-xs font-medium text-text-secondary">
                  At submission
                </p>

                <p className="mt-3 break-words text-lg font-medium leading-7 text-text-primary">
                  {request.previous_business_name || "Not provided"}
                </p>
              </div>

              {/* Circular directional indicator */}
              <div className="flex items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-background shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
                  <ArrowDown
                    size={18}
                    className="text-text-secondary sm:hidden"
                    aria-hidden="true"
                  />

                  <ArrowRight
                    size={18}
                    className="hidden text-text-secondary sm:block"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Proposed name */}
              <div className="min-w-0 rounded-xl border border-stroke bg-background p-5 shadow-sm">
                <p className="text-xs font-semibold text-text-secondary">
                  {request.status === "approved"
                    ? "Approved name"
                    : "Requested name"}
                </p>

                <p className="mt-3 break-words text-xl font-bold leading-7 text-text-primary">
                  {request.proposed_business_name || "Not provided"}
                </p>
              </div>
            </div>

            {/* Stale business information warning */}
            {isStale && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
              >
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Business information has changed
                  </p>

                  <p className="mt-1 break-words text-sm leading-6">
                    The live name is now{" "}
                    <strong>
                      {request.current_business_name || "unavailable"}
                    </strong>
                    . Approval will be blocked because it no longer matches the
                    captured name.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Transition into merchant explanation */}
          <div className="my-7 flex items-center gap-3 text-xs font-medium text-text-secondary">
            <div className="h-px flex-1 bg-stroke" />
            <span>↓ requested because</span>
            <div className="h-px flex-1 bg-stroke" />
          </div>

          {/* Merchant explanation */}
          <div>
            <div className="flex items-center gap-2 text-text-secondary">
              <MessageSquareText size={15} aria-hidden="true" />

              <h3 className="text-xs font-bold uppercase tracking-wider">
                Reason for Change
              </h3>
            </div>

            <p className="mt-5 text-xs font-medium text-text-secondary">
              Merchant's explanation
            </p>

            <blockquote className="mt-2 flex overflow-hidden rounded-lg bg-surface">
              <div className="w-1 shrink-0 bg-primary" aria-hidden="true" />

              <div className="min-w-0 flex-1 px-4 py-4">
                <Quote
                  size={18}
                  className="text-text-secondary"
                  aria-hidden="true"
                />

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                  {request.reason?.trim() || "No explanation provided."}
                </p>
              </div>
            </blockquote>
          </div>
        </div>

        {/* Request information, identities, and review guidance */}
        <aside className="min-w-0 border-t border-stroke xl:border-t-0">
          <BusinessNameRequestSidebar request={request} />
        </aside>
      </div>
    </section>
  );
}
