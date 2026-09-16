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
};

/**
 * Displays the empty state when no suitable direct jeepney journey is found.
 *
 * Uses the SugboGo no-jeep mascot alongside contextual guidance and a retry
 * action so Explorers can easily repeat the route search.
 */
export default function GettingThereEmptyState({ reason, onRetry }: Props) {
  const content = getNoDirectJourneyContent(reason);

  return (
    <View className="items-center rounded-card border border-border-primary bg-surface px-5 py-7">
      {/* Empty-state mascot */}
      <Image
        source={MASCOT_NO_JEEPS}
        style={{
          width: 140,
          height: 140,
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
        onPress={onRetry}
        variant="soft"
        rounded="full"
        className="mt-5 min-w-36 py-3"
        fontClassName="text-sm"
      />
    </View>
  );
}
