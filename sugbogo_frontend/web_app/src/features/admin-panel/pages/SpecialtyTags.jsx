import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import SpecialtyTagManagementPanel from "../specialty-tags/components/SpecialtyTagManagementPanel";
import SpecialtyTagMetrics from "../specialty-tags/components/SpecialtyTagMetrics";
import useSpecialtyTagStatistics from "../specialty-tags/hooks/useSpecialtyTagStatistics";

export default function SpecialtyTags() {
  useDocumentTitle("Specialty Tags | SugboGo Admin");

  const { statistics, isLoading } = useSpecialtyTagStatistics();

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

      <SpecialtyTagMetrics totalTags={isLoading ? "—" : statistics.totalTags} />

      <SpecialtyTagManagementPanel />
    </>
  );
}
