import Toast from "react-native-toast-message";
import { onlineManager } from "@tanstack/react-query";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import useBusinessVouch from "../../hooks/useBusinessVouch";
import type { ExploreBusinessSpecialtyTag } from "../../types/exploreBusiness.types";
import BusinessSpecialtiesPresentation from "./BusinessSpecialtiesPresentation";

type Props = {
  businessId: number;
  specialtyTags: ExploreBusinessSpecialtyTag[];
  isOwnBusiness: boolean;
  displayAsExplorer?: boolean;
};

/**
 * Displays a compact group of business specialty vouch reactions.
 *
 * Allows Explorers to add or remove specialty vouches while presenting the
 * business's three specialties as a lightweight shared interaction group.
 */
export default function BusinessSpecialtiesSection({
  businessId,
  specialtyTags,
  isOwnBusiness,
  displayAsExplorer = false,
}: Props) {
  const { vouch, pendingTagId } = useBusinessVouch({
    businessId,
  });

  if (specialtyTags.length === 0) {
    return null;
  }

  const handleVouch = async (tag: ExploreBusinessSpecialtyTag) => {
    if (pendingTagId !== null || !onlineManager.isOnline()) {
      return;
    }

    try {
      await vouch({
        tagId: tag.id,
        isVouched: tag.is_vouched,
      });

      Toast.show({
        type: "info",
        text1: tag.is_vouched ? "Vouch removed" : `Vouched for ${tag.name}`,
        visibilityTime: 1500,
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success) {
        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to update vouch",
          text2: response.message || "Something went wrong. Please try again.",
        });
      }
    }
  };

  return (
    <BusinessSpecialtiesPresentation
      tags={specialtyTags}
      disabled={isOwnBusiness || pendingTagId !== null}
      ownerPresentation={isOwnBusiness && !displayAsExplorer}
      onVouch={(tagId) => {
        const tag = specialtyTags.find((item) => item.id === tagId);
        if (tag) void handleVouch(tag);
      }}
    />
  );
}
