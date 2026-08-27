import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

export type ExploreBusinessCluster = {
  id: number;
  name: string;
  icon: string;
};

export type ExploreBusinessCategory = {
  id: number;
  name: string;
};

export type ExploreBusinessSpecialtyTag = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
  vouch_count: number;
  is_vouched: boolean;
};

export type ExploreBusinessLocation = {
  address: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
};

export type ExploreBusiness = {
  id: number;
  business_name: string;
  cover_photo_url: string | null;
  is_pocketed: boolean;
  cluster: ExploreBusinessCluster;
  category: ExploreBusinessCategory;
  specialty_tags: ExploreBusinessSpecialtyTag[];
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

export type ExploreBusinessPhoto = {
  id: number;
  photo_url: string;
  category: string;
};

export type ExploreOperatingHours = {
  id: number;
  day: string;
  is_open: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
};

export type ExploreBusinessDetail = ExploreBusiness & {
  description: string | null;
  contact_number: string;
  email: string | null;
  website: string | null;
  photos: ExploreBusinessPhoto[];
  operating_hours: ExploreOperatingHours[];
  is_own_business: boolean;
  has_own_review: boolean;
};
