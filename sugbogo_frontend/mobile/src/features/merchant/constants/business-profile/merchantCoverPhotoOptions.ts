export type MerchantCoverPhotoAction = "choose_photo" | "take_photo";

export const MERCHANT_COVER_PHOTO_OPTIONS = [
  {
    label: "Choose Photo",
    value: "choose_photo",
    icon: "image-outline",
  },
  {
    label: "Take Photo",
    value: "take_photo",
    icon: "camera-outline",
  },
] satisfies {
  label: string;
  value: MerchantCoverPhotoAction;
  icon: string;
}[];
