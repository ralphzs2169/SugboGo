import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

/** Private collection metadata; business counts include only available businesses. */
export type PocketCollection = {
  id: number;
  name: string;
  is_default: boolean;
  business_count: number;
  created_at: string;
  updated_at: string;
};

export type PocketCollectionListResponse = {
  items: PocketCollection[];
  pagination: ExploreBusinessPagination;
};

/** Complete owned selection, independent of collection-list pagination. */
export type BusinessPocketMemberships = {
  business_id: number;
  pocket_ids: number[];
  is_pocketed: boolean;
};
