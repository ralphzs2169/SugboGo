import { NormalizedIdentity } from "../normalizers/normalizeIdentity.utils";

/**
 * Determines whether the business identity has changed
 * since the last successful save.
 */
export function hasIdentityChanged(
  previous: NormalizedIdentity | null,
  current: NormalizedIdentity,
): boolean {
  if (previous === null) {
    return true;
  }

  return (
    previous.businessName !== current.businessName ||
    previous.businessDescription !== current.businessDescription ||
    previous.contactNumber !== current.contactNumber ||
    previous.businessEmail !== current.businessEmail ||
    previous.website !== current.website ||
    previous.representativeName !== current.representativeName ||
    previous.representativeRole !== current.representativeRole ||
    previous.businessClusterId !== current.businessClusterId ||
    previous.businessCategoryId !== current.businessCategoryId ||
    previous.specialtyTags.length !== current.specialtyTags.length ||
    previous.specialtyTags.some(
      (id, index) => id !== current.specialtyTags[index],
    )
  );
}
