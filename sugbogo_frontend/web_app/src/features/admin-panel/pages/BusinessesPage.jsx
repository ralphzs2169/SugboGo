import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import { Building2, List } from "lucide-react";

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
            href: "/admin-panel/dashboard",
          },
          {
            label: "Management",
          },
          {
            label: "Businesses",
          },
        ]}
        title="Business Management"
      />

      {/* Business overview */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Building2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Business Overview
        </h2>
        <p className="-mt-2 mb-3 text-xs text-text-secondary">
          Current business state and month-to-date activity · PHT
        </p>

        <BusinessMetrics />
      </section>

      {/* Business directory */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          Business Directory
        </h2>

        <BusinessManagementTable />
      </section>
    </>
  );
}
