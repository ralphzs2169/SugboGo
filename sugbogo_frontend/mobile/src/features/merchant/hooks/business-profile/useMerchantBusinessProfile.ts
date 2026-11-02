import { useCallback, useMemo } from "react";
import useMerchantBusinessStatus from "./useMerchantBusinessStatus";
import isTerminalResourceError from "@/shared/utils/isTerminalResourceError";
import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getMerchantBusinessProfile } from "@/features/merchant/api/merchantBusinessProfile.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { merchantBusinessProfileKey } from "./merchantBusinessProfileQueryKeys";

export default function useMerchantBusinessProfile() {
  const statusQuery = useMerchantBusinessStatus();
  const userId = useAuthStore((state) => state.user?.id);

  const query = useQuery({
    queryKey: merchantBusinessProfileKey(userId),
    queryFn: async () => {
      const response = await getMerchantBusinessProfile();

      return throwOnApiError(response);
    },
    enabled: !!userId,
  });

  const { refetch: refetchProfile } = query;
  const { refetch: refetchStatus } = statusQuery;
  const refetch = useCallback(async () => {
    const [profile] = await Promise.all([refetchProfile(), refetchStatus()]);
    return profile;
  }, [refetchProfile, refetchStatus]);

  const business = useMemo(
    () =>
      isTerminalResourceError(query.error)
        ? null
        : query.data
          ? {
              ...query.data,
              // A failed status check cannot authorize editing from an older profile DTO.
              status:
                statusQuery.error || !statusQuery.data
                  ? null
                  : statusQuery.data.status,
            }
          : null,
    [query.data, query.error, statusQuery.data, statusQuery.error],
  );

  return {
    business,
    statusQuery,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}
