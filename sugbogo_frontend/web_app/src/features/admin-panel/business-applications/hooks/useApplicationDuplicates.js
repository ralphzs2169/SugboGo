import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchApplicationDuplicates,
  saveApplicationDuplicateReview,
} from "../services/businessApplicationService";

/** Keeps duplicate review authoritative and refreshes evidence after stale decisions fail. */
export default function useApplicationDuplicates(applicationId) {
  const client = useQueryClient();
  const key = ["admin", "application-duplicates", applicationId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchApplicationDuplicates(applicationId),
    enabled: !!applicationId,
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (payload) =>
      saveApplicationDuplicateReview(applicationId, payload),
    onSuccess: (state) => {
      client.setQueryData(key, state);
      toast.success("Duplicate assessment saved.");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          "Unable to save. Refresh and review the current evidence.",
      );
      void client.invalidateQueries({ queryKey: key });
    },
  });
  return { query, mutation };
}
