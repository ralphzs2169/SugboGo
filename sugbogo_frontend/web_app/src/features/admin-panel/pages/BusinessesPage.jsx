import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import { Building2 } from "lucide-react";

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
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Building2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Business Overview
        </h2>
        <p className="-mt-2 mb-3 text-xs text-text-secondary">
          Current business state and month-to-date activity · PHT
        </p>

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
