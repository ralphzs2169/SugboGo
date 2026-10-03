import { getLandmarkDiff } from "../utils/locationDiff";

const GROUPS = [
  { key: "removed", label: "Removed" },
  { key: "added", label: "Added" },
  { key: "retained", label: "Retained" },
];

/** Presents unordered landmark changes using the frozen submission snapshots. */
export default function LocationLandmarkDiff({ previous, proposed }) {
  const diff = getLandmarkDiff(previous, proposed);
  return (
    <section>
      <h3 className="text-sm font-semibold text-text-primary">Landmarks</h3>
      {/* Removed, added, and retained landmark groups */}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {GROUPS.map((group) => (
          <div
            key={group.key}
            className="rounded-lg border border-stroke bg-surface p-4"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {group.label} ({diff[group.key].length})
            </h4>
            {diff[group.key].length ? (
              <ul className="mt-3 space-y-3">
                {diff[group.key].map((landmark, index) => (
                  <li
                    key={`${landmark.id ?? landmark.place_id ?? landmark.name}-${index}`}
                  >
                    <p className="text-sm font-medium text-text-primary">
                      {landmark.name}
                    </p>
                    {landmark.address && (
                      <p className="text-xs text-text-secondary">
                        {landmark.address}
                      </p>
                    )}
                    <p className="text-xs capitalize text-text-secondary">
                      {landmark.source}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-text-secondary">None</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
