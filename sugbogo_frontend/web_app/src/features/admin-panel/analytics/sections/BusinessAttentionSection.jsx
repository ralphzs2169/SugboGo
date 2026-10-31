import { useState } from "react";
import { AlertCircle, Clock3, Heart, ImageOff, Info, SearchX, Users } from "lucide-react";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { Link } from "react-router-dom";
import { useBusinessAttention } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsTableSection from "../components/AnalyticsTableSection";
import SortMenu from "../../components/data-table/SortMenu";
import TableEmptyState from "../../components/data-table/TableEmptyState";
import Tooltip from "../../../../shared/components/actions/Tooltip";
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

/** Decorative bars compare readable counts on this page; they never affect ranking. */
function ActivityMetric({ value, label, maximum }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold tabular-nums text-text-primary">{formatCount(value)}</p>
      <p className="mt-0.5 text-xs text-text-secondary">{label}</p>
      {value != null && (
        <div aria-hidden="true" className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-primary/70" style={{ width: maximum > 0 ? `${(value / maximum) * 100}%` : "0%" }} />
        </div>
      )}
    </div>
  );
}

function AttentionReasonBadge({ business }) {
  const reason = attentionReason(business);
  const noVisits = reason === "No recorded profile visits";
  const noSaves = reason === "No recorded saves";
  const Icon = noVisits ? AlertCircle : noSaves ? Clock3 : null;
  const tone = noVisits
    ? "bg-danger/10 text-danger"
    : noSaves ? "bg-warning/10 text-warning" : "bg-surface-muted text-text-secondary";
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${tone}`}>
      {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
      {reason}
    </span>
  );
}

function MetricGroupHeading({ title, description }) {
  return (
    <span className="inline-flex items-center gap-2">
      {title}
      <Tooltip content={description} asChild place="top">
        <button type="button" aria-label={`About ${title.toLowerCase()}`} className="cursor-pointer rounded text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-info">
          <Info aria-hidden="true" className="h-4 w-4" />
        </button>
      </Tooltip>
    </span>
  );
}

/** Uses DataTable's content slot so shared pagination and empty states remain intact. */
function AttentionRankingTable({ businesses, offset, emptyState }) {
  const maximums = METRICS.slice(0, 3).map(([key]) => Math.max(0, ...businesses.map((business) => business[key] ?? 0)));
  const headerClass = "px-4 text-left font-semibold text-text-primary";
  const cellClass = "px-4 py-3 align-middle";
  return (
    <div role="region" aria-label="Business attention rankings" tabIndex={0} className="-mx-4 overflow-x-auto border-y border-stroke focus-visible:outline-2 focus-visible:outline-info sm:-mx-5">
      <table className="w-full min-w-[1160px] table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">Businesses ranked by recorded activity. Miniature bars compare each discovery metric within this page.</caption>
        <colgroup><col className="w-[4%]" /></colgroup>
        <colgroup><col className="w-[29%]" /></colgroup>
        <colgroup><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[10%]" /></colgroup>
        <colgroup><col className="w-[10%]" /><col className="w-[10%]" /></colgroup>
        <colgroup><col className="w-[19%]" /></colgroup>
        <thead className="border-b border-stroke bg-surface-muted/60">
          <tr>
            <th scope="col" rowSpan={2} className={headerClass}>#</th>
            <th scope="col" rowSpan={2} className={headerClass}>Business</th>
            <th scope="colgroup" colSpan={3} className={`${headerClass} pb-2 pt-3`}>
              <MetricGroupHeading title="Discovery activity" description="Recorded profile visits, saves and distinct savers during the selected period. Recording coverage may be unverified." />
            </th>
            <th scope="colgroup" colSpan={2} className={`${headerClass} border-l border-stroke pb-2 pt-3`}>
              <MetricGroupHeading title="Specialty support" description="Current valid specialty vouches and distinct supporters, shown as separate measures." />
            </th>
            <th scope="col" rowSpan={2} className={headerClass}>Why attention is needed</th>
          </tr>
          <tr className="text-xs text-text-secondary">
            {METRICS.map(([key, label], index) => <th key={key} scope="col" className={`px-4 pb-3 font-normal ${index === 3 ? "border-l border-stroke" : ""}`}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {businesses.length === 0 && <tr><td colSpan={8}><TableEmptyState {...emptyState} compact /></td></tr>}
          {businesses.map((business, index) => (
            <tr key={business.business_id} className="border-b border-stroke last:border-b-0 hover:bg-interaction-hover">
              <td className={cellClass}><span className="font-semibold tabular-nums">{offset + index + 1}</span></td>
              <td className={cellClass}>
                <div className="flex items-center gap-3">
                  <BusinessCover key={`${business.business_id}:${business.cover_photo_url ?? ""}`} business={business} />
                  <div className="min-w-0 break-words">
                    <Link className="cursor-pointer rounded font-semibold text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-info" to={`/admin-panel/businesses/${business.business_id}`}>{business.business_name}</Link>
                    <p className="mt-0.5 text-xs text-text-secondary">{business.category_name} · {business.cluster_name}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">Business #{business.business_id}{business.has_full_business_window === false ? " · Short observation history" : ""}</p>
                  </div>
                </div>
              </td>
              {METRICS.slice(0, 3).map(([key], metricIndex) => (
                <td key={key} className={cellClass}>
                  <ActivityMetric value={business[key]} label={["visits", "saves", "distinct savers"][metricIndex]} maximum={maximums[metricIndex]} />
                </td>
              ))}
              <td className={`${cellClass} border-l border-stroke`}>
                <div className="flex items-center gap-2"><Heart aria-hidden="true" className="h-4 w-4 shrink-0 fill-primary/20 text-primary" /><span className="font-semibold tabular-nums">{formatCount(business.valid_vouches)}</span></div>
                <p className="mt-0.5 pl-6 text-xs text-text-secondary">vouches</p>
              </td>
              <td className={cellClass}>
                <div className="flex items-center gap-2"><Users aria-hidden="true" className="h-4 w-4 shrink-0 text-info" /><span className="font-semibold tabular-nums">{formatCount(business.distinct_supporters)}</span></div>
                <p className="mt-0.5 pl-6 text-xs text-text-secondary">supporters</p>
              </td>
              <td className={cellClass}><AttentionReasonBadge business={business} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const emptyState = {
    icon: <SearchX aria-hidden="true" className="h-10 w-10 text-text-secondary" />,
    title: "No businesses to rank for this selection.",
    description: mode === "support"
      ? "No eligible businesses are available for the specialty support ranking."
      : "No eligible businesses are available for the recorded discovery activity ranking.",
  };
  return (
    <>
      <AnalyticsTableSection title="Businesses Needing Attention"
        description={mode === "support" ? "Businesses with the lowest recorded specialty support in current evidence." : "Businesses with the lowest recorded discovery activity during the selected period."}
        {...state}
        filters={<>
          <SortMenu ariaLabel="Attention mode" triggerLabel={mode === "support" ? "Lowest specialty support" : "Lowest activity"} value={mode} onChange={onMode} options={MODES} />
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
          columns: METRICS.map(([accessorKey, header]) => ({ accessorKey, header, enableSorting: false })),
          slots: Array.isArray(data?.items) ? {
            renderContent: () => <AttentionRankingTable businesses={data.items} offset={(params.page - 1) * params.page_size} emptyState={emptyState} />,
          } : undefined,
          state: { sorting: [] },
          pagination: { pageIndex: params.page - 1, pageSize: params.page_size },
          pageCount: data?.pagination?.total_pages,
          totalItems: data?.pagination?.total_items,
          onPaginationChange: (next) => setParams((previous) => ({ ...previous, page: next.pageIndex + 1, page_size: next.pageSize })),
          config: { compact: true, emptyState },
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
