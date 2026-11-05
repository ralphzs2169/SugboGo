import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState("clusters");

  return (
    <>
      <div className="mb-4 overflow-x-auto pb-1">
        <TableTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
            <SpecialtyTagManagementPanel enabled={activeTab === tab.id} />
          ) : (
            <ClusterCategoryManagementTable
              resource={tab.id}
              enabled={activeTab === tab.id}
            />
          )}
        </div>
      ))}
    </>
  );
}
