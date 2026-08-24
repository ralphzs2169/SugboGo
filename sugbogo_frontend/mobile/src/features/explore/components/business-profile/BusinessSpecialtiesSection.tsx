import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { handleSystemError } from "@/shared/utils/apiErrors";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

import useBusinessVouch from "../../hooks/useBusinessVouch";
import type { ExploreBusinessSpecialtyTag } from "../../types/exploreBusiness.types";

type Props = {
  businessId: number;
  specialtyTags: ExploreBusinessSpecialtyTag[];
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
    <View className="px-4 pt-6">
      {/* Section heading */}
      <Text className="text-md font-bold text-text-primary">Specialties</Text>

      {/* Specialty vouch chips */}
      <View className="mt-3 flex-row flex-wrap">
        {specialtyTags.map((tag) => (
          <SpecialtyTagChip
            key={tag.id}
            tag={tag}
            scaleOnPress
            showVouchCount
            count={tag.vouch_count}
            isSelected={tag.is_vouched}
            showCheckIcon
            showDisabledStyle={false}
            isDisabled={pendingTagId === tag.id}
            onPress={() => handleVouch(tag)}
          />
        ))}
      </View>
    </View>
  );
}
