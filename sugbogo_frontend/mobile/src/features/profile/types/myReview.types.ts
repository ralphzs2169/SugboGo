import type { BusinessReview } from "@/features/explore/types/review.types";
import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

/** Private author-history contract; public engagement diagnostics are absent. */
export type MyReview = Pick<
  BusinessReview,
  | "id"
  | "text"
  | "status"
  | "moderation_progress"
  | "created_at"
  | "updated_at"
  | "photos"
  | "author"
  | "reply"
  | "is_own_review"
  | "vouched_specialties"
> & {
  edited_at: string | null;
  show_in_community: boolean;
  business: {
    id: number;
    business_name: string;
    display_cover_photo_url: string | null;
    category: { id: number; name: string };
    status: string;
  };
};

export type MyReviewPage = {
  summary?: {
    total: number;
    published: number;
    under_review: number;
    not_published: number;
  };
  items: MyReview[];
  pagination: ExploreBusinessPagination;
};

export type MyReviewFilter =
  "all" | "published" | "under_review" | "not_published";
export type MyReviewOrdering = "newest" | "oldest";
