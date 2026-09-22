import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const MASCOT_START_SEARCHING = require("@/shared/assets/mascot/mascot-start-searching.webp");

const MASCOT_EMPTY_SEARCH_RESULTS = require("@/shared/assets/mascot/mascot-empty-search-results.webp");

export type PlaceSearchFeedbackVariant =
  "initial" | "rate-limited" | "error" | "no-results";

type Props = {
  variant: PlaceSearchFeedbackVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
};

/**
 * Displays reusable feedback for place-search experiences.
 *
 * Uses mascot illustrations for discovery and valid empty states while
 * reserving restrained icon-based feedback for technical search failures.
 */
export default function PlaceSearchFeedback({
  variant,
  title,
  description,
  onRetry,
}: Props) {
  if (variant === "initial") {
    return (
      <View className="items-center px-5 py-6">
        {/* Initial search guidance */}
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
          {title ?? "Find a place"}
        </AppText>

        <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
          {description ?? "Search for a place or landmark."}
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
          {title ?? "No matching places"}
        </AppText>

        <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
          {description ?? "Try a different place or landmark name."}
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
        {title ?? (isRateLimited ? "Search paused" : "Unable to search places")}
      </AppText>

      <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
        {description ??
          (isRateLimited
            ? "Please wait a moment before trying again."
            : "Check your connection, then try your search again.")}
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
