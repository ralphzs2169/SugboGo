import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import PageHeader from "../components/PageHeader";
import BusinessManagementTable from "../businesses/components/BusinessManagementTable";
import BusinessMetrics from "../businesses/components/BusinessMetrics";

export default function BusinessesPage() {
  useDocumentTitle("Businesses | SugboGo Admin");

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
            href: "/admin",
          },
          {
            label: "Management",
            href: "/admin/businesses",
          },
          {
            label: "Businesses",
          },
        ]}
        title="Business Management"
      />

      {/* Business overview */}
      <section className="mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Overview
        </h2>

        <BusinessMetrics />
      </section>

      {/* Business management */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Management
        </h2>

        <BusinessManagementTable />
      </section>
    </>
  );
}
