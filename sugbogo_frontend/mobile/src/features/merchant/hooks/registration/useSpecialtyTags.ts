import { useEffect, useState } from "react";

import { getSpecialtyTags } from "../../api/merchantApplication.service";
import { SpecialtyTagOption } from "../../types/merchantRegistration.types";
import { ApiError } from "@/shared/types/apiResponse.types";

export default function useSpecialtyTags() {
  const [specialtyTags, setSpecialtyTags] = useState<SpecialtyTagOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  async function loadSpecialtyTags() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getSpecialtyTags();

      if (!response.success) {
        setError(response);
        setSpecialtyTags([]);
        return;
      }

      setSpecialtyTags(response.data);
    } catch (error) {
      console.error("Failed to load specialty tags:", error);

      setError({
        success: false,
        message: "Failed to load specialty tags.",
        code: "UNKNOWN_ERROR",
      });

      setSpecialtyTags([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSpecialtyTags();
  }, []);

  return {
    specialtyTags,
    isLoading,
    error,
    refetch: loadSpecialtyTags,
  };
}
