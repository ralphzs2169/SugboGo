export const POCKETS_QUERY_KEY = ["pockets"] as const;

/** Separates private collection pages by the authenticated account. */
export function pocketCollectionsQueryKey(userId: number | null) {
  return [...POCKETS_QUERY_KEY, userId, "collections"] as const;
}
