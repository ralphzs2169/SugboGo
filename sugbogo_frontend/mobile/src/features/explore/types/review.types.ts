import type {
  SpecialtyTagColor,
  SpecialtyTagIcon,
} from "@/shared/types/specialtyTag.types";
import type { AvatarKey } from "@/shared/constants/avatars";
import type { ExploreBusinessPagination } from "./exploreBusiness.types";

export type ReviewPhoto = {
  id: number;
  photo_url: string;
};

export type ReviewAuthor = {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  avatar_key?: AvatarKey | null;
};

export type ReviewVouchedSpecialty = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
  icon: SpecialtyTagIcon | null;
};

export type ReviewReply = {
  id: number;
  text: string;
  created_at: string;
  updated_at: string;
  photos: ReviewPhoto[];
};

export type BusinessReview = {
  id: number;
  text: string;
  status: string;
  like_count: number;
  report_count: number;
  is_liked: boolean;
  is_liked_by_owner: boolean;
  is_own_review: boolean;
  created_at: string;
  updated_at: string;
  author: ReviewAuthor;
  photos: ReviewPhoto[];
  vouched_specialties: ReviewVouchedSpecialty[];
  reply: ReviewReply | null;
  active_dispute_id: number | null;
};

export type LocalReviewPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type BusinessReviewPreview = {
  reviews: BusinessReview[];
  total_count: number;
  user_review: BusinessReview | null;
};

export type BusinessReviewListResponse = {
  items: BusinessReview[];
  pagination: ExploreBusinessPagination;
};

export type ReviewSentiment = "positive" | "neutral" | "negative";
export type ReviewOrdering = "newest" | "oldest" | "most_liked";

export type BusinessReviewFilters = {
  sentiment: ReviewSentiment | null;
  topic: string | null;
  hasPhotos: boolean;
  merchantReplied: boolean;
  ordering: ReviewOrdering;
};

export const DEFAULT_BUSINESS_REVIEW_FILTERS: BusinessReviewFilters = {
  sentiment: null,
  topic: null,
  hasPhotos: false,
  merchantReplied: false,
  ordering: "newest",
};
