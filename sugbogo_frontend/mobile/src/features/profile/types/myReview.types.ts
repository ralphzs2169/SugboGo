import type { BusinessReview } from "@/features/explore/types/review.types";
import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

/** Private author-history contract; public engagement diagnostics are absent. */
export type MyReview = Pick<
  BusinessReview,
  | "id"
  | "text"
  | "status"
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
  items: MyReview[];
  pagination: ExploreBusinessPagination;
};
