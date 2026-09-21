import type { ExploreBusinessLocation } from "../types/exploreBusiness.types";

export type BusinessAddressDisplay = {
  addressLine: string | null;
  cityLine: string | null;
  fullAddress: string | null;
};

/**
 * Builds consistent user-facing address text from a business location.
 */
export function getBusinessAddressDisplay(
  location: ExploreBusinessLocation,
): BusinessAddressDisplay {
  const addressLine = location.address?.trim() || null;

  const cityLine =
    [location.city?.trim(), location.province?.trim()]
      .filter(Boolean)
      .join(", ") || null;

  const fullAddress =
    [addressLine, cityLine].filter(Boolean).join(", ") || null;

  return {
    addressLine,
    cityLine,
    fullAddress,
  };
}
