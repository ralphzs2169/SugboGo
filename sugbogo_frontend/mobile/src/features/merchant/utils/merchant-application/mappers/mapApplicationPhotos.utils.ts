import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import type { ApplicationPhotoResponse } from "@/features/merchant/types/registration/registrationApi.types";
import { inferMimeType } from "@/shared/utils/inferMimeType.utils";

/**
 * Converts saved application photo responses into the business photo
 * structure used by the merchant registration form.
 */
export function mapApplicationPhotos(
  photos: ApplicationPhotoResponse[],
): MerchantRegistrationForm["businessPhotos"] {
  const result: MerchantRegistrationForm["businessPhotos"] = {
    storefront: [],
    interior: [],
    products: [],
    additional: [],
  };

  for (const photo of photos) {
    const mappedPhoto = {
      id: photo.id,
      uri: photo.photo_url,
      fileName: photo.file_name,
      mimeType: inferMimeType(photo.file_name),
    };

    result[photo.category].push(mappedPhoto);
  }

  return result;
}
