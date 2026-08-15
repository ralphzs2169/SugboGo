import { useState } from "react";
import { updateCluster } from "../services/clusterCategoryService";

export default function useUpdateCluster() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(clusterId, payload) {
    setIsSubmitting(true);

    try {
      return await updateCluster(clusterId, payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
