import { useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import TableTabs from "../../components/data-table/TableTabs";
import { useBusinessAcquisition } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import { formatCount, formatTimestamp } from "../utils/presentation";

const TABS = [{ id: "categories", label: "By Category" }, { id: "clusters", label: "By Cluster" }];
const COLUMNS = [
  { key: "name", label: "Classification" },
  { key: "created", label: "Created", render: (row) => formatCount(row.created) },
  { key: "approved", label: "Approved", render: (row) => formatCount(row.approved) },
];

/** Compares separate business acquisition events by current category or cluster. */
export default function BusinessAcquisitionSection({ period }) {
  const [group, setGroup] = useWorkspaceSelection("acquisition.group", "categories");
  const [mode, setMode] = useState(null);
  const query = useBusinessAcquisition(period);
  const state = useAnalyticsSectionState(query, "business-acquisition", "business acquisition");
  const data = query.data;
  const actionStyle = "inline-flex cursor-pointer items-center gap-1.5 rounded py-2 text-xs font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <>
      {/* Compact table shares the existing segmented-control and report patterns. */}
      <AnalyticsSection title="Business Acquisition" description="Which types of businesses are joining SugboGo?" {...state}
        controls={<TableTabs tabs={TABS} activeTab={group} onTabChange={setGroup} tabListId="acquisition-groups" ariaLabel="Business acquisition grouping" />}
        footer={<div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4 text-xs text-text-secondary"><span>Updated {formatTimestamp(data?.meta?.generated_at)} PHT <button type="button" aria-label="About Business Acquisition" disabled={!data} onClick={() => setMode("about")} className={actionStyle}><Info aria-hidden="true" className="h-4 w-4" /></button></span><button type="button" disabled={!data} onClick={() => setMode("data")} className={actionStyle}>View data <ArrowRight aria-hidden="true" className="h-4 w-4" /></button></div>}
      >
        <div role="tabpanel" id={`acquisition-groups-panel-${group}`} aria-labelledby={`acquisition-groups-${group}`} tabIndex={0} className="max-h-72 overflow-auto rounded focus-visible:outline-2 focus-visible:outline-info"><AnalyticsExactTable caption={`Business acquisition by ${group}`} rows={data?.[group]} columns={COLUMNS} emptyMessage="No business creations or first approvals were recorded during this period." /></div>
      </AnalyticsSection>
      {/* Both complete grouping tables remain available in the shared exact-data drawer. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Business Acquisition" report={data} interval="Selected period" series={[]} showComparison={false}
        aboutContent={<div className="space-y-3">{Object.entries(data?.definitions ?? {}).map(([key, value]) => <p key={key}>{value}</p>)}</div>}
        dataContent={<div className="space-y-5">{TABS.map((tab) => <AnalyticsExactTable key={tab.id} caption={`Acquisition ${tab.label.toLowerCase()}`} rows={data?.[tab.id]} columns={COLUMNS} />)}<p>Created: {formatCount(data?.totals?.created)}. Approved: {formatCount(data?.totals?.approved)}.</p></div>}
      />
    </>
  );
}
