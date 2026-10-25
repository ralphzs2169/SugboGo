import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import useDiscoveryShortcuts from "../../hooks/useDiscoveryShortcuts";
import ExploreSectionHeader from "../ExploreSectionHeader";
import DiscoveryShortcutsSkeleton from "./DiscoveryShortcutSkeleton";

type Props = {
  onShortcutPress?: (clusterId: number) => void;
};

/**
 * Displays discovery shortcuts for explorers who do not have a specific
 * place or specialty in mind.
 *
 * The section owns its loading and recovery states and hides itself when no
 * active shortcuts are available.
 */
export default function DiscoveryShortcutsSection({ onShortcutPress }: Props) {
  const { shortcuts, isLoading, isPaused, error, refetch } =
    useDiscoveryShortcuts();
  const [isRetrying, setIsRetrying] = useState(false);
  const hasContent = shortcuts.length > 0;
  const showLoading = (isLoading || isRetrying) && !isPaused && !hasContent;

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      await refetch();
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load discovery shortcuts",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  if (!isLoading && !isPaused && !error && shortcuts.length === 0) {
    return null;
  }

  return (
    <View className="py-6">
      {/* Section heading */}
      <ExploreSectionHeader
        title="Not sure what to explore?"
        subtitle="Start with what you feel like doing."
      />

      {/* Loading state */}
      {showLoading && <DiscoveryShortcutsSkeleton />}

      {/* Section recovery */}
      {!showLoading && !hasContent && (error || isPaused) && (
        <ErrorState
          title="Unable to load discovery shortcuts"
          description="Discovery shortcuts couldn't be loaded right now."
          icon="compass-off-outline"
          primaryActionTitle="Retry"
          onPrimaryAction={() => void handleRetry()}
          size="section"
        />
      )}

      {/* Discovery shortcuts */}
      {!showLoading && hasContent && (
        <View className="mx-4 border-y border-border-primary">
          {shortcuts.map((shortcut, index) => (
            <SafePressable
              key={shortcut.id}
              onPress={() => onShortcutPress?.(shortcut.cluster.id)}
              disabled={!onShortcutPress}
              accessibilityRole={onShortcutPress ? "button" : undefined}
              accessibilityLabel={onShortcutPress ? shortcut.title : undefined}
              accessibilityHint={
                onShortcutPress
                  ? `Browse ${shortcut.business_count} ${shortcut.business_count === 1 ? "place" : "places"} in ${shortcut.cluster.name}`
                  : undefined
              }
              accessibilityState={{ disabled: !onShortcutPress }}
              className={`min-h-20 cursor-pointer flex-row items-center bg-surface py-4 active:bg-background ${index > 0 ? "border-t border-border-primary" : ""}`}
              android_ripple={{
                color: "rgba(0,0,0,0.04)",
              }}
            >
              {/* Shortcut icon */}
              <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <MaterialCommunityIcons
                  name={CLUSTER_ICONS[shortcut.cluster.icon] ?? "store"}
                  size={22}
                  color={theme.extends.colors.brand}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>

              {/* Shortcut details */}
              <View className="min-w-0 flex-1 pl-3">
                <AppText
                  weight="semibold"
                  className="text-[15px] text-text-primary"
                  numberOfLines={2}
                >
                  {shortcut.title}
                </AppText>

                {shortcut.subtitle.trim() !== "" && (
                  <AppText
                    className="mt-1 text-sm leading-5 text-text-secondary"
                    numberOfLines={2}
                  >
                    {shortcut.subtitle}
                  </AppText>
                )}

                <AppText className="mt-1.5 text-xs leading-4 text-text-secondary">
                  {shortcut.business_count}{" "}
                  {shortcut.business_count === 1 ? "place" : "places"} to
                  explore
                </AppText>
              </View>

              {/* Navigation affordance */}
              <MaterialCommunityIcons
                name="chevron-right"
                size={21}
                color={theme.extends.colors.text.tertiary}
                style={{ marginLeft: 12 }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </SafePressable>
          ))}
        </View>
      )}
    </View>
  );
}
