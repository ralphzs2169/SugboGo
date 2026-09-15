import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import type { DirectJourneyNoRouteReason } from "../../types/directJourney.types";
import { getNoDirectJourneyContent } from "../../utils/directJourney.utils";

type Props = {
  reason: DirectJourneyNoRouteReason | null;
  onRetry: () => void;
};

/**
 * Explains a successful direct-route search with no convenient journey.
 */
export default function GettingThereEmptyState({ reason, onRetry }: Props) {
  const content = getNoDirectJourneyContent(reason);

  return (
    <View className="items-center rounded-card border border-border-primary bg-surface px-5 py-8">
      {/* Empty-state identity */}
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand/10">
        <MaterialCommunityIcons
          name="bus-stop-uncovered"
          size={28}
          color={theme.extends.colors.brand}
        />
      </View>

      <AppText
        weight="bold"
        className="mt-4 text-center text-lg text-text-primary"
      >
        {content.title}
      </AppText>

      <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
        {content.description}
      </AppText>

      {/* Search retry */}
      <Button
        title="Check again"
        onPress={onRetry}
        variant="soft"
        rounded="full"
        className="mt-5 min-w-36 py-3"
        fontClassName="text-sm"
      />
    </View>
  );
}
