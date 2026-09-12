import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

interface InterestFooterProps {
  selectedCount: number;
  isSubmitting: boolean;
  onPress: () => void;
}

/**
 * InterestFooter displays the primary action button for completing
 * the interest selection flow.
 *
 * Zero selections remain valid because onboarding personalization is optional.
 */
export default function InterestFooter({
  selectedCount,
  isSubmitting,
  onPress,
}: InterestFooterProps) {
  return (
    <View className="px-6 pb-8 pt-4">
      {/* Selection progress */}
      <AppText
        testID="interest-selection-progress"
        weight="semibold"
        className="mb-3 text-center text-sm text-text-secondary"
      >
        {selectedCount} / 3 selected
      </AppText>

      {/* Primary onboarding action */}
      <Button
        title="Start Exploring"
        onPress={onPress}
        loading={isSubmitting}
        disabled={isSubmitting}
        rounded="full"
      />
    </View>
  );
}
