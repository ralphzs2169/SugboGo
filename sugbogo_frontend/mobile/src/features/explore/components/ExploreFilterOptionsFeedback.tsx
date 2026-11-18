import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type useExploreFilterOptions from "../hooks/useExploreFilterOptions";
import ExploreQueryNotice from "./ExploreQueryNotice";

type Props = {
  state: Omit<ReturnType<typeof useExploreFilterOptions>, "refetch"> & {
    refetch: () => Promise<unknown>;
  };
};

/** Distinguishes loading and empty taxonomy from failures without hiding cached options. */
export default function ExploreFilterOptionsFeedback({ state }: Props) {
  if (state.error || state.isPaused) {
    return (
      <ExploreQueryNotice
        message={
          state.hasOptions
            ? "Couldn't refresh filters. Showing previously loaded options."
            : "Filters are unavailable. Please try again."
        }
        retryLabel="Retry loading filters"
        onRetry={state.refetch}
      />
    );
  }
  if (!state.hasOptions && state.isLoading) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading filters"
        className="px-4 py-2"
      >
        <AppText className="text-xs text-text-secondary">
          Loading filters…
        </AppText>
      </View>
    );
  }
  if (
    state.hasOptions &&
    state.options.clusters.length === 0 &&
    state.options.categories.length === 0 &&
    state.options.specialty_tags.length === 0
  ) {
    return (
      <AppText className="px-4 py-2 text-xs text-text-secondary">
        No filters available yet.
      </AppText>
    );
  }
  return null;
}
