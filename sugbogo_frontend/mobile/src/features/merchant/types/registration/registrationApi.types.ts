// Step 1: Business Identity Types

export type RepresentativeRole =
  "owner" | "manager" | "authorized_representative" | "other";

export interface ApplicationIdentityPayload {
  business_name: string;
  business_description?: string | null;
  contact_number: string;
  business_email?: string | null;
  website?: string | null;
  representative_name: string;
  representative_role: RepresentativeRole;
  business_cluster_id: number;
  business_category_id: number;
  specialty_tags: number[];
}

export interface ApplicationIdentityResponse {
  business_name: string;
  business_description: string | null;
  contact_number: string;
  business_email: string | null;
  website: string | null;
  representative_name: string;
  representative_role: RepresentativeRole;
  business_cluster_id: number;
  business_cluster_name: string;
  business_category_id: number;
  business_category_name: string;
  specialty_tags: number[];
}

// Step 2: Business Location Types
export interface ApplicationLandmarkPayload {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  source: "google" | "custom";
  place_id?: string | null;
}

export interface ApplicationLocationPayload {
  province: string;
  city: string;
  barangay: string;
  street_address: string;
  unit?: string | null;
  latitude: number;
  longitude: number;
  landmarks?: ApplicationLandmarkPayload[];
}

export interface ApplicationLandmarkResponse {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "google" | "custom";
  place_id: string | null;
}

export interface ApplicationLocationResponse {
  province: string;
  city: string;
  barangay: string;
  street_address: string;
  formatted_address: string;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;
  landmarks: ApplicationLandmarkResponse[];
}

// Step 3: Operating Hours Types

export type OperatingHoursDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ApplicationOperatingHoursPayload {
  hours: {
    day: OperatingHoursDay;
    is_open: boolean;
    is_24_hours: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];
}

export interface ApplicationOperatingHoursResponse {
  day: OperatingHoursDay;
  is_open: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
}

// Step 4: Business Photos Types
export type ApplicationPhotoCategory =
  "storefront" | "interior" | "products" | "additional";

export interface ApplicationPhotoUpload {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface ApplicationPhotoPayload {
  storefront?: ApplicationPhotoUpload[];
  interior?: ApplicationPhotoUpload[];
  products?: ApplicationPhotoUpload[];
  additional?: ApplicationPhotoUpload[];
  deleted_photo_ids?: number[];
}

export interface ApplicationPhotoResponse {
  id: number;
  category: ApplicationPhotoCategory;
  photo_url: string;
  file_name: string | null;
}

// Step 5: Verification Document Types

export type ApplicationDocumentType =
  "business_registration" | "authorization_document" | "additional_documents";

export interface ApplicationDocumentUpload {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface ApplicationDocumentPayload {
  business_registration?: ApplicationDocumentUpload;
  authorization_document?: ApplicationDocumentUpload;
  additional_documents?: ApplicationDocumentUpload[];
  deleted_document_ids?: number[];
}

export interface ApplicationDocumentResponse {
  id: number;
  document_type: ApplicationDocumentType;
  document_url: string;
  file_name: string | null;
}

export type ApplicationFeedbackSection =
  "identity" | "location" | "operating_hours" | "photos" | "documents";

export interface ApplicationFeedbackResponse {
  section: ApplicationFeedbackSection;
  message: string;
}

// Merchant Application Detail Types
export interface ApplicationDetailResponse {
  id: number;
  status: "draft" | "submitted" | "rejected" | "approved";
  highest_completed_step: number;
  submitted_at: string | null;
  reviewed_at: string | null;

  feedback: ApplicationFeedbackResponse[];
  rejection_reason: string | null;

  created_at: string;
  updated_at: string;

  identity: ApplicationIdentityResponse | null;
  location: ApplicationLocationResponse | null;
  operating_hours: ApplicationOperatingHoursResponse[];
  photos: ApplicationPhotoResponse[];
  documents: ApplicationDocumentResponse[];
}
