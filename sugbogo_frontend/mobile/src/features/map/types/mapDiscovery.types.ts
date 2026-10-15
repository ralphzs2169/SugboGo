import type {
  ExploreBusinessCategory,
  ExploreBusinessCluster,
  ExploreBusinessLocation,
  ExploreBusinessPagination,
} from "@/features/explore/types/exploreBusiness.types";
import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapDiscoveryFilters = {
  clusterId: number | null;
  categoryIds: number[];
  specialtyTagId: number | null;
  hiddenGems: boolean;
  openNow: boolean;
  businessId?: number;
};

export const DEFAULT_MAP_FILTERS: MapDiscoveryFilters = {
  clusterId: null,
  categoryIds: [],
  specialtyTagId: null,
  hiddenGems: false,
  openNow: false,
};

export type MapDiscoveryBusiness = {
  id: number;
  business_name: string;
  cover_photo_url: string | null;
  display_cover_photo_url: string | null;
  cluster: ExploreBusinessCluster;
  category: ExploreBusinessCategory;
  location: ExploreBusinessLocation;
  specialty_tags: {
    id: number;
    name: string;
    color: SpecialtyTagColor;
    icon: string | null;
  }[];
  is_hidden_gem: boolean;
};

export type MapDiscoveryResponse = {
  items: MapDiscoveryBusiness[];
  pagination: ExploreBusinessPagination;
};
