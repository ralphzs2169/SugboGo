export const POCKETS_QUERY_KEY = ["pockets"] as const;

/** Separates private collection pages by the authenticated account. */
export function pocketCollectionsQueryKey(userId: number | null) {
  return [...POCKETS_QUERY_KEY, userId, "collections"] as const;
}

/** Keeps owned metadata beneath the collection invalidation prefix. */
export function pocketCollectionQueryKey(
  userId: number | null,
  collectionId: number | null,
) {
  return [...pocketCollectionsQueryKey(userId), collectionId] as const;
}

/** Separates paginated contents while retaining collection-prefix invalidation. */
export function pocketCollectionBusinessesQueryKey(
  userId: number | null,
  collectionId: number | null,
) {
  return [
    ...pocketCollectionQueryKey(userId, collectionId),
    "businesses",
  ] as const;
}
