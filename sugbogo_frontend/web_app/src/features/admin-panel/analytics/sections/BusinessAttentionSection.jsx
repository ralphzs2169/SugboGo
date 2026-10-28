import { useState } from "react";
import { Link } from "react-router-dom";
import { useBusinessAttention, useLowExposureBusinesses } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsTableSection from "../components/AnalyticsTableSection";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsScopeFilters from "../components/AnalyticsScopeFilters";
import AnalyticsReportContext from "../components/AnalyticsReportContext";
import { formatCount } from "../utils/presentation";

const MODES = [{ value: "activity", label: "Business activity" }, { value: "low", label: "Low recorded attention" }];
const ORDER_FIELDS = [["business_name", "Business"], ["profile_visits", "Profile visits"], ["saves", "Saves"], ["distinct_savers", "Distinct savers"], ["valid_vouches", "Valid vouches"], ["distinct_supporters", "Distinct supporters"]];
const ORDER_OPTIONS = ORDER_FIELDS.flatMap(([key, label]) => [{ value: key, label: `${label} · ascending` }, { value: `-${key}`, label: `${label} · descending` }]);
const COLUMNS = [
  { accessorKey: "business_name", header: "Business", size: 230, enableSorting: false, cell: ({ row }) => <div><Link className="cursor-pointer rounded font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-info" to={`/admin-panel/businesses/${row.original.business_id}`}>{row.original.business_name}</Link><p className="mt-1 text-xs text-text-secondary">{row.original.category_name} · {row.original.cluster_name}</p>{row.original.has_full_business_window === false && <p className="mt-1 text-xs text-text-secondary">Short observation history</p>}</div> },
  ...ORDER_FIELDS.slice(1).map(([key, label]) => ({ accessorKey: key, header: label, size: 120, enableSorting: false, cell: ({ getValue }) => formatCount(getValue()) })),
];

/** Keeps sorting and pagination on the server and labels fixed-window selection limits explicitly. */
function AttentionTable({ query, mode, onMode, params, setParams }) {
  const state = useAnalyticsSectionState(query, `business-${mode}`, "business attention");
  const data = query.data;
  function update(next) {
    setParams((previous) => ({ ...previous, ...next, page: 1 }));
  }
  return (
    <AnalyticsTableSection title="Businesses Needing Attention" description={mode === "low" ? "Low recorded attention · fixed window, independent of global dates." : "Recorded activity and specialty evidence for follow-up."} {...state}
      filters={<><AnalyticsMetricSelector label="Attention mode" value={mode} onChange={onMode} options={MODES} /><AnalyticsScopeFilters scope="Attention" value={params} onChange={(scope) => update({ cluster: scope.cluster, category: scope.category })} /><AnalyticsMetricSelector label="Order by" value={params.ordering} onChange={(ordering) => update({ ordering })} options={ORDER_OPTIONS} /></>}
      partialNotice={data?.meta?.is_partial ? "Visibility coverage is unverified. Support is current evidence; activity uses the report's observation dates." : null}
      unavailableMessage="This selection is unavailable because the visibility source cannot support its requested ordering or policy. Try again later or choose business activity ordered by a support field."
      footer={<><span className="text-xs text-text-secondary">{mode === "low" && data ? `Fixed ${formatCount(data.thresholds?.window_days)}-day observation window · global dates do not apply` : "Selected-period activity · current specialty support"}</span><AnalyticsReportContext meta={data?.meta}>{mode === "low" && data && <p>Low recorded attention is a provisional selection, not a ranking of business quality. Global reporting dates do not apply. {formatCount(data.thresholds?.window_days)} completed Manila days: {data.meta?.period?.start_date} to {data.meta?.period?.end_date}. Pilot policy {formatCount(data.thresholds?.policy_version)}: at most {formatCount(data.thresholds?.max_profile_visits)} recorded profile visits and at least {formatCount(data.thresholds?.min_distinct_supporters)} distinct supporters. Newer businesses may have shorter observation histories.</p>}</AnalyticsReportContext></>}
      tableProps={{
        data: data ? data.items ?? null : undefined, columns: COLUMNS,
        state: { sorting: [] }, pagination: { pageIndex: params.page - 1, pageSize: params.page_size },
        pageCount: data?.pagination?.total_pages, totalItems: data?.pagination?.total_items,
        onPaginationChange: (next) => setParams((previous) => ({ ...previous, page: next.pageIndex + 1, page_size: next.pageSize })),
        config: { compact: true, emptyState: { title: "No businesses match this selection.", description: "Try another scope or attention mode." } },
      }}
    />
  );
}

/** Mounts only the selectable-period business-activity query. */
function BusinessActivityView({ period, onMode }) {
  const [params, setParams] = useState({ page: 1, page_size: 10, ordering: "-profile_visits" });
  const query = useBusinessAttention({ ...period, ...params });
  return (
    <>
      {/* Selectable-period report with server-owned ordering */}
      <AttentionTable query={query} mode="activity" onMode={onMode} params={params} setParams={setParams} />
    </>
  );
}

/** Mounts only the fixed-window query and intentionally receives no global reporting period. */
function LowAttentionView({ onMode }) {
  const [params, setParams] = useState({ page: 1, page_size: 10, ordering: "profile_visits" });
  const query = useLowExposureBusinesses(params);
  return (
    <>
      {/* Fixed-window report never receives global dates */}
      <AttentionTable query={query} mode="low" onMode={onMode} params={params} setParams={setParams} />
    </>
  );
}

/** Switches report lifecycles without fetching the inactive attention mode. */
export default function BusinessAttentionSection({ period }) {
  const [mode, setMode] = useState("activity");
  return (
    <>
      {/* Mode and period changes reset server pagination before issuing a request */}
      {mode === "activity" ? <BusinessActivityView key={JSON.stringify(period)} period={period} onMode={setMode} /> : <LowAttentionView onMode={setMode} />}
    </>
  );
}
