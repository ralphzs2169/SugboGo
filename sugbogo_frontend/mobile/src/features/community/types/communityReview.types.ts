import type { AvatarKey } from "@/shared/constants/avatars";
import type {
  SpecialtyTagColor,
  SpecialtyTagIcon,
} from "@/shared/types/specialtyTag.types";

export type CommunityReviewOrdering = "newest" | "most_helpful";

export type CommunityReviewFilters = {
  ordering: CommunityReviewOrdering;
  clusterId: number | null;
  hasPhotos: boolean;
};

export const DEFAULT_COMMUNITY_REVIEW_FILTERS: CommunityReviewFilters = {
  ordering: "newest",
  clusterId: null,
  hasPhotos: false,
};

export type CommunityReviewAuthor = {
  id: number;
  first_name: string;
  last_name: string;
  role: "explorer" | "merchant" | "admin" | "super_admin";
  avatar_url: string | null;
  avatar_key: AvatarKey | null;
};

export type CommunityReviewPhoto = {
  id: number;
  photo_url: string;
};

export type CommunityReviewVouchedSpecialty = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
  icon: SpecialtyTagIcon;
};

export type CommunityReviewReply = {
  id: number;
  text: string;
  created_at: string;
  updated_at: string;
  photos: CommunityReviewPhoto[];
};

export type CommunityReviewBusinessCategory = {
  id: number;
  name: string;
};

export type CommunityReviewBusiness = {
  id: number;
  business_name: string;
  display_cover_photo_url: string | null;
  category: CommunityReviewBusinessCategory;
  address: string;
};

export type CommunityReview = {
  id: number;
  text: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  is_liked: boolean;
  is_liked_by_owner: boolean;
  is_own_review: boolean;
  author: CommunityReviewAuthor;
  photos: CommunityReviewPhoto[];
  vouched_specialties: CommunityReviewVouchedSpecialty[];
  reply: CommunityReviewReply | null;
  business: CommunityReviewBusiness;
};

export type CommunityReviewPagination = {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

export type CommunityReviewListResponse = {
  items: CommunityReview[];
  pagination: CommunityReviewPagination;
};
