import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  reactivateUser,
  suspendUser,
} from "../services/userManagementService";
import { userQueryKeys } from "./userQueryKeys";

export default function useUserStatusMutations() {
  const queryClient = useQueryClient();

  async function invalidateUserQueries(userId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.lists(),
      }),
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.detail(userId),
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.historyForUser(userId),
      }),
    ]);
  }

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason }) => suspendUser(userId, reason),
    onSuccess: (_, { userId }) => invalidateUserQueries(userId),
  });

  const reactivateMutation = useMutation({
    mutationFn: ({ userId }) => reactivateUser(userId),
    onSuccess: (_, { userId }) => invalidateUserQueries(userId),
  });

  return {
    suspend: suspendMutation.mutateAsync,
    reactivate: reactivateMutation.mutateAsync,
    isSuspending: suspendMutation.isPending,
    isReactivating: reactivateMutation.isPending,
    suspendError: suspendMutation.error,
    reactivateError: reactivateMutation.error,
  };
}
