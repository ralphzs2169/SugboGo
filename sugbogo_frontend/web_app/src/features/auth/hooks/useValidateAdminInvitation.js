import { useQuery } from "@tanstack/react-query";

import { validateAdminInvitation } from "../api/auth.service";

export function useValidateAdminInvitation(credentials, validationKey) {
  return useQuery({
    queryKey: ["auth", "admin-invitation", "validation", validationKey],
    queryFn: () => validateAdminInvitation(credentials),
    enabled: Boolean(credentials),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}
