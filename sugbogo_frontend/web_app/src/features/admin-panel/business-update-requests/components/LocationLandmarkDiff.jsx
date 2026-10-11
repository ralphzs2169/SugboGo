import { CircleMinus, CirclePlus } from "lucide-react";

import { getLandmarkDiff } from "../utils/locationDiff";

/** Shows only landmarks added or removed in the stored request snapshots. */
export default function LocationLandmarkDiff({ previous, proposed, status }) {
  const diff = getLandmarkDiff(previous ?? [], proposed ?? []);
  const groups = [
    {
      key: "added",
      label: status === "approved" ? "Added" : "Requested to add",
      Icon: CirclePlus,
    },
    {
      key: "removed",
      label: status === "approved" ? "Removed" : "Requested to remove",
      Icon: CircleMinus,
    },
  ];

  if (!diff.added.length && !diff.removed.length) {
    return null;
  }

  return (
    <section>
      <h4 className="text-sm font-semibold text-text-primary">
        Landmark Changes
      </h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {groups
          .filter((group) => diff[group.key].length > 0)
          .map((group) => (
            <div key={group.key} className="rounded-lg bg-surface p-4">
              <h3 className="text-xs font-semibold text-text-secondary">
                {group.label} ({diff[group.key].length})
              </h3>
              <ul className="mt-2 divide-y divide-stroke">
                {diff[group.key].map((landmark, index) => (
                  <li
                    key={`${landmark.id ?? landmark.place_id ?? landmark.name}-${index}`}
                    className="flex min-w-0 gap-2 py-3"
                  >
                    <group.Icon
                      className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium leading-5 text-text-primary">
                        {landmark.name}
                      </p>
                      {landmark.address && (
                        <p className="mt-1 break-words text-xs leading-5 text-text-secondary">
                          {landmark.address}
                        </p>
                      )}
                      {landmark.source && (
                        <p className="mt-1 text-xs capitalize text-text-secondary">
                          {landmark.source}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  );
}
