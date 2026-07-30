import { useState } from "react";
import { updateCategory } from "../services/clusterCategoryService";

export default function useUpdateCategory() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(categoryId, payload) {
    setIsSubmitting(true);

    try {
      const data = await updateCategory(categoryId, payload);

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Something went wrong.",
        errors: error.response?.data?.errors || {},
      };
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
