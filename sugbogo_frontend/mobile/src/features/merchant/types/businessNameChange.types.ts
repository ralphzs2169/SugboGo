import type { BusinessChangeRequestEligibility } from "./businessChangeRequestEligibility.types";

export type BusinessNameChangeStatus =
  "pending" | "approved" | "rejected" | "withdrawn";

export type BusinessNameChangeRequest = {
  id: number;
  request_type: "business_name";
  previous_business_name: string;
  proposed_business_name: string;
  status: BusinessNameChangeStatus;
  submitted_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
};

export type BusinessNameChangeRequestPage = {
  items: BusinessNameChangeRequest[];
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

export type SubmitBusinessNameChangePayload = {
  proposed_business_name: string;
};
