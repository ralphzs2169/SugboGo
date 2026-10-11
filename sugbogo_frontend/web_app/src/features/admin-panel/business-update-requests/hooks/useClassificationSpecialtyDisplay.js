import { useQuery } from "@tanstack/react-query";

import { fetchClassificationSpecialtyDisplay } from "../services/classificationUpdateRequestService";

/** Loads missing tag visuals independently from the review detail request. */
export default function useClassificationSpecialtyDisplay(request) {
  const classifications = [
    request?.previous,
    request?.proposed,
    request?.current,
  ];
  const tagIds = [
    ...new Set(
      classifications
        .flatMap((classification) => classification?.specialty_tags ?? [])
        .filter((tag) => tag.id != null && (!tag.color || !tag.icon))
        .map((tag) => tag.id),
    ),
  ].sort((first, second) => Number(first) - Number(second));

  const query = useQuery({
    queryKey: ["admin", "classification-specialty-display", tagIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        tagIds.map((tagId) => fetchClassificationSpecialtyDisplay(tagId)),
      );

      return {
        metadata: Object.fromEntries(
          results.flatMap((result, index) =>
            result.status === "fulfilled"
              ? [[String(tagIds[index]), result.value]]
              : [],
          ),
        ),
        unavailableCount: results.filter(
          (result) => result.status === "rejected",
        ).length,
      };
    },
    enabled: tagIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    metadata: query.data?.metadata ?? {},
    unavailableCount: query.data?.unavailableCount ?? 0,
    refetch: query.refetch,
  };
}
