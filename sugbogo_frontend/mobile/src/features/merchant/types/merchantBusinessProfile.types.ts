import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

export type MerchantBusinessProfileResponse = {
  business_name: string;
  description: string | null;
  contact_number: string;
  business_email: string | null;
  website: string | null;
  status: "active" | "suspended";
  category: MerchantBusinessClassification;
  cluster: MerchantBusinessClassification;
  specialty_tags: MerchantBusinessSpecialty[];
  location: MerchantBusinessLocation;
  operating_hours: MerchantBusinessOperatingHours[];
  photos: MerchantBusinessPhoto[];
  verification: MerchantBusinessVerification | null;
  cover_photo_url: string | null;
  display_cover_photo_url: string | null;
  cover_photo_retry_after: number | null;
  cover_photo_update: CoverPhotoUpdateAllowance;
  id: number;
};

export type MerchantBusinessInformationUpdate = {
  description?: string;
  contact_number?: string;
  business_email?: string | null;
  website?: string | null;
};

export type MerchantBusinessInformationResponse = {
  description: string | null;
  contact_number: string;
  business_email: string | null;
  website: string | null;
};

export type MerchantBusinessClassification = {
  id: number;
  name: string;
};

export type MerchantBusinessSpecialty = MerchantBusinessClassification &
  SpecialtyTag;

export type MerchantBusinessLandmark = {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: "google" | "custom";
  place_id: string | null;
};

export type MerchantBusinessLocation = {
  address: string;
  city: string;
  province: string;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  landmarks: MerchantBusinessLandmark[];
};

export type MerchantBusinessOperatingHours = {
  day: string;
  is_open: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
};

export type MerchantBusinessOperatingHoursUpdate = {
  hours: {
    day: string;
    is_open: boolean;
    is_24_hours: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];
};

export type MerchantBusinessPhoto = {
  id: number;
  category: "storefront" | "interior" | "products" | "additional";
  url: string;
  file_name: string | null;
};

export type MerchantBusinessDocument = {
  id: number;
  document_type:
    "business_registration" | "authorization_document" | "additional_documents";
  file_name: string | null;
  has_file?: boolean;
};

export type MerchantBusinessVerification = {
  representative_name: string | null;
  representative_role: string | null;
  documents: MerchantBusinessDocument[];
};

export type CoverPhotoUpdateAllowance = {
  limit: number;
  remaining: number;
  resets_at: string | null;
};

export type MerchantCoverPhotoUpdateResponse = {
  cover_photo_url: string | null;
  cover_photo_retry_after: number | null;
  cover_photo_update: CoverPhotoUpdateAllowance;
};
