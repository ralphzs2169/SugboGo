import { AlertTriangle, Shapes } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import { formatLabel } from "@/shared/utils/stringUtils";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";
import UpdateRequestSidebar from "./UpdateRequestSidebar";
import ClassificationRequestedChanges from "./ClassificationRequestedChanges";
import ClassificationSnapshotCard from "./ClassificationSnapshotCard";
import UpdateRequestReason from "./UpdateRequestReason";

const CLASSIFICATION_REVIEW_CHECKLIST = [
  "Does the requested category accurately represent the business's primary offerings?",
  "Are the requested specialty tags relevant to the business's actual products or services?",
  "Do the proposed classification changes align with the business's existing information?",
  "Could the requested classification mislead explorers or create confusion?",
];

/**
 * Displays a classification change request as a unified Admin review case.
 *
 * Combines captured classification differences, merchant justification,
 * request identities, and resolved decision history while highlighting
 * stale pending baselines that cannot be approved.
 */
export default function ClassificationReviewCase({
  request,
  isStalePendingRequest,
  clusterDisplay,
  specialtyDisplay,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Unified case header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Classification Change
        </h2>

        <StatusBadge
          variant={UPDATE_REQUEST_STATUS_VARIANTS[request.status] || "neutral"}
        >
          {formatLabel(request.status)}
        </StatusBadge>
      </div>

      {/* Review content and supporting information */}
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        {/* Left: Captured changes and merchant explanation */}
        <div className="min-w-0 p-5 sm:p-6 xl:border-r xl:border-stroke">
          {/* Requested classification changes */}
          <div className="flex items-center gap-2 text-text-secondary">
            <Shapes size={16} aria-hidden="true" />

            <h3 className="text-xs font-bold uppercase tracking-wider">
              Requested Changes
            </h3>
          </div>

          <div className="mt-5">
            <ClassificationRequestedChanges
              previous={request.previous}
              proposed={request.proposed}
              status={request.status}
              clusterDisplay={clusterDisplay.metadata}
              specialtyDisplay={specialtyDisplay.metadata}
            />
          </div>

          {specialtyDisplay.unavailableCount > 0 && (
            <p role="alert" className="mt-3 text-xs text-text-secondary">
              Some specialty tag colors or icons could not be loaded.{" "}
              <button
                type="button"
                className="cursor-pointer font-semibold text-primary underline"
                onClick={() => void specialtyDisplay.refetch()}
              >
                Retry
              </button>
            </p>
          )}

          {clusterDisplay.unavailableCount > 0 && (
            <p role="alert" className="mt-3 text-xs text-text-secondary">
              Some cluster icons could not be loaded.{" "}
              <button
                type="button"
                className="cursor-pointer font-semibold text-primary underline"
                onClick={() => void clusterDisplay.refetch()}
              >
                Retry
              </button>
            </p>
          )}

          {/* Stale classification warning */}
          {isStalePendingRequest && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-start gap-3 text-amber-900">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Classification information has changed
                  </p>

                  <p className="mt-1 text-sm leading-6">
                    The live classification no longer matches the values
                    captured when this request was submitted. Approval will be
                    blocked.
                  </p>
                </div>
              </div>

              {/* Current live classification snapshot */}
              <div className="mt-4">
                <ClassificationSnapshotCard
                  title="Current live classification"
                  classification={request.current}
                  clusterDisplay={clusterDisplay.metadata}
                  specialtyDisplay={specialtyDisplay.metadata}
                />
              </div>
            </div>
          )}

          {/* Change justification separator */}
          <div className="my-7 flex items-center gap-3 text-xs font-medium text-text-secondary">
            <div className="h-px flex-1 bg-stroke" />

            <span>↓ requested because</span>

            <div className="h-px flex-1 bg-stroke" />
          </div>

          {/* Merchant's submitted explanation */}
          <UpdateRequestReason reason={request.reason} />
        </div>

        {/* Right: Request metadata, identities, and review guidance */}
        <aside className="min-w-0 border-t border-stroke xl:border-t-0">
          <UpdateRequestSidebar
            request={request}
            checklistQuestions={CLASSIFICATION_REVIEW_CHECKLIST}
          />
        </aside>
      </div>
    </section>
  );
}
