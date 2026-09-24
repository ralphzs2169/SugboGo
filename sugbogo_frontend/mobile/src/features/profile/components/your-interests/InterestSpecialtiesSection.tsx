import { View } from "react-native";

import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { InterestSpecialtyTag } from "@/features/profile/types/interest.types";

type InterestSpecialtiesSectionProps = {
  availableSpecialtyTags: InterestSpecialtyTag[];
  selectedSpecialtyTagIds: number[];
  onToggleSpecialty: (specialtyTagId: number) => void;
};

/**
 * Renders selectable specialty choices and reports selection changes back
 * to the parent screen.
 */
export default function InterestSpecialtiesSection({
  availableSpecialtyTags,
  selectedSpecialtyTagIds,
  onToggleSpecialty,
}: InterestSpecialtiesSectionProps) {
  return (
    <View className="py-4">
      {/* Specialty choices */}
      <View className="flex-row flex-wrap justify-center">
        {availableSpecialtyTags.map((tag) => (
          <SpecialtyTagChip
            key={tag.id}
            tag={tag}
            mode="filter"
            isSelected={selectedSpecialtyTagIds.includes(tag.id)}
            showSelectionIndicator
            onPress={() => onToggleSpecialty(tag.id)}
            showIcon={true}
          />
        ))}
      </View>
    </View>
  );
}
