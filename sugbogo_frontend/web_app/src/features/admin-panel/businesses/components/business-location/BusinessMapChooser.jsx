import { Store } from "lucide-react";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import StatusBadge from "@/shared/components/StatusBadge";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";

/** Presents exact business choices without navigating away from the map. */
export default function BusinessMapChooser({
  businesses,
  selectedId,
  onSelect,
}) {
  return (
    <div className="space-y-2 px-3 pb-4">
      {businesses.map((business) => {
        const Icon =
          CLUSTER_ICONS.find((item) => item.value === business.cluster_icon)
            ?.icon ?? Store;
        const status = getBusinessStatusConfig(business.status);
        return (
          <button
            key={business.id}
            type="button"
            onClick={() => onSelect(business)}
            className={`flex min-h-[72px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary ${selectedId === business.id ? "border-primary bg-primary/5" : "border-stroke bg-background"}`}
          >
            <Icon
              size={19}
              className="shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span
                className="line-clamp-2 text-sm font-semibold leading-5"
                title={business.business_name}
              >
                {business.business_name}
              </span>
              <span
                className="mt-1 block truncate text-xs text-text-secondary"
                title={business.category_name || business.cluster_name}
              >
                {business.category_name ||
                  business.cluster_name ||
                  "Unclassified"}
              </span>
            </span>
            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
          </button>
        );
      })}
    </div>
  );
}
