import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

/** Private collection metadata separates saved memberships from available listings. */
export type PocketCollection = {
  id: number;
  name: string;
  is_default: boolean;
  business_count: number;
  available_business_count?: number;
  thumbnail_url?: string | null;
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

export type UnavailablePocketBusiness = {
  id: number;
  business_name: string;
  is_pocketed: boolean;
  availability: "unavailable";
  availability_checked_at: string;
};
export type PocketBusiness =
  | UnavailablePocketBusiness
  | (import("@/features/explore/types/exploreBusiness.types").ExploreBusiness & {
      availability?: "available";
      availability_checked_at?: string;
    });
export type PocketBusinessListResponse = {
  items: PocketBusiness[];
  pagination: import("@/features/explore/types/exploreBusiness.types").ExploreBusinessPagination;
};
