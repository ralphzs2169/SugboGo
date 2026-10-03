import ClassificationSpecialtyDiff from "./ClassificationSpecialtyDiff";
import { getClassificationDiff } from "../utils/classificationDiff";

/** Presents the requested classification diff without repeating unchanged snapshots. */
export default function ClassificationRequestedChanges({
  previous,
  proposed,
  applied = false,
}) {
  const diff = getClassificationDiff(previous, proposed);
  const hasTaxonomyChange = diff.categoryChanged || diff.clusterChanged;

  return (
    <section className="rounded-xl border border-stroke bg-background p-5">
      <h2 className="text-base font-semibold text-text-primary">
        {applied ? "Applied Changes" : "Requested Changes"}
      </h2>

      {/* Category and derived cluster */}
      {hasTaxonomyChange ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Category
            </dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              {previous?.category?.name || "—"}
              {diff.categoryChanged && (
                <>
                  {" "}
                  <span aria-hidden="true">→</span>{" "}
                  {proposed?.category?.name || "—"}
                </>
              )}
              {!diff.categoryChanged && (
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  Unchanged
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Cluster
            </dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              {previous?.cluster?.name || "—"}
              {diff.clusterChanged && (
                <>
                  {" "}
                  <span aria-hidden="true">→</span>{" "}
                  {proposed?.cluster?.name || "—"}
                </>
              )}
              {!diff.clusterChanged && (
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  Unchanged
                </span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">
          {previous?.category?.name || "—"} · {previous?.cluster?.name || "—"}
        </p>
      )}

      {/* Specialty set changes */}
      <div className="mt-5 border-t border-stroke pt-5">
        <ClassificationSpecialtyDiff diff={diff} />
      </div>
    </section>
  );
}
