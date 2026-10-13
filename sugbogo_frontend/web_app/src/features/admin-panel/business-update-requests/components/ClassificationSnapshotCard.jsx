import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import {
  withClusterDisplay,
  withSpecialtyDisplay,
} from "../utils/classificationDisplay";

/** Presents live classification context beside a stale-baseline warning. */
export default function ClassificationSnapshotCard({
  title,
  classification,
  clusterDisplay,
  specialtyDisplay,
}) {
  const cluster = withClusterDisplay(classification?.cluster, clusterDisplay);
  return (
    <article className="rounded-xl border border-stroke bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs font-medium text-text-secondary">Cluster</dt>
          <dd className="mt-1">
            <ClusterDisplay
              clusterName={cluster?.name}
              clusterIcon={cluster?.icon}
              variant="small"
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-secondary">Category</dt>
          <dd className="mt-1 text-sm font-semibold text-text-primary">
            {classification?.category?.name || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-secondary">
            Specialty Tags
          </dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {(classification?.specialty_tags ?? []).map((snapshotTag) => {
              const tag = withSpecialtyDisplay(snapshotTag, specialtyDisplay);

              return tag.color ? (
                <SpecialtyTagChip
                  key={tag.id}
                  tag={tag}
                  size="small"
                  showIcon={Boolean(tag.icon)}
                />
              ) : (
                <span
                  key={tag.id}
                  className="rounded-full border border-stroke bg-background px-2.5 py-1 text-xs font-medium text-text-primary"
                >
                  {tag.name}
                </span>
              );
            })}
          </dd>
        </div>
      </dl>
    </article>
  );
}
