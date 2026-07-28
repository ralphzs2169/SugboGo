import { useState } from "react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import ClusterPanel from "../cluster-category/components/ClusterPanel";
import CategoryPanel from "../cluster-category/components/CategoryPanel";

export default function ClusterCategoryManagement() {
  useDocumentTitle("Clusters & Categories | SugboGo Admin");

  const [selectedCluster, setSelectedCluster] = useState(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ClusterPanel
          selectedCluster={selectedCluster}
          onSelectCluster={setSelectedCluster}
        />

        <CategoryPanel selectedCluster={selectedCluster} />
      </div>
    </div>
  );
}
