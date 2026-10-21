import { useMemo } from "react";

import useCurrentApplication from "./registration/useCurrentApplication";

import { MerchantRegistrationStatus } from "../types/merchant.types";
import { portalConfig } from "../utils/portalConfig.utils";

/**
 * Returns all state required by the Merchant Portal.
 */
export function useMerchantPortalState() {
  const { application, isLoading, error, refetch } = useCurrentApplication();

  const registrationStatus = useMemo(() => {
    if (!application) {
      return MerchantRegistrationStatus.NONE;
    }

    switch (application.status) {
      case "draft":
        return MerchantRegistrationStatus.DRAFT;

      case "submitted":
        return MerchantRegistrationStatus.SUBMITTED;

      case "approved":
        return MerchantRegistrationStatus.APPROVED;

      case "rejected":
        return MerchantRegistrationStatus.REJECTED;

      default:
        return MerchantRegistrationStatus.NONE;
    }
  }, [application]);

  const config = useMemo(() => {
    const current = portalConfig[registrationStatus];
    if (
      registrationStatus !== MerchantRegistrationStatus.REJECTED ||
      !application?.duplicate_disposition
    )
      return current;
    return {
      ...current,
      profileCard: {
        ...current.profileCard,
        title: "Application Rejected",
        description:
          "Review the duplicate registration reason and any required corrections before resubmitting.",
      },
    };
  }, [registrationStatus, application?.duplicate_disposition]);

  return {
    registrationStatus,
    config,
    application,
    isLoading,
    error,
    refetch,
  };
}
