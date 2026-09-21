import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import type { DirectJourneyNoRouteReason } from "../../types/directJourney.types";
import { getNoDirectJourneyContent } from "../../utils/directJourney.utils";

const MASCOT_NO_JEEPS = require("@/shared/assets/mascot/mascot-no-jeeps.webp");

type Props = {
  reason: DirectJourneyNoRouteReason | null;
  onRetry: () => void;
  isLoading?: boolean;
};

/**
 * Displays the empty state when no suitable direct jeepney journey is found.
 *
 * Uses the SugboGo no-jeep mascot alongside contextual guidance and a retry
 * action that reflects the current route-search loading state.
 */
export default function GettingThereEmptyState({
  reason,
  onRetry,
  isLoading = false,
}: Props) {
  const content = getNoDirectJourneyContent(reason);

  return (
    <View className="items-center px-5 py-7">
      {/* Empty-state mascot */}
      <Image
        source={MASCOT_NO_JEEPS}
        style={{
          width: 120,
          height: 120,
        }}
        contentFit="contain"
      />

      {/* Empty-state message */}
      <AppText
        weight="bold"
        className="mt-2 text-center text-lg text-text-primary"
      >
        {content.title}
      </AppText>

      <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
        {content.description}
      </AppText>

      {/* Search retry */}
      <Button
        title="Check again"
        accessibilityLabel="Retry route search"
        loading={isLoading}
        onPress={onRetry}
        variant="primary"
        rounded="full"
        className="mt-5 min-w-36 py-3"
        fontClassName="text-sm"
      />
    </View>
  );
}
