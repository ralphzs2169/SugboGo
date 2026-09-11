import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import useDiscoveryShortcuts from "../../hooks/useDiscoveryShortcuts";

type Props = {
  onShortcutPress?: (clusterId: number) => void;
};

/**
 * Displays discovery shortcuts for explorers who do not have a specific
 * place or specialty in mind.
 *
 * Each shortcut can later open filtered
 * Explore results for the corresponding discovery intent.
 */
export default function DiscoveryShortcutsSection({
  onShortcutPress,
}: Props) {
  const { shortcuts, isLoading, error, refetch } = useDiscoveryShortcuts();

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load Discovery shortcuts",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  if (!isLoading && !error && shortcuts.length === 0) {
    return null;
  }

  return (
    <View className="py-6">
      {/* Section introduction */}
      <View className="mb-4 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Not sure what to explore?
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Start with what you feel like doing.
        </AppText>
      </View>

      {isLoading && (
        <View className="gap-3 px-4">
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              className="h-[72px] rounded-card border border-border-primary bg-background"
            />
          ))}
        </View>
      )}

      {!isLoading && error && (
        <View className="mx-4 rounded-card border border-border-primary bg-surface p-4">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Unable to load Discovery shortcuts
          </AppText>
          <AppText className="mt-1 text-sm text-text-secondary">
            Discovery shortcuts couldn&apos;t be loaded right now.
          </AppText>
          <SafePressable
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading Discovery shortcuts"
            className="mt-3 self-start"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              Retry
            </AppText>
          </SafePressable>
        </View>
      )}

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
            {/* Prompt icon */}
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
              <MaterialCommunityIcons
                name={CLUSTER_ICONS[shortcut.cluster.icon] ?? "store"}
                size={22}
                color={theme.extends.colors.brand}
              />
            </View>

            {/* Prompt details */}
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
