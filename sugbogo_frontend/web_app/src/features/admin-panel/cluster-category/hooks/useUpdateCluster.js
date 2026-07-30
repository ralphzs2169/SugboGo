import { useState } from "react";
import { updateCluster } from "../services/clusterCategoryService";

export default function useUpdateCluster() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(clusterId, payload) {
    setIsSubmitting(true);

    try {
      const data = await updateCluster(clusterId, payload);

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
