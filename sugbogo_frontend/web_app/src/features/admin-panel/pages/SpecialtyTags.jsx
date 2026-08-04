import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import SpecialtyTagManagementPanel from "../specialty-tags/components/SpecialtyTagManagementPanel";
import PageHeader from "../components/PageHeader";

export default function SpecialtyTags() {
  useDocumentTitle("Specialty Tags | SugboGo Admin");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
          },
          {
            label: "MSME Management",
          },
          {
            label: "Specialty Tags",
          },
        ]}
        title="Specialty Tag Management"
      />

      <SpecialtyTagManagementPanel />
    </>
  );
}
