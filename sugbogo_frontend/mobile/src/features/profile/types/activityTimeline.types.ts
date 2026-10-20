import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";
import type { MyReview } from "./myReview.types";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

export type ActivityFilter = "all" | "saves" | "vouches" | "reviews";

type ActivityBase = {
  id: string;
  source_id: number;
  occurred_at: string;
  business: {
    id: number;
    business_name: string;
    status: string;
    display_cover_photo_url: string | null;
  };
};

export type TimelineActivity = ActivityBase &
  (
    | { type: "save"; specialty: null; review: null }
    | {
        type: "vouch";
        specialty: SpecialtyTag & { id: number };
        review: null;
      }
    | {
        type: "review";
        specialty: null;
        review: {
          id: number;
          excerpt: string;
          status: MyReview["status"];
          edited_at: string | null;
        };
      }
  );

export type ActivityTimelinePage = {
  items: TimelineActivity[];
  pagination: ExploreBusinessPagination;
};
