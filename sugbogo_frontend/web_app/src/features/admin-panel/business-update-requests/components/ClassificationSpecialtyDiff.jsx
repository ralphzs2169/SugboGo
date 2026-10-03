const DIFF_GROUPS = [
  { key: "removed", label: "Removed", classes: "border-red-200 bg-red-50 text-red-700" },
  { key: "retained", label: "Retained", classes: "border-stroke bg-surface text-text-secondary" },
  { key: "added", label: "Added", classes: "border-green-200 bg-green-50 text-green-700" },
];

/** Summarizes removed, retained, and added specialties from immutable snapshots. */
export default function ClassificationSpecialtyDiff({ previous, proposed }) {
  const previousTags = previous?.specialty_tags ?? [];
  const proposedTags = proposed?.specialty_tags ?? [];
  const previousIds = new Set(previousTags.map((tag) => tag.id));
  const proposedIds = new Set(proposedTags.map((tag) => tag.id));
  const groups = {
    removed: previousTags.filter((tag) => !proposedIds.has(tag.id)),
    retained: proposedTags.filter((tag) => previousIds.has(tag.id)),
    added: proposedTags.filter((tag) => !previousIds.has(tag.id)),
  };

  return (
    <section className="rounded-xl border border-stroke bg-background p-5">
      <h2 className="text-base font-semibold text-text-primary">
        Specialty Changes
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {DIFF_GROUPS.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {group.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {groups[group.key].length > 0 ? (
                groups[group.key].map((tag) => (
                  <span
                    key={tag.id}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${group.classes}`}
                  >
                    {tag.name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-text-secondary">None</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
