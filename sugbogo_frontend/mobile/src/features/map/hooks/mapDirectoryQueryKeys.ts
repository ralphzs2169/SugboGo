export const MAP_DIRECTORY_QUERY_KEY = ["map-discovery-directory"] as const;
export const MAP_DIRECTORY_DATA_QUERY_KEY = [
  ...MAP_DIRECTORY_QUERY_KEY,
  "all",
] as const;
export const MAP_BUSINESS_QUERY_KEY = [
  ...MAP_DIRECTORY_QUERY_KEY,
  "business",
] as const;

export function mapBusinessQueryKey(businessId: number | undefined) {
  return [...MAP_BUSINESS_QUERY_KEY, businessId] as const;
}
