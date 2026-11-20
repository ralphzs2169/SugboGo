import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { BUSINESS_CHANGED_EVENT } from "../queries/businessResourceEvents";
import { fetchBusinessLocations } from "../services/businessService";

export default function useBusinessMap({
  enabled = true,
  search,
  status,
  cluster,
  category,
  specialtyTag,
} = {}) {
  const params = {
    search,
    status,
    cluster,
    category,
    specialty_tag: specialtyTag,
  };
  const query = useQuery({
    queryKey: ["admin-business-locations", params],
    queryFn: async ({ signal }) => {
      const locations = await fetchBusinessLocations(params, signal);
      return locations ?? [];
    },
    enabled,
    retry: false,
    refetchOnMount: "always",
  });
  const { refetch } = query;

  useEffect(() => {
    if (!enabled) return;

    function refreshLocations() {
      void refetch();
    }

    window.addEventListener(BUSINESS_CHANGED_EVENT, refreshLocations);
    return () => window.removeEventListener(BUSINESS_CHANGED_EVENT, refreshLocations);
  }, [enabled, refetch]);

  return query;
}
