import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

export type Pocket = {
  id: number;
  business_id: number;
  name: string;
  photo_url: string | null;
  category: string;
  location: string;
  saved_at: string;
};

export type PocketListResponse = {
  items: Pocket[];
  pagination: ExploreBusinessPagination;
};
