import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { replaceBusinessPocketMemberships } from "../api/pockets.service";
import {
  cancelPocketBusinessReads,
  invalidatePocketBusinessCaches,
  updatePocketBusinessCaches,
} from "../utils/pocketBusinessCache";
import {
  businessPocketMembershipsQueryKey,
  pocketCollectionsQueryKey,
} from "./pocketQueryKeys";

type Submission = {
  businessId: number;
  ownerId: number;
  generation: number;
  pocketIds: number[];
};

function ownsSubmission(submission: Submission) {
  const session = useAuthStore.getState();
  return (
    session.isAuthenticated &&
    !session.isLoading &&
    session.user?.id === submission.ownerId &&
    getAuthSessionGeneration() === submission.generation
  );
}

/** Commits the full set once, applying confirmed flags only to the initiating session. */
export default function useReplacePocketMemberships(businessId: number | null) {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const pending = useRef(false);
  const mutation = useMutation({
    onMutate: async (submission: Submission) => {
      if (!ownsSubmission(submission))
        throw new Error("Your Pocket session changed.");
      await Promise.all([
        cancelPocketBusinessReads(client),
        client.cancelQueries({
          queryKey: businessPocketMembershipsQueryKey(
            submission.ownerId,
            submission.businessId,
          ),
        }),
      ]);
    },
    mutationFn: async (submission: Submission) => {
      if (!ownsSubmission(submission))
        throw new Error("Your Pocket session changed.");
      return throwOnApiError(
        await replaceBusinessPocketMemberships(
          submission.businessId,
          submission.pocketIds,
        ),
      );
    },
    onSuccess: async (data, submission) => {
      if (!ownsSubmission(submission)) return;
      // Reads begun during the PUT must not overwrite the confirmed aggregate state.
      await Promise.all([
        cancelPocketBusinessReads(client),
        client.cancelQueries({
          queryKey: businessPocketMembershipsQueryKey(
            submission.ownerId,
            submission.businessId,
          ),
        }),
      ]);
      if (!ownsSubmission(submission)) return;
      updatePocketBusinessCaches(client, data.business_id, data.is_pocketed);
      client.setQueryData(
        businessPocketMembershipsQueryKey(
          submission.ownerId,
          submission.businessId,
        ),
        data,
      );
    },
    onSettled: async (_data, _error, submission) => {
      // An older session must not cancel fresh reads after the same account signs in again.
      if (ownsSubmission(submission))
        await Promise.all([
          client.cancelQueries({
            queryKey: pocketCollectionsQueryKey(submission.ownerId),
          }),
          client.cancelQueries({
            queryKey: businessPocketMembershipsQueryKey(
              submission.ownerId,
              submission.businessId,
            ),
          }),
        ]);
      const current = ownsSubmission(submission);
      await Promise.all([
        ...(current ? [invalidatePocketBusinessCaches(client)] : []),
        client.invalidateQueries({
          queryKey: pocketCollectionsQueryKey(submission.ownerId),
          refetchType: current ? "active" : "none",
        }),
        client.invalidateQueries({
          queryKey: businessPocketMembershipsQueryKey(
            submission.ownerId,
            submission.businessId,
          ),
          refetchType: current ? "active" : "none",
        }),
      ]);
    },
  });

  async function replaceMemberships(pocketIds: number[]) {
    if (pending.current)
      throw new Error("Your Pocket changes are already saving.");
    const session = useAuthStore.getState();
    if (
      businessId === null ||
      !Number.isSafeInteger(businessId) ||
      businessId <= 0 ||
      userId === null ||
      session.user?.id !== userId ||
      !session.isAuthenticated ||
      session.isLoading
    ) {
      throw new Error("Sign in to manage your Pockets.");
    }
    const submission = {
      businessId,
      ownerId: userId,
      generation: getAuthSessionGeneration(),
      pocketIds: [...pocketIds],
    };
    pending.current = true;
    try {
      const data = await mutation.mutateAsync(submission);
      if (!ownsSubmission(submission))
        throw new Error("Your Pocket session changed.");
      return data;
    } finally {
      pending.current = false;
    }
  }
  return {
    replaceMemberships,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
