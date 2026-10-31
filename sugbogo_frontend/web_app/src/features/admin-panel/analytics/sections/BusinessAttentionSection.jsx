import { useState } from "react";
import { ImageOff, SearchX } from "lucide-react";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { Link } from "react-router-dom";
import { useBusinessAttention } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsTableSection from "../components/AnalyticsTableSection";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsScopeFilters from "../components/AnalyticsScopeFilters";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsReportExplanation from "../components/AnalyticsReportExplanation";
import AnalyticsReliability from "../components/AnalyticsReliability";
import { formatCount } from "../utils/presentation";

const MODES = [
  { value: "discovery", label: "Low discovery activity" },
  { value: "support", label: "Low specialty support" },
];
const METRICS = [
  ["profile_visits", "Profile visits"],
  ["saves", "Saves"],
  ["distinct_savers", "Distinct savers"],
  ["valid_vouches", "Valid vouches"],
  ["distinct_supporters", "Supporters"],
];

/** Reuses the business storefront contract and neutral missing-image treatment. */
function BusinessCover({ business }) {
  const [failed, setFailed] = useState(false);
  return business.cover_photo_url && !failed ? (
    <img src={business.cover_photo_url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
  ) : (
    <div aria-label="No cover photo available" role="img" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-muted text-text-secondary">
      {/* Existing neutral image placeholder; no fabricated image URL. */}
      <ImageOff aria-hidden="true" className="h-5 w-5" />
    </div>
  );
}

/** Displays the server-owned reason for an actual attention candidate. */
function attentionReason(business) {
  return business.attention_reason ?? "Attention eligibility unavailable";
}

function attentionColumns() {
  return [
    {
      accessorKey: "business_name", header: "Business", size: 300, enableSorting: false,
      cell: ({ row }) => {
        const business = row.original;
        return (
          <div className="flex items-center gap-3">
            <BusinessCover key={`${business.business_id}:${business.cover_photo_url ?? ""}`} business={business} />
            <div className="min-w-0">
              <Link className="cursor-pointer rounded font-semibold text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-info" to={`/admin-panel/businesses/${business.business_id}`}>{business.business_name}</Link>
              <p className="mt-1 text-xs text-text-secondary">{business.category_name} · {business.cluster_name}</p>
              <p className="mt-1 text-xs text-text-secondary">Business #{business.business_id}{business.has_full_business_window === false ? " · Short observation history" : ""}</p>
            </div>
          </div>
        );
      },
    },
    ...METRICS.map(([key, label]) => ({
      accessorKey: key,
      header: () => <span className="w-full text-right">{label}</span>,
      size: 110,
      enableSorting: false,
      cell: ({ getValue }) => <span className="block text-right tabular-nums">{formatCount(getValue())}</span>,
    })),
    { id: "attention_reason", header: "Why attention is needed", size: 200, enableSorting: false, cell: ({ row }) => <span className="text-xs text-text-secondary">{attentionReason(row.original)}</span> },
  ];
}

/** Keeps ascending ranking, scope and pagination server-owned and independently recoverable. */
function AttentionView({ period, mode, onMode }) {
  const [params, setParams] = useWorkspaceSelection(`attention.${mode}.${JSON.stringify(period)}`, { page: 1, page_size: 10 });
  const [drawer, setDrawer] = useState(null);
  const ordering = mode === "support" ? "valid_vouches" : "profile_visits";
  const query = useBusinessAttention({ ...period, ...params, ordering, attention_mode: mode });
  const state = useAnalyticsSectionState(query, `business-${mode}`, "business attention");
  const data = query.data;
  const discoveryNotice = data?.sources?.visibility?.coverage_verified === true
    ? "Based on recorded discovery activity · recording coverage verified"
    : "Based on recorded discovery activity · recording coverage unverified";
  return (
    <>
      <AnalyticsTableSection title="Businesses Needing Attention"
        description={mode === "support" ? "Businesses with the lowest recorded specialty support in current evidence." : "Businesses with the lowest recorded discovery activity during the selected period."}
        {...state}
        filters={<>
          <AnalyticsMetricSelector label="Attention mode" value={mode} onChange={onMode} options={MODES} />
          <AnalyticsScopeFilters scope="Attention" value={params} onChange={(scope) => setParams((previous) => ({ ...previous, cluster: scope.cluster, category: scope.category, page: 1 }))} />
        </>}
        partialNotice={data?.meta?.is_partial ? (
          mode === "discovery"
            ? discoveryNotice
            : "Discovery recording coverage is unverified. Missing observations are unavailable, not zero. Specialty support reflects current evidence."
        ) : null}
        unavailableMessage="Required discovery observations are unavailable for this ranking. Try again later, or select Low specialty support to review current endorsement evidence."
        footer={<AnalyticsReportFooter title="Businesses Needing Attention" meta={data?.meta} hasData={Array.isArray(data?.items)} hasDetails={Boolean(data)} onAbout={() => setDrawer("about")} onData={() => setDrawer("data")} />}
        tableProps={{
          data: data ? data.items ?? null : undefined,
          columns: attentionColumns(),
          state: { sorting: [] },
          pagination: { pageIndex: params.page - 1, pageSize: params.page_size },
          pageCount: data?.pagination?.total_pages,
          totalItems: data?.pagination?.total_items,
          onPaginationChange: (next) => setParams((previous) => ({ ...previous, page: next.pageIndex + 1, page_size: next.pageSize })),
          config: { compact: true, emptyState: {
            icon: <SearchX aria-hidden="true" className="h-10 w-10 text-text-secondary" />,
            title: "No businesses to rank for this selection.",
            description: mode === "support"
              ? "No eligible businesses are available for the specialty support ranking."
              : "No eligible businesses are available for the recorded discovery activity ranking.",
          } },
        }}
      />
      {/* Exact current-page values and methodology use the established detail drawer. */}
      <AnalyticsDetailDrawer mode={drawer} onClose={() => setDrawer(null)} title="Businesses Needing Attention"
        report={data} interval="selected period" series={[]} showComparison={false}
        aboutContent={<pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ ordering: data?.ordering ?? ordering, sources: data?.sources }, null, 2)}</pre>}
        dataContent={<div className="space-y-5">
          <p className="text-sm text-text-secondary">{mode === "support" ? "Low specialty support" : "Low discovery activity"} · page {params.page}. Use table pagination to inspect other businesses.</p>
          <AnalyticsExactTable caption="Business attention exact current-page values" rows={data?.items ?? []} columns={[
            { key: "business_id", label: "Business ID" },
            { key: "business_name", label: "Business" },
            { key: "category_name", label: "Category" },
            { key: "cluster_name", label: "Cluster" },
            ...METRICS.map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) })),
            { key: "reason", label: "Why attention is needed", render: (row) => attentionReason(row) },
          ]} />
          <AnalyticsReportExplanation title="Businesses Needing Attention" report={data} />
          <AnalyticsReliability meta={data?.meta} />
        </div>}
      />
    </>
  );
}

/** Switches attention purposes without fetching an inactive mode or reusing its observations. */
export default function BusinessAttentionSection({ period }) {
  const [mode, setMode] = useWorkspaceSelection("attention.purpose", "discovery");
  return (
    <>
      {/* Mode and period changes restore their own pagination, filters and cached query. */}
      <AttentionView key={`${mode}:${JSON.stringify(period)}`} period={period} mode={mode} onMode={setMode} />
    </>
  );
}
