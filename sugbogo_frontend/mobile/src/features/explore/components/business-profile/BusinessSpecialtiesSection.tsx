import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import BusinessSpecialtyVouchCard from "./BusinessSpecialtyVouchCard";
import useBusinessVouch from "../../hooks/useBusinessVouch";
import type { ExploreBusinessSpecialtyTag } from "../../types/exploreBusiness.types";

type Props = {
  businessId: number;
  specialtyTags: ExploreBusinessSpecialtyTag[];
  isOwnBusiness: boolean;
};

/**
 * Displays the specialties associated with a business and allows explorers
 * to vouch for or remove their vouch from individual specialties.
 *
 * Vouch interactions update optimistically while only the specialty currently
 * being submitted is temporarily disabled.
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
    <View className="px-4 py-6 bg-surface">
      <Text className="text-base font-bold tracking-wide text-text-primary">
        Specialties
      </Text>
      <Text className="mt-1 text-sm text-text-secondary">
        {isOwnBusiness
          ? "What Explorers vouch for at your business"
          : "Vouch for what this place gets right"}
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {specialtyTags.map((tag) => (
          <BusinessSpecialtyVouchCard
            key={tag.id}
            name={tag.name}
            color={tag.color}
            vouchCount={tag.vouch_count}
            isVouched={tag.is_vouched}
            disabled={isOwnBusiness}
            onPress={() => handleVouch(tag)}
          />
        ))}
      </View>
    </View>
  );
}
