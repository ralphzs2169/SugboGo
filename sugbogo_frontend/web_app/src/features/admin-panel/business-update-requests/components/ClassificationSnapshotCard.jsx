/** Presents one captured or live classification without depending on taxonomy lookups. */
export default function ClassificationSnapshotCard({
  title,
  classification,
  tone = "neutral",
}) {
  const toneClasses = {
    neutral: "border-stroke bg-surface",
    live: "border-blue-200 bg-blue-50/50",
    proposed: "border-primary/30 bg-primary/5",
  };

  return (
    <article
      className={`rounded-xl border p-4 ${toneClasses[tone] || toneClasses.neutral}`}
    >
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs font-medium text-text-secondary">Cluster</dt>
          <dd className="mt-1 text-sm font-semibold text-text-primary">
            {classification?.cluster?.name || "—"}
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
            {(classification?.specialty_tags ?? []).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-stroke bg-background px-2.5 py-1 text-xs font-medium text-text-primary"
              >
                {tag.name}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </article>
  );
}
