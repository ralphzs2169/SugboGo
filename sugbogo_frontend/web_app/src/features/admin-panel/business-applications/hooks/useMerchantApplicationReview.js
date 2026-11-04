import { useQuery } from "@tanstack/react-query";
import { fetchBusinessApplication } from "../services/businessApplicationService";
import { adminApplicationKeys } from "../queries/applicationQueryKeys";

/** Loads the authoritative application record for administrative review. */
export default function useMerchantApplicationReview(
  applicationId,
  { enabled = true } = {},
) {
  const query = useQuery({
    queryKey: adminApplicationKeys.detail(applicationId),
    queryFn: () => fetchBusinessApplication(applicationId),
    enabled: enabled && Boolean(applicationId),
  });

  return {
    application: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
