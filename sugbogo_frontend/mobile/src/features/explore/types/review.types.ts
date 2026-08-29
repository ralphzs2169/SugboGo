import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

export type ReviewPhoto = {
  id: number;
  photo_url: string;
};

export type ReviewAuthor = {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

export type ReviewVouchedSpecialty = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
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
};

export type LocalReviewPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type BusinessReviewPreview = {
  reviews: BusinessReview[];
  total_count: number;
};
