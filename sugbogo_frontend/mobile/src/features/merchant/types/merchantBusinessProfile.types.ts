export type MerchantBusinessProfileResponse = {
  business_name: string;
  cover_photo_url: string | null;
  cover_photo_retry_after: number | null;
  cover_photo_update: CoverPhotoUpdateAllowance;
  id: number;
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
