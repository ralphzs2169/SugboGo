import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  confirmTransitTransfer,
  createRouteVariant,
  createJeepneyRoute,
  createTransitPoint,
  createTransitTransfer,
  ignoreTransitTransfer,
  updateJeepneyRoute,
  updateRouteVariant,
  updateTransitPoint,
  updateTransitTransfer,
} from "../services/transitNetworkService";
import { transitQueryKeys } from "./transitQueryKeys";

export default function useTransitMutations() {
  const queryClient = useQueryClient();

  async function invalidateRouteQueries(routeId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.routes() }),
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
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.transfers() }),
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
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.transfers() }),
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

  async function invalidateTransferQueries(transferId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transitQueryKeys.transfers() }),
      transferId
        ? queryClient.invalidateQueries({
            queryKey: transitQueryKeys.transferDetail(transferId),
          })
        : Promise.resolve(),
    ]);
  }

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
  const createTransferMutation = useMutation({
    mutationFn: createTransitTransfer,
    onSuccess: () => invalidateTransferQueries(),
  });
  const updateTransferMutation = useMutation({
    mutationFn: ({ transferId, data }) =>
      updateTransitTransfer(transferId, data),
    onSuccess: (_, { transferId }) => invalidateTransferQueries(transferId),
  });
  const confirmTransferMutation = useMutation({
    mutationFn: confirmTransitTransfer,
    onSuccess: (_, transferId) => invalidateTransferQueries(transferId),
  });
  const ignoreTransferMutation = useMutation({
    mutationFn: ignoreTransitTransfer,
    onSuccess: (_, transferId) => invalidateTransferQueries(transferId),
  });

  return {
    createRoute: createRouteMutation.mutateAsync,
    updateRoute: updateRouteMutation.mutateAsync,
    createVariant: createVariantMutation.mutateAsync,
    updateVariant: updateVariantMutation.mutateAsync,
    createPoint: createPointMutation.mutateAsync,
    updatePoint: updatePointMutation.mutateAsync,
    createTransfer: createTransferMutation.mutateAsync,
    updateTransfer: updateTransferMutation.mutateAsync,
    confirmTransfer: confirmTransferMutation.mutateAsync,
    ignoreTransfer: ignoreTransferMutation.mutateAsync,
    isCreatingRoute: createRouteMutation.isPending,
    isUpdatingRoute: updateRouteMutation.isPending,
    isCreatingVariant: createVariantMutation.isPending,
    isUpdatingVariant: updateVariantMutation.isPending,
    isCreatingPoint: createPointMutation.isPending,
    isUpdatingPoint: updatePointMutation.isPending,
    isCreatingTransfer: createTransferMutation.isPending,
    isUpdatingTransfer: updateTransferMutation.isPending,
    isConfirmingTransfer: confirmTransferMutation.isPending,
    isIgnoringTransfer: ignoreTransferMutation.isPending,
  };
}
