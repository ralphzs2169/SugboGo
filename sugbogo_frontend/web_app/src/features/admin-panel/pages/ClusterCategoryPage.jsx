import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import ClusterCategoryManagementPanel from "../cluster-category/components/ClusterCategoryManagementPanel";
import PageHeader from "../components/PageHeader";

export default function ClusterCategoryPage() {
  useDocumentTitle("Clusters & Categories | SugboGo Admin");

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
            label: "Clusters & Categories",
          },
        ]}
        title="Cluster Management"
      />
      <ClusterCategoryManagementPanel />
    </>
  );
}
