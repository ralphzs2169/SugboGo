import { Layers, List } from "lucide-react";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import TaxonomyManagementWorkspace from "../taxonomy/components/TaxonomyManagementWorkspace";
import TaxonomyOverview from "../taxonomy/components/TaxonomyOverview";

/** Manage the shared taxonomy without coupling inventory cards to table state. */
export default function BusinessTaxonomyPage() {
  useDocumentTitle("Business Taxonomy Management | SugboGo Admin");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin" },
          { label: "Management" },
          { label: "Business Taxonomy" },
        ]}
        title="Business Taxonomy Management"
      />
      <p className="mb-6 text-sm text-text-secondary">
        Manage business clusters, categories, and specialty tags used throughout SugboGo.
      </p>

      <section className="mb-6" aria-labelledby="taxonomy-overview-heading">
        <h2
          id="taxonomy-overview-heading"
          className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary"
        >
          <Layers aria-hidden="true" className="h-4 w-4 shrink-0" />
          Taxonomy Overview
        </h2>
        <TaxonomyOverview />
      </section>

      <section aria-labelledby="taxonomy-management-heading">
        <h2
          id="taxonomy-management-heading"
          className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary"
        >
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          Taxonomy Management
        </h2>
        <TaxonomyManagementWorkspace />
      </section>
    </>
  );
}
