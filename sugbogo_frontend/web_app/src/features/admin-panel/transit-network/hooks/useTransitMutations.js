import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createRouteVariant,
  createJeepneyRoute,
  createTransitPoint,
  deleteJeepneyRoute,
  deleteRouteVariant,
  deleteTransitPoint,
  updateJeepneyRoute,
  updateRouteVariant,
  updateTransitPoint,
} from "../services/transitNetworkService";
import { transitQueryKeys } from "./transitQueryKeys";

export default function useTransitMutations() {
  const queryClient = useQueryClient();

  async function invalidateRouteQueries(routeId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.routes() }),
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.variants() }),
      routeId
        ? queryClient.invalidateQueries({
            queryKey: transitQueryKeys.routeDetail(routeId),
          })
        : Promise.resolve(),
    ]);
  }

  async function invalidateTransitPointQueries(transitPointId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: transitQueryKeys.transitPoints(),
      }),
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.variants() }),
      transitPointId
        ? queryClient.invalidateQueries({
            queryKey: transitQueryKeys.transitPointDetail(transitPointId),
          })
        : Promise.resolve(),
    ]);
  }

  async function invalidateVariantQueries(routeId, variantId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.routes() }),
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.variants() }),
      routeId
        ? queryClient.invalidateQueries({
            queryKey: transitQueryKeys.routeDetail(routeId),
          })
        : Promise.resolve(),
      variantId
        ? queryClient.invalidateQueries({
            queryKey: transitQueryKeys.variantDetail(variantId),
          })
        : Promise.resolve(),
    ]);
  }

  function refreshAfterRouteDeletion(deletedKey) {
    queryClient.removeQueries({ queryKey: deletedKey, exact: true });
    const keep = ({ queryKey }) =>
      !deletedKey.every((part, index) => queryKey[index] === part);
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: transitQueryKeys.routes(),
        predicate: keep,
      }),
      queryClient.invalidateQueries({
        queryKey: transitQueryKeys.variants(),
        predicate: keep,
      }),
      queryClient.invalidateQueries({
        queryKey: transitQueryKeys.transitPointDetails(),
      }),
    ]);
  }

  const deleteRouteMutation = useMutation({
    mutationFn: deleteJeepneyRoute,
    onSuccess: (_, routeId) =>
      refreshAfterRouteDeletion(transitQueryKeys.routeDetail(routeId)),
  });
  const deleteVariantMutation = useMutation({
    mutationFn: deleteRouteVariant,
    onSuccess: (_, variantId) =>
      refreshAfterRouteDeletion(transitQueryKeys.variantDetail(variantId)),
  });
  const createRouteMutation = useMutation({
    mutationFn: createJeepneyRoute,
    onSuccess: () => invalidateRouteQueries(),
  });
  const updateRouteMutation = useMutation({
    mutationFn: ({ routeId, data }) => updateJeepneyRoute(routeId, data),
    onSuccess: (_, { routeId }) => invalidateRouteQueries(routeId),
  });
  const createVariantMutation = useMutation({
    mutationFn: createRouteVariant,
    onSuccess: (variant) =>
      invalidateVariantQueries(variant.route_id, variant.id),
  });
  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, data }) => updateRouteVariant(variantId, data),
    onSuccess: (variant) =>
      invalidateVariantQueries(variant.route_id, variant.id),
  });
  const createPointMutation = useMutation({
    mutationFn: createTransitPoint,
    onSuccess: () => invalidateTransitPointQueries(),
  });
  const updatePointMutation = useMutation({
    mutationFn: ({ transitPointId, data }) =>
      updateTransitPoint(transitPointId, data),
    onSuccess: (_, { transitPointId }) =>
      invalidateTransitPointQueries(transitPointId),
  });
  const deletePointMutation = useMutation({
    mutationFn: deleteTransitPoint,
    onSuccess: async (_, transitPointId) => {
      await queryClient.cancelQueries({
        queryKey: transitQueryKeys.transitPoints(),
      });
      const keepPoint = (point) => String(point.id) !== String(transitPointId);
      queryClient.setQueriesData(
        { queryKey: [...transitQueryKeys.transitPoints(), "list"] },
        (previous) => {
          if (!previous) return previous;
          const items = previous.items.filter(keepPoint);
          const removed = previous.items.length - items.length;
          if (!removed) return previous;
          const total = Math.max(0, previous.pagination.total_items - removed);
          const pages = Math.ceil(total / previous.pagination.page_size);
          return {
            ...previous,
            items,
            pagination: {
              ...previous.pagination,
              total_items: total,
              total_pages: pages,
              has_next: previous.pagination.page < pages,
            },
          };
        },
      );
      queryClient.setQueryData(
        transitQueryKeys.transitPointReferences(),
        (previous) => previous?.filter(keepPoint),
      );
      queryClient.removeQueries({
        queryKey: transitQueryKeys.transitPointDetail(transitPointId),
        exact: true,
      });
      // The workspace clears its selected ID before refetching active families.
      await Promise.all([
        transitQueryKeys.transitPoints(),
        transitQueryKeys.routes(),
        transitQueryKeys.variants(),
      ].map((queryKey) => queryClient.invalidateQueries({
        queryKey,
        refetchType: "none",
      })));
    },
  });
  return {
    createRoute: createRouteMutation.mutateAsync,
    updateRoute: updateRouteMutation.mutateAsync,
    createVariant: createVariantMutation.mutateAsync,
    updateVariant: updateVariantMutation.mutateAsync,
    createPoint: createPointMutation.mutateAsync,
    updatePoint: updatePointMutation.mutateAsync,
    deleteRoute: deleteRouteMutation.mutateAsync,
    deleteVariant: deleteVariantMutation.mutateAsync,
    deletePoint: deletePointMutation.mutateAsync,
    isCreatingRoute: createRouteMutation.isPending,
    isUpdatingRoute: updateRouteMutation.isPending,
    isCreatingVariant: createVariantMutation.isPending,
    isUpdatingVariant: updateVariantMutation.isPending,
    isCreatingPoint: createPointMutation.isPending,
    isUpdatingPoint: updatePointMutation.isPending,
    isDeletingPoint: deletePointMutation.isPending,
  };
}
