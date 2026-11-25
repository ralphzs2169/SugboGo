import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";
import type { ItinerarySearchResult } from "../../types/experimentalItinerary.types";

export const RIDE_COLORS = [theme.extends.colors.brand, "#2693FF", "#15803D"];
/** Keep route-leg identity consistent across compact badges and journey connectors. */
export function RouteBadge({
  code,
  index,
  compact = false,
}: {
  code: string;
  index: number;
  compact?: boolean;
}) {
  return (
    <View
      style={{ backgroundColor: RIDE_COLORS[index] }}
      className={compact ? "rounded-md px-2 py-1" : "rounded-xl px-3 py-2"}
    >
      <AppText
        weight="extrabold"
        className={compact ? "text-xs text-white" : "text-sm text-white"}
      >
        {code}
      </AppText>
    </View>
  );
}
/** Use the existing screen back action with a centered, restrained title. */
export function JourneyHeader({ title }: { title: string }) {
  return (
    <View className="h-14 flex-row items-center px-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        className="h-12 w-12 cursor-pointer items-center justify-center"
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={theme.extends.colors.text.primary}
        />
      </Pressable>
      <AppText weight="bold" className="flex-1 text-center text-lg">
        {title}
      </AppText>
      <View className="w-12" />
    </View>
  );
}
/** Describe incomplete alternatives without exposing graph identifiers or work counters. */
export function ItineraryCoverageNotice({
  result,
  compact = false,
}: {
  result: ItinerarySearchResult;
  compact?: boolean;
}) {
  const c = result.coverage;
  const partial =
    result.max_transfers > 0 && (c.variants_outside_graph?.length ?? 0) > 0;
  const messages = [];
  if (partial)
    messages.push(
      compact
        ? "Some routes excluded."
        : "Some routes are not included in this preview.",
    );
  if (c.incomplete_reason === "candidate_budget")
    messages.push(
      compact
        ? "Search ended early."
        : "The search ended early before checking all options.",
    );
  else if (c.incomplete_reason === "connection_budget" && !partial)
    messages.push("The search could not check every connection.");
  if (
    (!compact || !messages.length) &&
    (c.alternatives_unchecked || c.incomplete_reason || partial)
  )
    messages.push(
      compact ? "Limited search coverage." : "More options may be available.",
    );
  if (compact && messages.length)
    messages.push("More routes may be available.");
  return messages.length ? (
    <AppText
      testID="itinerary-search-coverage"
      className={
        compact
          ? "text-xs leading-5 text-text-secondary"
          : "text-center text-xs leading-5 text-text-secondary"
      }
      accessibilityLiveRegion="polite"
    >
      {messages.join(" ")}
    </AppText>
  ) : null;
}
