import type { BusinessChangeRequestEligibility } from "./businessChangeRequestEligibility.types";

export type ClassificationChangeStatus =
  "pending" | "approved" | "rejected" | "withdrawn";

export type ClassificationSnapshot = {
  category: { id: number; name: string };
  cluster: { id: number; name: string };
  specialty_tags: { id: number; name: string }[];
};

export type ClassificationChangeRequest = {
  id: number;
  request_type: "classification";
  status: ClassificationChangeStatus;
  previous: ClassificationSnapshot;
  proposed: ClassificationSnapshot;
  submitted_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
  reason: string | null;
};

export type ClassificationChangeRequestPage = {
  items: ClassificationChangeRequest[];
  eligibility: BusinessChangeRequestEligibility;
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
};

export type SubmitClassificationChangePayload = {
  proposed_category_id: number;
  proposed_specialty_tag_ids: number[];
  reason: string;
};
