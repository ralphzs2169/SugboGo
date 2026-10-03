import type { BusinessPhotoDraft } from "../types/businessPhotoDraft.types";
import type { MerchantBusinessPhoto } from "../types/merchantBusinessProfile.types";

export const BUSINESS_PHOTO_CATEGORIES = [
  "storefront",
  "interior",
  "products",
  "additional",
] as const;

export type BusinessPhotoCategory = (typeof BUSINESS_PHOTO_CATEGORIES)[number];

export const BUSINESS_PHOTO_LIMITS: Record<BusinessPhotoCategory, number> = {
  storefront: 3,
  interior: 5,
  products: 5,
  additional: 5,
};

export type BusinessPhotoDrafts = Record<
  BusinessPhotoCategory,
  BusinessPhotoDraft[]
>;

export function mapBusinessPhotosToDrafts(
  photos: MerchantBusinessPhoto[],
): BusinessPhotoDrafts {
  const drafts: BusinessPhotoDrafts = {
    storefront: [],
    interior: [],
    products: [],
    additional: [],
  };

  for (const photo of photos) {
    drafts[photo.category].push({
      id: photo.id,
      uri: photo.url,
      fileName: photo.file_name,
    });
  }

  return drafts;
}

export function visiblePhotos(
  photos: BusinessPhotoDraft[],
  deletedIds: number[],
) {
  return photos.filter(
    (photo) => photo.id === undefined || !deletedIds.includes(photo.id),
  );
}

export function validateBusinessPhotoDrafts(
  drafts: BusinessPhotoDrafts,
  deletedIds: number[],
): Partial<Record<BusinessPhotoCategory, string>> {
  const errors: Partial<Record<BusinessPhotoCategory, string>> = {};

  for (const category of BUSINESS_PHOTO_CATEGORIES) {
    const count = visiblePhotos(drafts[category], deletedIds).length;
    const limit = BUSINESS_PHOTO_LIMITS[category];

    if (category === "storefront" && count === 0) {
      errors.storefront = "At least one storefront photo is required.";
    } else if (count > limit) {
      errors[category] = `You can only have up to ${limit} ${category} photos.`;
    }
  }

  return errors;
}

export function buildBusinessPhotosFormData(
  drafts: BusinessPhotoDrafts,
  deletedIds: number[],
) {
  const formData = new FormData();

  for (const category of BUSINESS_PHOTO_CATEGORIES) {
    for (const photo of drafts[category]) {
      if (photo.id !== undefined) {
        continue;
      }

      formData.append(category, {
        uri: photo.uri,
        name: photo.fileName ?? `${category}.jpg`,
        type: photo.mimeType ?? "image/jpeg",
      } as any);
    }
  }

  for (const id of deletedIds) {
    formData.append("deleted_photo_ids", String(id));
  }

  return formData;
}
