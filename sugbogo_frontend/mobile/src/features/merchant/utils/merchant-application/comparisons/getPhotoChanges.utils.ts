import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type BusinessPhotos = MerchantRegistrationForm["businessPhotos"];

type PhotoChanges = {
  hasChanges: boolean;
  deletedPhotoIds: number[];
};

/**
 * Returns true when every photo collection is empty.
 *
 * This prevents a brand-new registration form from being
 * treated as having unsaved photo changes before the user
 * uploads anything.
 */
function isPhotosEmpty(photos: BusinessPhotos): boolean {
  return (
    photos.storefront.length === 0 &&
    photos.interior.length === 0 &&
    photos.products.length === 0 &&
    photos.additional.length === 0
  );
}

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
 *
 * Newly selected photos have no backend ID yet because they
 * have not been uploaded.
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
  /**
   * During a brand-new application, nothing has been saved yet.
   * If the photo collections are still empty, there are no pending changes.
   */
  if (previous === null) {
    return {
      hasChanges: !isPhotosEmpty(current),
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
