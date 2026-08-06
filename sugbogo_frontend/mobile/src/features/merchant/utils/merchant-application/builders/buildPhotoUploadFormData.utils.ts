import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type BusinessPhotos = MerchantRegistrationForm["businessPhotos"];

/**
 * Appends newly added photos for a single category.
 */
function appendPhotos(
  formData: FormData,
  category: string,
  photos: BusinessPhotos[keyof BusinessPhotos],
) {
  photos
    .filter((photo) => photo.id === undefined)
    .forEach((photo) => {
      formData.append(category, {
        uri: photo.uri,
        name: photo.fileName ?? `${category}.jpg`,
        type: photo.mimeType ?? "image/jpeg",
      } as any);
    });
}

/**
 * Builds the multipart payload required for uploading
 * business photos.
 */
export function buildPhotoUploadFormData(
  photos: BusinessPhotos,
  deletedPhotoIds: number[],
) {
  const formData = new FormData();

  appendPhotos(formData, "storefront", photos.storefront);
  appendPhotos(formData, "interior", photos.interior);
  appendPhotos(formData, "products", photos.products);
  appendPhotos(formData, "additional", photos.additional);

  // Inform the backend which previously uploaded photos should be removed.
  deletedPhotoIds.forEach((id) => {
    formData.append("deleted_photo_ids", String(id));
  });

  return formData;
}
