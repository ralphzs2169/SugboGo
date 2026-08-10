import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import BusinessApplicationManagementPanel from "../business-applications/components/BusinessApplicationManagementPanel";

export default function BusinessApplicationsPage() {
  useDocumentTitle("Business Applications | SugboGo Admin");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
          },
          {
            label: "Business Management",
          },
          {
            label: "Applications",
          },
        ]}
        title="Business Applications"
      />

      <BusinessApplicationManagementPanel />
    </>
  );
}
