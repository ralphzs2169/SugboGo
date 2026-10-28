import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import { useState } from "react";
import TableTabs from "../../components/data-table/TableTabs";
import { useBusinessAcquisition } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import { formatCount } from "../utils/presentation";

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
  return (
    <>
      {/* Compact table shares the existing segmented-control and report patterns. */}
      <AnalyticsSection title="Business Acquisition" description="Which types of businesses are joining SugboGo?" {...state}
        controls={<TableTabs tabs={TABS} activeTab={group} onTabChange={setGroup} tabListId="acquisition-groups" ariaLabel="Business acquisition grouping" />}
        footer={<AnalyticsReportFooter title="Business Acquisition" meta={data?.meta} hasData={Boolean(data)} hasDetails={Boolean(data)} onAbout={() => setMode("about")} onData={() => setMode("data")} />}
      >
        <AnalyticsPeriodLabel period={data?.meta?.period} />
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
