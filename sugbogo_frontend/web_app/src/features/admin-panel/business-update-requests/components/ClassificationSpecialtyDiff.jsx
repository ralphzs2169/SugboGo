const DIFF_GROUPS = [
  {
    key: "removedSpecialties",
    label: "Removed",
    prefix: "−",
    classes: "border-red-200 bg-red-50 text-red-700",
  },
  {
    key: "addedSpecialties",
    label: "Added",
    prefix: "+",
    classes: "border-green-200 bg-green-50 text-green-700",
  },
  {
    key: "retainedSpecialties",
    label: "Retained",
    prefix: "",
    classes: "border-stroke bg-surface text-text-secondary",
  },
];

/** Shows the requested specialty set changes while preserving retained tags as context. */
export default function ClassificationSpecialtyDiff({ diff }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">
        Specialty Tags
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DIFF_GROUPS.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {group.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {diff[group.key].length > 0 ? (
                diff[group.key].map((tag) => (
                  <span
                    key={tag.id}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${group.classes}`}
                  >
                    {group.prefix && (
                      <span aria-hidden="true">{group.prefix} </span>
                    )}
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
    </div>
  );
}
