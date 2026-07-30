import { useState } from "react";
import { deleteCluster } from "../services/clusterCategoryService";

export default function useDeleteCluster() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(clusterId) {
    setIsDeleting(true);

    try {
      const response = await deleteCluster(clusterId);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors,
      };
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    remove,
    isDeleting,
  };
}
