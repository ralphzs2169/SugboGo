import ClusterDisplay from "@/shared/components/ClusterDisplay";

import ReviewComparison from "./ReviewComparison";
import ClassificationSpecialtyDiff from "./ClassificationSpecialtyDiff";
import { getClassificationDiff } from "../utils/classificationDiff";

/** Shows only category and specialty changes captured in the proposal. */
export default function ClassificationRequestedChanges({
  previous,
  proposed,
  status,
}) {
  const diff = getClassificationDiff(previous, proposed);
  const categoryChanged = diff.categoryChanged;
  const specialtyChanged =
    diff.addedSpecialties.length > 0 || diff.removedSpecialties.length > 0;

  return (
    <section className="rounded-xl border border-stroke bg-background p-5">
      <h2 className="text-base font-semibold text-text-primary">
        Requested changes
      </h2>
      {categoryChanged && (
        <div className="mt-5">
          <ReviewComparison
            title="Category change"
            previous={previous?.category?.name}
            proposed={proposed?.category?.name}
            status={status}
          >
            <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
              <div>
                <span className="block">Previous cluster</span>
                <ClusterDisplay
                  clusterName={previous?.cluster?.name}
                  clusterIcon={previous?.cluster?.icon}
                  variant="small"
                />
              </div>
              <div>
                <span className="block">Requested cluster</span>
                <ClusterDisplay
                  clusterName={proposed?.cluster?.name}
                  clusterIcon={proposed?.cluster?.icon}
                  variant="small"
                />
              </div>
            </div>
          </ReviewComparison>
        </div>
      )}
      {!categoryChanged && diff.clusterChanged && (
        <div className="mt-5">
          <ReviewComparison
            title="Cluster change"
            previous={
              <ClusterDisplay
                clusterName={previous?.cluster?.name}
                clusterIcon={previous?.cluster?.icon}
                variant="small"
              />
            }
            proposed={
              <ClusterDisplay
                clusterName={proposed?.cluster?.name}
                clusterIcon={proposed?.cluster?.icon}
                variant="small"
              />
            }
            status={status}
          />
        </div>
      )}
      {specialtyChanged && (
        <div
          className={
            categoryChanged || diff.clusterChanged
              ? "mt-5 border-t border-stroke pt-5"
              : "mt-5"
          }
        >
          <ClassificationSpecialtyDiff diff={diff} status={status} />
        </div>
      )}
    </section>
  );
}
