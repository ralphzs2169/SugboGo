import { ArrowDown, ArrowRight } from "lucide-react";

import ClusterDisplay from "@/shared/components/ClusterDisplay";

import ClassificationSpecialtyDiff from "./ClassificationSpecialtyDiff";
import { getClassificationDiff } from "../utils/classificationDiff";

/**
 * Displays only the captured classification differences.
 *
 * Uses the same neutral comparison hierarchy as business name reviews,
 * keeping category and cluster information together within each panel.
 */
export default function ClassificationRequestedChanges({
  previous,
  proposed,
  status,
}) {
  const diff = getClassificationDiff(previous, proposed);

  const hasCategoryOrClusterChange =
    diff.categoryChanged || diff.clusterChanged;

  const hasSpecialtyChanges =
    diff.addedSpecialties.length > 0 || diff.removedSpecialties.length > 0;

  const proposedLabel = status === "approved" ? "Approved" : "Requested";

  return (
    <div className="min-w-0">
      {/* Category or cluster comparison */}
      {hasCategoryOrClusterChange && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {diff.categoryChanged ? "Category change" : "Cluster change"}
          </h3>

          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
            {/* Classification at submission */}
            <div className="min-w-0 rounded-xl bg-surface p-5">
              <p className="text-xs font-medium text-text-secondary">
                At submission
              </p>

              <p className="mt-3 break-words text-lg font-medium leading-7 text-text-primary">
                {diff.categoryChanged
                  ? previous?.category?.name || "Not provided"
                  : previous?.cluster?.name || "Not provided"}
              </p>

              {diff.categoryChanged ? (
                <div className="mt-2">
                  <ClusterDisplay
                    clusterName={previous?.cluster?.name}
                    clusterIcon={previous?.cluster?.icon}
                    variant="small"
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-secondary">
                  {previous?.category?.name || "Category unavailable"}
                </p>
              )}
            </div>

            {/* Name transition */}
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

            {/* Proposed classification */}
            <div className="min-w-0 rounded-xl border border-stroke bg-background p-5 shadow-sm">
              <p className="text-xs font-semibold text-text-secondary">
                {proposedLabel}
              </p>

              <p className="mt-3 break-words text-xl font-bold leading-7 text-text-primary">
                {diff.categoryChanged
                  ? proposed?.category?.name || "Not provided"
                  : proposed?.cluster?.name || "Not provided"}
              </p>

              {diff.categoryChanged ? (
                <div className="mt-2">
                  <ClusterDisplay
                    clusterName={proposed?.cluster?.name}
                    clusterIcon={proposed?.cluster?.icon}
                    variant="small"
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-secondary">
                  {proposed?.category?.name || "Category unavailable"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Specialty additions and removals */}
      {hasSpecialtyChanges && (
        <div
          className={
            hasCategoryOrClusterChange ? "mt-6 border-t border-stroke pt-6" : ""
          }
        >
          <ClassificationSpecialtyDiff diff={diff} status={status} />
        </div>
      )}
    </div>
  );
}
