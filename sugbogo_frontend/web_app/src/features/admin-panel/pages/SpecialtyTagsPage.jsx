import { Tags, List } from "lucide-react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import MetricCardsSkeleton from "@/features/admin-panel/components/MetricCardsSkeleton";
import PageHeader from "../components/PageHeader";
import SpecialtyTagManagementPanel from "../specialty-tags/components/SpecialtyTagManagementPanel";
import SpecialtyTagMetrics from "../specialty-tags/components/SpecialtyTagMetrics";
import useSpecialtyTagStatistics from "../specialty-tags/hooks/useSpecialtyTagStatistics";

export default function SpecialtyTagsPage() {
  useDocumentTitle("Specialty Tags | SugboGo Admin");

  const { statistics, isLoading } = useSpecialtyTagStatistics();

  return (
    <>
      {/* Page header */}
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

      {/* Specialty tag overview */}
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
        <Tags aria-hidden="true" className="h-4 w-4 shrink-0" />
        Specialty Tag Overview
      </h2>

      {/* Specialty tag metrics */}
      {isLoading ? (
        <MetricCardsSkeleton count={4} />
      ) : (
        <SpecialtyTagMetrics totalTags={statistics.totalTags} />
      )}

      {/* Specialty tag management */}
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
        <List aria-hidden="true" className="h-4 w-4 shrink-0" />
        Specialty Tag Management
      </h2>

      <SpecialtyTagManagementPanel />
    </>
  );
}
