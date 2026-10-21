import { useQuery } from "@tanstack/react-query";
import { getDuplicateWarning } from "../../api/merchantApplication.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

/** Caches checks by saved evidence; changed form inputs never display an earlier result. */
export default function useDuplicateWarning(
  savedEvidence: string | null,
  matchesSaved: boolean,
) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: [
      ...merchantApplicationKeys.all,
      "duplicate-warning",
      userId,
      savedEvidence,
    ],
    queryFn: async ({ signal }) =>
      throwOnApiError(await getDuplicateWarning(signal)),
    enabled: !!userId && !!savedEvidence && matchesSaved,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
    refetchOnWindowFocus: false,
  });
}
