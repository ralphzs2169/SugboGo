import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import ClusterCategoryManagementPanel from "../cluster-category/components/ClusterCategoryManagementPanel";

export default function ClusterCategoryManagement() {
  useDocumentTitle("Clusters & Categories | SugboGo Admin");

  return <ClusterCategoryManagementPanel />;
}
