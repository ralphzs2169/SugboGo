import { useEffect, useState } from "react";

import { getCategories } from "../../api/registration.service";
import { CategoryOption } from "../../types/merchantRegistration.types";
import { ApiError } from "@/shared/types/apiResponse.types";

export default function useCategories() {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  async function loadCategories() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getCategories();

      if (!response.success) {
        setError(response);
        setCategories([]);
        return;
      }

      setCategories(response.data);
    } catch (error) {
      console.error("Failed to load categories:", error);

      setError({
        success: false,
        message: "Failed to load categories.",
        code: "UNKNOWN_ERROR",
      });

      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  return {
    categories,
    isLoading,
    error,
    refetch: loadCategories,
  };
}
