import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type BusinessPhotos = MerchantRegistrationForm["businessPhotos"];

type PhotoChanges = {
  hasChanges: boolean;
  deletedPhotoIds: number[];
};

/**
 * Finds the IDs of photos that existed previously but have since been removed.
 */
function findDeletedPhotoIds(
  previous: { id?: number }[],
  current: { id?: number }[],
): number[] {
  return previous
    .filter(
      (photo) =>
        photo.id !== undefined &&
        !current.some((currentPhoto) => currentPhoto.id === photo.id),
    )
    .map((photo) => photo.id!);
}

/**
 * Returns whether any newly added photos exist.
 */
function hasNewPhotos(photos: BusinessPhotos): boolean {
  return (
    photos.storefront.some((photo) => photo.id === undefined) ||
    photos.interior.some((photo) => photo.id === undefined) ||
    photos.products.some((photo) => photo.id === undefined) ||
    photos.additional.some((photo) => photo.id === undefined)
  );
}

/**
 * Detects additions and deletions since the last successful photo save.
 */
export function getPhotoChanges(
  previous: BusinessPhotos | null,
  current: BusinessPhotos,
): PhotoChanges {
  // Nothing has ever been saved, so upload everything.
  if (previous === null) {
    return {
      hasChanges: true,
      deletedPhotoIds: [],
    };
  }

  const deletedPhotoIds = [
    ...findDeletedPhotoIds(previous.storefront, current.storefront),
    ...findDeletedPhotoIds(previous.interior, current.interior),
    ...findDeletedPhotoIds(previous.products, current.products),
    ...findDeletedPhotoIds(previous.additional, current.additional),
  ];

  const hasChanges = deletedPhotoIds.length > 0 || hasNewPhotos(current);

  return {
    hasChanges,
    deletedPhotoIds,
  };
}
