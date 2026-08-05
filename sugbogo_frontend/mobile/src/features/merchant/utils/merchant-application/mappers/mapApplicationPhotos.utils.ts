import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import type { ApplicationPhotoResponse } from "@/features/merchant/types/merchant-application/applicationApi.types";

/**
 * Converts saved application photo responses into the business photo
 * structure used by the merchant registration form.
 */
export function mapApplicationPhotos(
  photos: ApplicationPhotoResponse[],
): MerchantRegistrationForm["businessPhotos"] {
  return {
    storefront: photos
      .filter((photo) => photo.category === "storefront")
      .map((photo) => ({
        id: photo.id,
        uri: photo.photo_url,
        fileName: photo.file_name,
        mimeType: "image/jpeg",
      })),

    interior: photos
      .filter((photo) => photo.category === "interior")
      .map((photo) => ({
        id: photo.id,
        uri: photo.photo_url,
        fileName: photo.file_name,
        mimeType: "image/jpeg",
      })),

    products: photos
      .filter((photo) => photo.category === "products")
      .map((photo) => ({
        id: photo.id,
        uri: photo.photo_url,
        fileName: photo.file_name,
        mimeType: "image/jpeg",
      })),

    additional: photos
      .filter((photo) => photo.category === "additional")
      .map((photo) => ({
        id: photo.id,
        uri: photo.photo_url,
        fileName: photo.file_name,
        mimeType: "image/jpeg",
      })),
  };
}
