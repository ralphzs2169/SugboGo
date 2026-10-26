import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");
const MASCOT_NO_FILTER_RESULT = require("@/shared/assets/mascot/mascot-no-filter-result.webp");

type Props = {
  isFiltered: boolean;
  onClearFilters: () => void;
};

/**
 * Distinguishes an empty Community from a valid filtered result with no matches.
 */
export default function CommunityEmptyState({
  isFiltered,
  onClearFilters,
}: Props) {
  return (
    <View
      testID={isFiltered ? "community-filter-empty" : "community-empty"}
      className="items-center px-8 py-10"
    >
      {/* Empty-state illustration */}
      <Image
        source={isFiltered ? MASCOT_NO_FILTER_RESULT : MASCOT_EMPTY_REVIEWS}
        style={{ width: 120, height: 120 }}
        contentFit="contain"
        accessible={false}
      />

      {/* Empty-state guidance */}
      <AppText
        weight="bold"
        className="mt-2 text-center text-md text-text-primary"
      >
        {isFiltered
          ? "No reviews match these filters"
          : "No Community reviews yet"}
      </AppText>

      <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
        {isFiltered
          ? "Try another category or remove the photo filter."
          : "Explorer reviews will appear here as the community grows."}
      </AppText>

      {isFiltered && (
        <Button
          title="Clear filters"
          onPress={onClearFilters}
          variant="soft"
          textTone="primary"
          rounded="full"
          size="sm"
          className="mt-4"
        />
      )}
    </View>
  );
}
