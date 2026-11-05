import { useSearchParams } from "react-router-dom";
import { Layers, Tag, Tags } from "lucide-react";

import ClusterCategoryManagementTable from "../../cluster-category/components/ClusterCategoryManagementTable";
import TableTabs from "../../components/data-table/TableTabs";
import SpecialtyTagManagementPanel from "../../specialty-tags/components/SpecialtyTagManagementPanel";

const TABS = [
  { id: "clusters", label: "Clusters", icon: Layers },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "specialty-tags", label: "Specialty Tags", icon: Tags },
];

/** Retain each management panel's state while fetching only the active taxonomy. */
export default function TaxonomyManagementWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "clusters";

  function handleTabChange(tab) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", tab);
      return next;
    });
  }

  return (
    <div className="relative min-w-0 w-full rounded-2xl border border-stroke bg-background px-3 pb-4 pt-2 sm:px-6">
      <div className="mb-4 overflow-x-auto pb-1">
        <TableTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabListId="business-taxonomy"
          ariaLabel="Business taxonomy types"
        />
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`business-taxonomy-panel-${tab.id}`}
          aria-labelledby={`business-taxonomy-${tab.id}`}
          hidden={activeTab !== tab.id}
        >
          {tab.id === "specialty-tags" ? (
            <SpecialtyTagManagementPanel
              embedded
              enabled={activeTab === tab.id}
            />
          ) : (
            <ClusterCategoryManagementTable
              embedded
              resource={tab.id}
              enabled={activeTab === tab.id}
            />
          )}
        </div>
      ))}
    </div>
  );
}
