import { Text, View } from "react-native";

import SpecialtyTagChip from "@/features/merchant/components/registration/specialty-tags/SpecialtyTagChip";

import type { ExploreBusinessSpecialtyTag } from "../../types/exploreBusiness.types";

type Props = {
  specialtyTags: ExploreBusinessSpecialtyTag[];
};

/**
 * Displays the specialties associated with a business.
 *
 * The section currently presents specialties as read-only discovery signals.
 * Vouch counts and the user's vouch state will be added once the Explorer
 * vouch API is available.
 */
export default function BusinessSpecialtiesSection({ specialtyTags }: Props) {
  if (specialtyTags.length === 0) {
    return null;
  }

  return (
    <View className="px-4 pt-6">
      {/* Section heading */}
      <Text className="text-lg font-bold text-text-primary">Specialties</Text>

      {/* Specialty tags */}
      <View className="mt-3 flex-row flex-wrap">
        {specialtyTags.map((tag) => (
          <SpecialtyTagChip key={tag.id} tag={tag} />
        ))}
      </View>

      {/* Future vouch summary */}
      <Text className="mt-1 text-sm text-text-secondary">
        Specialty vouches will appear here
      </Text>
    </View>
  );
}
