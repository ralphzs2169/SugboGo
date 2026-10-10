import { CircleMinus, CirclePlus } from "lucide-react";

import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

/** Groups only changed specialty tags from the frozen snapshots. */
export default function ClassificationSpecialtyDiff({ diff, status }) {
  const groups = [
    {
      key: "addedSpecialties",
      label: status === "approved" ? "Added" : "Requested to add",
      Icon: CirclePlus,
    },
    {
      key: "removedSpecialties",
      label: status === "approved" ? "Removed" : "Requested to remove",
      Icon: CircleMinus,
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">
        Specialty changes
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {groups
          .filter((group) => diff[group.key].length > 0)
          .map((group) => (
            <div key={group.key} className="rounded-lg bg-surface p-4">
              <h4 className="text-xs font-semibold text-text-secondary">
                {group.label} ({diff[group.key].length})
              </h4>
              <ul className="mt-2 divide-y divide-stroke">
                {diff[group.key].map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-2 py-2 text-sm text-text-primary"
                  >
                    <group.Icon
                      className="h-4 w-4 shrink-0 text-text-secondary"
                      aria-hidden="true"
                    />
                    {tag.color ? (
                      <SpecialtyTagChip tag={tag} size="small" />
                    ) : (
                      <span className="break-words rounded-full border border-stroke bg-background px-2.5 py-1 text-xs">
                        {tag.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
