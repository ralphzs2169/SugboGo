import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import {
  createPocketCollection,
  renamePocketCollection,
  deletePocketCollection,
  removePocketCollectionBusiness,
} from "../api/pockets.service";
import type { PocketCollection } from "../types/pockets.types";
import {
  deletePocketCollectionWithOffline,
  preparePocketOfflineChange,
  removePocketBusinessWithOffline,
  type PocketOfflineChange,
} from "../services/pocketOfflineMemberships.service";
import {
  cancelPocketBusinessReads,
  invalidatePocketBusinessCaches,
  refreshPocketBusinessCaches,
  updatePocketBusinessCaches,
} from "../utils/pocketBusinessCache";
import {
  POCKETS_QUERY_KEY,
  businessPocketMembershipsQueryKey,
  pocketCollectionQueryKey,
  pocketCollectionsQueryKey,
} from "./pocketQueryKeys";

type Submission<T> = {
  input: T;
  ownerId: number;
  generation: number;
  offline: PocketOfflineChange | null;
};
type CollectionTarget = Pick<PocketCollection, "id" | "is_default">;

function isCurrent<T>({ ownerId, generation }: Submission<T>) {
  const session = useAuthStore.getState();
  return (
    session.isAuthenticated &&
    !session.isLoading &&
    session.user?.id === ownerId &&
    getAuthSessionGeneration() === generation
  );
}

function validId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("Choose a valid Pocket or business.");
}

function customCollection(collection: CollectionTarget) {
  validId(collection.id);
  if (collection.is_default)
    throw new Error("Favorites cannot be renamed or deleted.");
}

/** Shares session protection and settlement across the four owned management writes. */
function useOwnedPocketMutation<TInput, TData>({
  request,
  validate,
  apply,
  changesMemberships = false,
  deletedId,
  offlineRequest,
}: {
  request: (input: TInput) => Promise<ApiResponse<TData>>;
  validate?: (input: TInput) => void;
  apply?: (client: QueryClient, data: TData, ownerId: number) => void;
  changesMemberships?: boolean;
  deletedId?: (input: TInput) => number;
  offlineRequest?: (
    input: TInput,
    change: PocketOfflineChange,
  ) => Promise<ApiResponse<TData>>;
}) {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const pending = useRef(false);
  const prefix = (ownerId: number) =>
    changesMemberships
      ? [...POCKETS_QUERY_KEY, ownerId]
      : pocketCollectionsQueryKey(ownerId);
  const mutation = useMutation({
    onMutate: async (submission: Submission<TInput>) => {
      if (!isCurrent(submission))
        throw new Error("Your Pocket session changed.");
      await Promise.all([
        client.cancelQueries({ queryKey: prefix(submission.ownerId) }),
        ...(changesMemberships ? [cancelPocketBusinessReads(client)] : []),
      ]);
    },
    mutationFn: async (submission: Submission<TInput>) => {
      if (!isCurrent(submission))
        throw new Error("Your Pocket session changed.");
      return throwOnApiError(
        submission.offline && offlineRequest
          ? await offlineRequest(submission.input, submission.offline)
          : await request(submission.input),
      );
    },
    onSuccess: async (data, submission) => {
      if (!isCurrent(submission)) return;
      await Promise.all([
        client.cancelQueries({ queryKey: prefix(submission.ownerId) }),
        ...(changesMemberships ? [cancelPocketBusinessReads(client)] : []),
      ]);
      if (isCurrent(submission)) apply?.(client, data, submission.ownerId);
    },
    onSettled: async (_data, _error, submission) => {
      if (isCurrent(submission))
        await client.cancelQueries({ queryKey: prefix(submission.ownerId) });
      const current = isCurrent(submission);
      const removedId = deletedId?.(submission.input);
      await Promise.all([
        client.invalidateQueries({
          queryKey: prefix(submission.ownerId),
          refetchType: "none",
        }),
        ...(current
          ? [
              client.refetchQueries(
                {
                  queryKey: prefix(submission.ownerId),
                  type: "active",
                  // A deleted detail remains stale until its screen returns to the overview.
                  predicate: (query) =>
                    !(
                      removedId !== undefined &&
                      query.queryKey[2] === "collections" &&
                      query.queryKey[3] === removedId
                    ),
                },
                { cancelRefetch: false },
              ),
            ]
          : []),
        ...(current && changesMemberships
          ? [
              deletedId
                ? refreshPocketBusinessCaches(client)
                : invalidatePocketBusinessCaches(client),
            ]
          : []),
      ]);
    },
  });

  async function submit(input: TInput) {
    if (pending.current)
      throw new Error("Your Pocket changes are already saving.");
    const session = useAuthStore.getState();
    if (
      userId === null ||
      session.user?.id !== userId ||
      !session.isAuthenticated ||
      session.isLoading
    )
      throw new Error("Sign in to manage your Pockets.");
    validate?.(input);
    const submission = {
      input,
      ownerId: userId,
      generation: getAuthSessionGeneration(),
      offline: changesMemberships
        ? preparePocketOfflineChange(userId, getAuthSessionGeneration())
        : null,
    };
    pending.current = true;
    try {
      const data = await mutation.mutateAsync(submission);
      if (!isCurrent(submission))
        throw new Error("Your Pocket session changed.");
      return data;
    } finally {
      pending.current = false;
    }
  }
  return { submit, isPending: mutation.isPending, error: mutation.error };
}

