import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assertAuthSessionCurrent,
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  cancelEmailChange,
  confirmEmailChange,
  getEmailChangeStatus,
  requestEmailChange,
  type ConfirmEmailChange,
  type RequestEmailChange,
} from "../api/emailChange.service";
import { useAuthStore } from "../store/auth.store";
import { useLogout } from "./useLogout";

/** Restores pending email state and updates only the originating account's cache. */
export function useEmailChange() {
  const user = useAuthStore((state) => state.user);
  const client = useQueryClient();
  const queryKey = ["auth", "email-change", user?.id];
  const status = useQuery({
    queryKey,
    enabled: !!user,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const generation = getAuthSessionGeneration();
      const response = await getEmailChangeStatus();
      assertAuthSessionCurrent(generation);
      return throwOnApiError(response);
    },
  });
  const requestChange = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (payload: RequestEmailChange) => {
      const generation = getAuthSessionGeneration();
      const response = await requestEmailChange(payload);
      assertAuthSessionCurrent(generation);
      const pending = throwOnApiError(response);
      await client.cancelQueries({ queryKey, exact: true });
      assertAuthSessionCurrent(generation);
      client.setQueryData(queryKey, { current_email: user?.email, pending });
      return pending;
    },
  });
  const cancelChange = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const generation = getAuthSessionGeneration();
      const response = await cancelEmailChange();
      assertAuthSessionCurrent(generation);
      throwOnApiError(response);
      await client.cancelQueries({ queryKey, exact: true });
      assertAuthSessionCurrent(generation);
      client.setQueryData(queryKey, {
        current_email: user?.email,
        pending: null,
      });
    },
  });
  return { status, requestChange, cancelChange };
}

/** Confirms an email without clearing a different or newer local login. */
export function useConfirmEmailChange() {
  const { logout } = useLogout();
  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (payload: ConfirmEmailChange) => {
      const generation = getAuthSessionGeneration();
      const ownerId = useAuthStore.getState().user?.id;
      const data = throwOnApiError(await confirmEmailChange(payload));
      if (
        ownerId === data.user_id &&
        isAuthSessionGenerationCurrent(generation)
      ) {
        await logout();
      }
      return data;
    },
  });
}
