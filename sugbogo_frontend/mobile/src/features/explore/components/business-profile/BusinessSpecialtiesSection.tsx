import { View } from "react-native";
import Toast from "react-native-toast-message";

import AppText from "@/shared/components/AppText";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import useBusinessVouch from "../../hooks/useBusinessVouch";
import type { ExploreBusinessSpecialtyTag } from "../../types/exploreBusiness.types";
import BusinessSpecialtyVouchCard from "./BusinessSpecialtyVouchCard";

type Props = {
  businessId: number;
  specialtyTags: ExploreBusinessSpecialtyTag[];
  isOwnBusiness: boolean;
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
}: Props) {
  const { vouch, pendingTagId } = useBusinessVouch({
    businessId,
  });

  if (specialtyTags.length === 0) {
    return null;
  }

  const handleVouch = async (tag: ExploreBusinessSpecialtyTag) => {
    if (pendingTagId !== null) {
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
    <View className="bg-surface px-4 py-4">
      {/* Section heading */}
      <AppText weight="bold" className="text-base text-text-primary">
        Specialties
      </AppText>

      <AppText className="mt-0.5 text-xs text-text-secondary">
        {isOwnBusiness
          ? "What Explorers vouch for at your business"
          : "What does this place get right?"}
      </AppText>

      {/* Specialty reactions */}
      <View className="mt-3 rounded-xl bg-background px-1 py-2">
        <View className="flex-row items-start">
          {specialtyTags.map((tag) => (
            <BusinessSpecialtyVouchCard
              key={tag.id}
              name={tag.name}
              color={tag.color}
              icon={tag.icon}
              vouchCount={tag.vouch_count}
              isVouched={tag.is_vouched}
              disabled={isOwnBusiness}
              onPress={() => handleVouch(tag)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
