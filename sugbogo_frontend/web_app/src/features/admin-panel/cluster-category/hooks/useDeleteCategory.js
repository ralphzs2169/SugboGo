import { useState } from "react";
import { deleteCategory } from "../services/clusterCategoryService";

export default function useDeleteCategory() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(categoryId) {
    setIsDeleting(true);

    try {
      return await deleteCategory(categoryId);
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    remove,
    isDeleting,
  };
}
