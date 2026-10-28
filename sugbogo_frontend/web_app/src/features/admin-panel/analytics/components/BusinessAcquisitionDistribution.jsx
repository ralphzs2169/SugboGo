import { useId, useState } from "react";
import { ChevronDown, Store } from "lucide-react";

import { CLUSTER_ICONS } from "../../cluster-category/constants/clusterIcons";
import { formatCount, formatPercentage } from "../utils/presentation";

/** Ranks copies of report rows by count, then name and identifier for stable ties. */
function rankClassifications(rows) {
  return [...rows].sort((left, right) => (
    right.created - left.created
    || left.name.localeCompare(right.name, "en-PH", { sensitivity: "base" })
    || (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER)
  ));
}

/** Keeps a zero or unavailable denominator distinct from a measured zero-percent share. */
function acquisitionShare(count, denominator) {
  if (
    !Number.isFinite(count)
    || !Number.isFinite(denominator)
    || count < 0
    || denominator <= 0
  ) {
    return null;
  }
  return count / denominator * 100;
}

/** Displays an independent cluster share with its animated, parent-relative category shares. */
function AcquisitionClusterDistribution({ cluster, total, expanded, onToggle }) {
  const panelId = useId();
  const Icon = CLUSTER_ICONS.find((item) => item.value === cluster.icon)?.icon ?? Store;
  const share = acquisitionShare(cluster.created, total);
  const categories = rankClassifications(cluster.categories);
  const heading = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" strokeWidth={2} />
        <span className="min-w-0 flex-1 break-words font-semibold">{cluster.name}</span>
        {categories.length > 0 && (
          <ChevronDown
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 text-text-secondary motion-safe:transition-transform motion-safe:duration-200 ${expanded ? "" : "-rotate-90"}`}
          />
        )}
      </span>
      <span className="text-right font-semibold tabular-nums">{formatCount(cluster.created)}</span>
      <span className="text-right text-xs text-text-secondary tabular-nums">
        {share === null ? "—" : formatPercentage(Math.round(share * 10) / 10)}
        <span className="sr-only">
          {share === null ? "; share unavailable" : " of all new businesses"}
        </span>
      </span>
    </>
  );
  const headingClass = "grid min-h-8 w-full grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-x-2 rounded text-left text-sm text-text-primary sm:gap-x-3";

  return (
    <li className="min-w-0">
      {/* Cluster bars use the overall acquisition total, including Unclassified. */}
      {categories.length > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className={`${headingClass} cursor-pointer hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-info`}
        >
          {heading}
        </button>
      ) : (
        <div className={headingClass}>{heading}</div>
      )}
      <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${share === null ? 0 : Math.min(100, share)}%` }} />
      </div>

      {/* Only category bars use the parent count; these values are not added to cluster totals. */}
      <div
        id={panelId}
        aria-hidden={!expanded}
        className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-1 pl-7 pt-3 sm:pl-8">
            <p className="mb-3 break-words text-xs text-text-secondary">Breakdown within {cluster.name}</p>
            <ul aria-label={`Categories within ${cluster.name}`} className="space-y-3">
              {categories.map((category) => {
                const categoryShare = acquisitionShare(category.created, cluster.created);
                return (
                  <li key={category.id ?? "unclassified"}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-x-2 text-xs sm:gap-x-3">
                      <span className="min-w-0 break-words text-text-primary">{category.name}</span>
                      <span className="text-right tabular-nums">{formatCount(category.created)}</span>
                      <span className="text-right text-text-secondary tabular-nums">
                        {categoryShare === null ? "—" : formatPercentage(Math.round(categoryShare * 10) / 10)}
                        <span className="sr-only">
                          {categoryShare === null ? "; share unavailable" : ` of new businesses within ${cluster.name}`}
                        </span>
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-text-secondary/60" style={{ width: `${categoryShare === null ? 0 : Math.min(100, categoryShare)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Shows ranked acquisition shares with collapsed category breakdowns and natural page scrolling. */
export default function BusinessAcquisitionDistribution({ clusters, total }) {
  const listId = useId();
  const [expandedClusters, setExpandedClusters] = useState(() => new Set());
  const rankedClusters = rankClassifications(clusters);
  const expandableClusters = rankedClusters.filter((cluster) => cluster.categories.length > 0);
  const allExpanded = expandableClusters.length > 0 && expandableClusters.every(
    (cluster) => expandedClusters.has(cluster.id ?? "unclassified"),
  );

  function toggleCluster(clusterId) {
    setExpandedClusters((previous) => {
      const next = new Set(previous);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedClusters(new Set());
    } else {
      setExpandedClusters(new Set(
        expandableClusters.map((cluster) => cluster.id ?? "unclassified"),
      ));
    }
  }

  return (
    <div className="min-w-0">
      {/* Bulk and individual navigation never alter the displayed acquisition counts. */}
      <button
        type="button"
        aria-controls={listId}
        onClick={toggleAll}
        disabled={!expandableClusters.length}
        className="mb-3 inline-flex min-h-8 cursor-pointer items-center rounded-md px-2 text-xs font-medium text-text-primary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50"
      >
        {allExpanded ? "Collapse all" : "Expand all"}
      </button>
      <ul id={listId} aria-label="New businesses ranked by cluster" className="space-y-5">
        {rankedClusters.map((cluster) => (
          <AcquisitionClusterDistribution
            key={cluster.id ?? "unclassified"}
            cluster={cluster}
            total={total}
            expanded={expandedClusters.has(cluster.id ?? "unclassified")}
            onToggle={() => toggleCluster(cluster.id ?? "unclassified")}
          />
        ))}
      </ul>
      {!rankedClusters.length && (
        <p className="py-6 text-center text-sm text-text-secondary">
          No new businesses were recorded during this period.
        </p>
      )}
    </div>
  );
}
