import Toast from "react-native-toast-message";
import { onlineManager } from "@tanstack/react-query";
import { useRef } from "react";

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
  const isSubmitting = useRef(false);

  if (specialtyTags.length === 0) {
    return null;
  }

  const handleVouch = async (tag: ExploreBusinessSpecialtyTag) => {
    if (
      isSubmitting.current ||
      pendingTagId !== null ||
      !onlineManager.isOnline()
    ) {
      return;
    }

    isSubmitting.current = true;

    try {
      const request = vouch({
        tagId: tag.id,
        isVouched: tag.is_vouched,
      });

      Toast.show({
        type: "info",
        text1: tag.is_vouched ? "Vouch removed" : `Vouched for ${tag.name}`,
        visibilityTime: 1500,
      });

      await request;
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
    } finally {
      isSubmitting.current = false;
    }
  };

  return (
    <BusinessSpecialtiesPresentation
      tags={specialtyTags}
      disabled={isOwnBusiness}
      ownerPresentation={isOwnBusiness && !displayAsExplorer}
      onVouch={(tagId) => {
        const tag = specialtyTags.find((item) => item.id === tagId);
        if (tag) void handleVouch(tag);
      }}
    />
  );
}
