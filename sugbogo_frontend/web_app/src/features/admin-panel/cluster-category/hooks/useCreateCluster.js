import { useState } from "react";
import { createCluster } from "../services/clusterCategoryService";

export default function useCreateCluster() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);

    try {
      const data = await createCluster(values);

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
