import { useState } from "react";
import { createCategory } from "../services/clusterCategoryService";

export default function useCreateCategory() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);
    console.log("Submitting category with values:", values); // Debugging line
    try {
      const data = await createCategory(values);
      console.log("Category created successfully:", data); // Debugging line
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors ?? {},
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
