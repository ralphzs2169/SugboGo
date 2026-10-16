import type {
  ExploreBusinessCategory,
  ExploreBusinessPagination,
  ExploreBusinessSpecialtyTag,
} from "@/features/explore/types/exploreBusiness.types";

export type VouchHistoryOrdering = "newest" | "oldest";

export type VouchHistoryEndorsement = {
  id: number;
  specialty: Pick<
    ExploreBusinessSpecialtyTag,
    "id" | "name" | "color" | "icon"
  >;
  created_at: string;
};

export type VouchHistoryBusiness = {
  id: number;
  business_id: number;
  business_name: string;
  cover_photo_url: string | null;
  category: ExploreBusinessCategory;
  last_vouched_at: string;
  vouches: VouchHistoryEndorsement[];
  specialty_tags: ExploreBusinessSpecialtyTag[];
};

export type VouchHistorySummary = {
  total_businesses: number;
  total_specialty_vouches: number;
};

export type VouchHistoryResponse = {
  items: VouchHistoryBusiness[];
  pagination: ExploreBusinessPagination;
  summary: VouchHistorySummary;
};
