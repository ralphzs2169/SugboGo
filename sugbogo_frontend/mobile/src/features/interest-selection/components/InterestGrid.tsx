import { View } from "react-native";

import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

import type { InterestSpecialtyTag } from "@/features/profile/types/interest.types";

interface InterestGridProps {
  tags: InterestSpecialtyTag[];
  selected: number[];
  onToggle: (id: number) => void;
}

const MAX_SELECTIONS = 3;

/** Displays authoritative specialty options using shared selection chips. */
export default function InterestGrid({
  tags,
  selected,
  onToggle,
}: InterestGridProps) {
  return (
    <View className="flex-row flex-wrap">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.id);
        const isDisabled = !isSelected && selected.length >= MAX_SELECTIONS;

        return (
          <SpecialtyTagChip
            key={tag.id}
            tag={tag}
            mode="registration"
            isSelected={isSelected}
            isDisabled={isDisabled}
            showSelectionIndicator
            onPress={() => onToggle(tag.id)}
          />
        );
      })}
    </View>
  );
}
