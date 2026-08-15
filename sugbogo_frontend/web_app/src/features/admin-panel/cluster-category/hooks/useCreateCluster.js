import { useState } from "react";

import { createCluster } from "../services/clusterCategoryService";

export default function useCreateCluster() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);

    try {
      return await createCluster(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
