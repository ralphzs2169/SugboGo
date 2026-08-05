import { ApplicationIdentityPayload } from "../../../types/merchant-application/applicationApi.types";
import { normalizeOptionalText } from "../normalizeOptionalText.utils";

/**
 * Compares two arrays of numeric IDs without considering order.
 */
function areIdSetsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);

  return sortedA.every((value, index) => value === sortedB[index]);
}

/**
 * Determines whether the business identity payload has changed
 * since the last successful save.
 */
export function hasIdentityChanged(
  previous: ApplicationIdentityPayload | null,
  current: ApplicationIdentityPayload,
): boolean {
  // Nothing has ever been saved, so we must save.
  if (previous === null) {
    return true;
  }

  return (
    previous.business_name !== current.business_name ||
    normalizeOptionalText(previous.business_description) !==
      normalizeOptionalText(current.business_description) ||
    previous.contact_number !== current.contact_number ||
    normalizeOptionalText(previous.business_email) !==
      normalizeOptionalText(current.business_email) ||
    normalizeOptionalText(previous.website) !==
      normalizeOptionalText(current.website) ||
    previous.representative_name !== current.representative_name ||
    previous.representative_role !== current.representative_role ||
    previous.business_cluster_id !== current.business_cluster_id ||
    previous.business_category_id !== current.business_category_id ||
    !areIdSetsEqual(previous.specialty_tags, current.specialty_tags)
  );
}
