import type { SpecialtyTagOption } from "@/features/merchant/types/registration/registrationOption.types";

export type ExploreBusinessCluster = {
  id: number;
  name: string;
  icon: string;
};

export type ExploreBusinessCategory = {
  id: number;
  name: string;
};

export type ExploreBusinessLocation = {
  address: string;
  city: string;
  province: string;
};

export type ExploreBusiness = {
  id: number;
  business_name: string;
  cover_photo_url: string | null;
  cluster: ExploreBusinessCluster;
  category: ExploreBusinessCategory;
  specialty_tags: SpecialtyTagOption[];
  location: ExploreBusinessLocation;
};

export type ExploreBusinessPagination = {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

export type ExploreBusinessListResponse = {
  items: ExploreBusiness[];
  pagination: ExploreBusinessPagination;
};
