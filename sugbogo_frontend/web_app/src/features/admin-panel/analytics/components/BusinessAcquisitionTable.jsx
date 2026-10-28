import { useId, useState } from "react";
import { ChevronDown, Store } from "lucide-react";

import { CLUSTER_ICONS } from "../../cluster-category/constants/clusterIcons";
import { formatCount } from "../utils/presentation";

/** Keeps one cluster subtotal and its category breakdown in the same row group. */
function AcquisitionClusterRows({
  cluster,
  countHeadingId,
  collapsible,
  expanded,
  onToggle,
}) {
  const rowId = useId();
  const clusterHeadingId = `${rowId}-cluster`;
  const categories = cluster.categories;
  const Icon = CLUSTER_ICONS.find((item) => item.value === cluster.icon)?.icon ?? Store;
  const categoryRowId = (index) => `${rowId}-category-${index}`;
  const name = (
    <>
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" strokeWidth={2} />
      <span className="min-w-0 flex-1 break-words">{cluster.name}</span>
    </>
  );
  const animationClass = `grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out ${
    expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
  }`;

  return (
    <tbody className="border-t border-stroke">
      {/* Parent values are subtotals of the category rows, never extra businesses. */}
      <tr>
        <th id={clusterHeadingId} scope="rowgroup" className="px-4 py-3 text-left font-semibold">
          {collapsible && categories.length > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={categories.map((_, index) => categoryRowId(index)).join(" ")}
              onClick={onToggle}
              className="flex w-full cursor-pointer items-center gap-2 rounded text-left hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-info"
            >
              {name}
              <ChevronDown
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 text-text-secondary motion-safe:transition-transform motion-safe:duration-200 ${expanded ? "" : "-rotate-90"}`}
              />
            </button>
          ) : (
            <span className="flex items-center gap-2">{name}</span>
          )}
        </th>
        <td headers={`${countHeadingId} ${clusterHeadingId}`} className="px-4 py-3 text-right font-semibold tabular-nums">
          {formatCount(cluster.created)}
        </td>
      </tr>

      {/* Cell-sized grid transitions retain native table rows and natural page scrolling. */}
      {categories.map((category, index) => (
        <tr key={category.id ?? "unclassified"} id={categoryRowId(index)} aria-hidden={!expanded}>
          <th
            id={`${categoryRowId(index)}-label`}
            scope="row"
            headers={clusterHeadingId}
            className="p-0 text-left align-middle font-normal"
          >
            <div className={animationClass}>
              <div className="min-h-0 overflow-hidden">
                <div className="break-words py-2 pl-14 pr-4 text-xs leading-5 text-text-secondary sm:pl-16">
                  {category.name}
                </div>
              </div>
            </div>
          </th>
          <td
            headers={`${countHeadingId} ${clusterHeadingId} ${categoryRowId(index)}-label`}
            className="p-0 text-right align-middle tabular-nums"
          >
            <div className={animationClass}>
              <div className="min-h-0 overflow-hidden">
                <div className="px-4 py-2 text-xs leading-5 text-text-secondary">
                  {formatCount(category.created)}
                </div>
              </div>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** Shows current cluster/category acquisition counts without pagination or a scroll region. */
export default function BusinessAcquisitionTable({
  clusters,
  total,
  collapsible = true,
}) {
  const countHeadingId = useId();
  const tableId = useId();
  const [expandedClusters, setExpandedClusters] = useState(() => new Set());
  const expandableClusters = clusters.filter((cluster) => cluster.categories.length > 0);
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
      {/* Use the backend total rather than adding parent subtotals to category rows. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {collapsible && (
          <button
            type="button"
            aria-controls={tableId}
            onClick={toggleAll}
            disabled={!expandableClusters.length}
            className="inline-flex min-h-8 cursor-pointer items-center rounded-md px-2 text-xs font-medium text-text-primary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
        <dl className="ml-auto min-w-0 text-right">
          <dt className="text-xs text-text-secondary">Total new businesses</dt>
          <dd className="mt-0.5 text-xl font-semibold text-text-primary tabular-nums">
            {formatCount(total)}
          </dd>
        </dl>
      </div>
      <table id={tableId} className="w-full table-fixed text-left text-sm text-text-primary">
        <caption className="sr-only">
          New businesses by current cluster and category. Category counts break down cluster subtotals.
        </caption>
        <colgroup>
          <col />
          <col className="w-28 sm:w-36" />
        </colgroup>
        {/* The two columns stay aligned for every parent and child classification. */}
        <thead className="bg-surface-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Classification</th>
            <th id={countHeadingId} scope="col" className="px-4 py-3 text-right font-medium">New Businesses</th>
          </tr>
        </thead>
        {clusters.map((cluster) => (
          <AcquisitionClusterRows
            key={cluster.id ?? "unclassified"}
            cluster={cluster}
            countHeadingId={countHeadingId}
            collapsible={collapsible}
            expanded={!collapsible || expandedClusters.has(cluster.id ?? "unclassified")}
            onToggle={() => toggleCluster(cluster.id ?? "unclassified")}
          />
        ))}
        {!clusters.length && (
          <tbody>
            <tr>
              <td colSpan={2} className="px-4 py-8 text-center text-text-secondary">
                No new businesses were recorded during this period.
              </td>
            </tr>
          </tbody>
        )}
        <tfoot className="border-t border-stroke">
          <tr>
            <th scope="row" className="px-4 py-3 font-semibold">Grand total of new businesses</th>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCount(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
