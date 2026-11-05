import { List } from "lucide-react";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import ClusterCategoryManagementTable from "../cluster-category/components/ClusterCategoryManagementTable";
import PageHeader from "../components/PageHeader";

/** Configure the existing Explorer navigation shortcuts in their own management page. */
export default function ExploreConfigurationPage() {
  useDocumentTitle("Explore Configuration | SugboGo Admin");

  return (
    <>
      <PageHeader
        title="Explore Configuration"
        breadcrumbs={[
          { label: "SugboGo Admin" },
          { label: "Management" },
          { label: "Explore Configuration" },
        ]}
      />
      <p className="mb-6 text-sm text-text-secondary">
        Manage discovery shortcuts and navigation entry points shown to explorers.
      </p>
      <section aria-labelledby="discovery-shortcut-management-heading">
        <h2
          id="discovery-shortcut-management-heading"
          className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary"
        >
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          Discovery Shortcuts
        </h2>
        <ClusterCategoryManagementTable resource="discovery-shortcuts" />
      </section>
    </>
  );
}
