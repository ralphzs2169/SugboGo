import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getUserInterests } from "../../api/interest.service";

export const USER_INTERESTS_QUERY_KEY = ["user-interests"] as const;

/** Loads selected interests and authoritative taxonomy options. */
export default function useUserInterests() {
  return useQuery({
    queryKey: USER_INTERESTS_QUERY_KEY,
    queryFn: async () => {
      const response = await getUserInterests();

      return throwOnApiError(response);
    },
    staleTime: 5 * 60 * 1000,
  });
}
