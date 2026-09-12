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
  const { shortcuts, isLoading, error, refetch } = useDiscoveryShortcuts();
  const [isRetrying, setIsRetrying] = useState(false);

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

  if (!isLoading && !error && shortcuts.length === 0) {
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
      {(isLoading || isRetrying) && <DiscoveryShortcutsSkeleton />}

      {/* Section recovery */}
      {!isLoading && !isRetrying && error && (
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
      {!isLoading && !error && (
        <View className="gap-3 px-4">
          {shortcuts.map((shortcut) => (
            <SafePressable
              key={shortcut.id}
              onPress={() => onShortcutPress?.(shortcut.cluster.id)}
              disabled={!onShortcutPress}
              accessibilityRole={onShortcutPress ? "button" : undefined}
              accessibilityLabel={onShortcutPress ? shortcut.title : undefined}
              className="cursor-pointer flex-row items-center rounded-card border border-border-primary bg-surface px-4 py-3.5 active:opacity-80"
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
                />
              </View>

              {/* Shortcut details */}
              <View className="min-w-0 flex-1 pl-3">
                <AppText
                  weight="semibold"
                  className="text-[15px] text-text-primary"
                  numberOfLines={1}
                >
                  {shortcut.title}
                </AppText>

                <AppText
                  className="mt-0.5 text-xs leading-5 text-text-secondary"
                  numberOfLines={1}
                >
                  {shortcut.subtitle}
                </AppText>
              </View>

              {/* Navigation affordance */}
              <MaterialCommunityIcons
                name="chevron-right"
                size={21}
                color={theme.extends.colors.text.tertiary}
              />
            </SafePressable>
          ))}
        </View>
      )}
    </View>
  );
}
