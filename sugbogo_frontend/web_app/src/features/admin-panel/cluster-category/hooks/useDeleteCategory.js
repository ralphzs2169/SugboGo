import { useState } from "react";
import { deleteCategory } from "../services/clusterCategoryService";

export default function useDeleteCategory() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(categoryId) {
    setIsDeleting(true);

    try {
      const response = await deleteCategory(categoryId);

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