/** Creates server-owned metadata without inserting guesses into paginated lists. */
export function useCreatePocketCollection() {
  const mutation = useOwnedPocketMutation({
    request: createPocketCollection,
    apply: (client, collection, ownerId) =>
      client.setQueryData(
        pocketCollectionQueryKey(ownerId, collection.id),
        collection,
      ),
  });
  return { ...mutation, createCollection: mutation.submit };
}

/** Renames a stable custom collection target while protecting Favorites. */
export function useRenamePocketCollection() {
  const mutation = useOwnedPocketMutation({
    request: (input: { collection: CollectionTarget; name: string }) =>
      renamePocketCollection(input.collection.id, input.name),
    validate: (input) => customCollection(input.collection),
    apply: (client, collection, ownerId) =>
      client.setQueryData(
        pocketCollectionQueryKey(ownerId, collection.id),
        collection,
      ),
  });
  return { ...mutation, renameCollection: mutation.submit };
}

/** Deletes a custom collection and reloads aggregate flags from the backend. */
export function useDeletePocketCollection() {
  const mutation = useOwnedPocketMutation({
    request: (collection: CollectionTarget) =>
      deletePocketCollection(collection.id),
    validate: customCollection,
    changesMemberships: true,
    deletedId: (collection) => collection.id,
    offlineRequest: (collection, change) =>
      deletePocketCollectionWithOffline(change, collection.id),
  });
  return { ...mutation, deleteCollection: mutation.submit };
}

/** Applies the returned aggregate flag when removing exactly one membership. */
export function useRemovePocketBusiness() {
  const mutation = useOwnedPocketMutation({
    request: (input: { collectionId: number; businessId: number }) =>
      removePocketCollectionBusiness(input.collectionId, input.businessId),
    validate: ({ collectionId, businessId }) => {
      validId(collectionId);
      validId(businessId);
    },
    changesMemberships: true,
    offlineRequest: (input, change) =>
      removePocketBusinessWithOffline(
        change,
        input.collectionId,
        input.businessId,
      ),
    apply: (client, memberships, ownerId) => {
      updatePocketBusinessCaches(
        client,
        memberships.business_id,
        memberships.is_pocketed,
      );
      client.setQueryData(
        businessPocketMembershipsQueryKey(ownerId, memberships.business_id),
        memberships,
      );
    },
  });
  return { ...mutation, removeBusiness: mutation.submit };
}
