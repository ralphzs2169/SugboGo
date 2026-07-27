import { useMemo } from "react";

import { MerchantRegistrationStatus } from "../types/merchant.types";
import { portalConfig } from "../utils/portalConfig";
import { MerchantPortalState } from "../types/merchantPortal.types";

/**
 * Returns all state required by the Merchant Portal.
 *
 * This hook will eventually fetch merchant registration
 * data from the backend. For now, it provides mock data
 * for UI development.
 */
export function useMerchantPortalState() {
  const state: MerchantPortalState = {
    registrationStatus: MerchantRegistrationStatus.NONE,
  };

  const config = useMemo(
    () => portalConfig[state.registrationStatus],
    [state.registrationStatus],
  );

  return {
    config,
    ...state,
  };
}
