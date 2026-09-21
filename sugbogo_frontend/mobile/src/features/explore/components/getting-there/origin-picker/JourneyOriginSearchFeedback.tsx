import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const MASCOT_START_SEARCHING = require("@/shared/assets/mascot/mascot-start-searching.webp");

const MASCOT_EMPTY_SEARCH_RESULTS = require("@/shared/assets/mascot/mascot-empty-search-results.webp");

type SearchFeedbackVariant =
  "initial" | "rate-limited" | "error" | "no-results";

type Props = {
  variant: SearchFeedbackVariant;
  onRetry?: () => void;
};

/**
 * Displays contextual feedback for journey-origin place searches.
 *
 * Mascot states are reserved for discovery and empty results, while technical
 * failures use restrained status messaging and an optional recovery action.
 */
export default function JourneyOriginSearchFeedback({
  variant,
  onRetry,
}: Props) {
  if (variant === "initial") {
    return (
      <View className="items-center px-5 py-6">
        {/* Initial discovery state */}
        <Image
          source={MASCOT_START_SEARCHING}
          style={{
            width: 120,
            height: 120,
          }}
          contentFit="contain"
        />

        <AppText
          weight="bold"
          className="mt-2 text-center text-lg text-text-primary"
        >
          Find your starting point
        </AppText>

        <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
          Search for a place or landmark to use as your starting point.
        </AppText>
      </View>
    );
  }

  if (variant === "no-results") {
    return (
      <View className="items-center px-5 py-6">
        {/* Empty search results */}
        <Image
          source={MASCOT_EMPTY_SEARCH_RESULTS}
          style={{
            width: 120,
            height: 120,
          }}
          contentFit="contain"
        />

        <AppText
          weight="bold"
          className="mt-2 text-center text-lg text-text-primary"
        >
          No matching places
        </AppText>

        <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
          Try a different place or landmark name.
        </AppText>
      </View>
    );
  }

  const isRateLimited = variant === "rate-limited";

  return (
    <View className="items-center px-5 py-10">
      {/* Technical search status */}
      <MaterialCommunityIcons
        name={isRateLimited ? "timer-sand" : "alert-circle-outline"}
        size={34}
        color={theme.extends.colors.text.tertiary}
      />

      <AppText weight="bold" className="mt-3 text-center text-text-primary">
        {isRateLimited ? "Search paused" : "Unable to search places"}
      </AppText>

      <AppText className="mt-1 text-center text-sm text-text-secondary">
        {isRateLimited
          ? "Please wait a moment before trying again."
          : "Check your connection, then try your search again."}
      </AppText>

      {/* Recovery action */}
      {!isRateLimited && onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try searching again"
          className="mt-4 min-h-11 cursor-pointer justify-center rounded-full border border-brand px-5 active:opacity-70"
        >
          <AppText weight="bold" className="text-brand">
            Try again
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
