import { useState } from "react";
import { deleteCluster } from "../services/clusterCategoryService";

export default function useDeleteCluster() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(clusterId) {
    setIsDeleting(true);

    try {
      return await deleteCluster(clusterId);
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    remove,
    isDeleting,
  };
}
