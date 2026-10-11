import ClusterDisplay from "@/shared/components/ClusterDisplay";

import ClassificationSpecialtyDiff from "./ClassificationSpecialtyDiff";
import ReviewDirectionIndicator from "./ReviewDirectionIndicator";
import { getClassificationDiff } from "../utils/classificationDiff";
import { withClusterDisplay } from "../utils/classificationDisplay";

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
  clusterDisplay,
  specialtyDisplay,
}) {
  const diff = getClassificationDiff(previous, proposed);

  const hasCategoryOrClusterChange =
    diff.categoryChanged || diff.clusterChanged;

  const hasSpecialtyChanges =
    diff.addedSpecialties.length > 0 || diff.removedSpecialties.length > 0;

  const proposedLabel = status === "approved" ? "Approved" : "Requested";
  const changedField = diff.categoryChanged ? "category" : "cluster";
  const previousCluster = withClusterDisplay(previous?.cluster, clusterDisplay);
  const proposedCluster = withClusterDisplay(proposed?.cluster, clusterDisplay);

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

              {diff.categoryChanged ? (
                <p className="mt-3 break-words text-lg font-medium leading-7 text-text-primary">
                  {previous?.category?.name || "Not provided"}
                </p>
              ) : (
                <ClusterDisplay
                  clusterName={previousCluster?.name}
                  clusterIcon={previousCluster?.icon}
                  variant="comparison"
                  className="mt-3"
                />
              )}

              {diff.categoryChanged ? (
                <div className="mt-2">
                  <ClusterDisplay
                    clusterName={previousCluster?.name}
                    clusterIcon={previousCluster?.icon}
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
            <ReviewDirectionIndicator />

            {/* Proposed classification */}
            <div className="min-w-0 rounded-xl border border-stroke bg-background p-5 shadow-sm">
              <p className="text-xs font-semibold text-text-secondary">
                {proposedLabel} {changedField}
              </p>

              {diff.categoryChanged ? (
                <p className="mt-3 break-words text-xl font-bold leading-7 text-text-primary">
                  {proposed?.category?.name || "Not provided"}
                </p>
              ) : (
                <ClusterDisplay
                  clusterName={proposedCluster?.name}
                  clusterIcon={proposedCluster?.icon}
                  variant="comparison"
                  emphasized
                  className="mt-3"
                />
              )}

              {diff.categoryChanged ? (
                <div className="mt-2">
                  <ClusterDisplay
                    clusterName={proposedCluster?.name}
                    clusterIcon={proposedCluster?.icon}
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
          <ClassificationSpecialtyDiff
            diff={diff}
            status={status}
            specialtyDisplay={specialtyDisplay}
          />
        </div>
      )}
    </div>
  );
}
