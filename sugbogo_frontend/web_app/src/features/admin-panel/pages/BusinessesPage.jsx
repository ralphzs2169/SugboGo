import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import BusinessManagementTable from "../businesses/components/BusinessManagementTable";

export default function BusinessManagementPage() {
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
        title="Businesses"
      />

      {/* Business management */}
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Business Management
      </h2>

      <BusinessManagementTable />
    </>
  );
}
