import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import useExploreSpecialties from "../../hooks/useExploreSpecialties";

type Props = {
  onSpecialtyPress?: (specialtyId: number) => void;
};

const LOADING_TILE_COUNT = 6;

/**
 * Displays up to six specialty shortcuts in a compact three-column grid.
 *
 * Each shortcut uses a circular specialty icon with its label underneath,
 * allowing explorers to quickly browse places by what they are known for.
 */
export default function ExploreBySpecialtySection({ onSpecialtyPress }: Props) {
  const { specialties, isLoading, error, refetch } = useExploreSpecialties();

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load specialties",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  if (!isLoading && !error && specialties.length === 0) {
    return null;
  }

  return (
    <View className="py-6">
      {/* Section introduction */}
      <View className="mb-5 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Explore by Specialty
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Browse places by what they&apos;re known for.
        </AppText>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View className="flex-row flex-wrap justify-between gap-y-5 px-4">
          {Array.from({ length: LOADING_TILE_COUNT }).map((_, index) => (
            <View key={index} className="w-[31%] items-center">
              <View className="h-16 w-16 rounded-full bg-background" />

              <View className="mt-2.5 h-3 w-16 rounded-full bg-background" />
            </View>
          ))}
        </View>
      )}

      {/* Persistent error state */}
      {!isLoading && error && (
        <View className="mx-4 rounded-card border border-border-primary bg-surface p-4">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Unable to load specialties
          </AppText>

          <AppText className="mt-1 text-sm text-text-secondary">
            Specialty shortcuts couldn&apos;t be loaded right now.
          </AppText>

          <SafePressable
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading specialties"
            className="mt-3 cursor-pointer self-start"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              Retry
            </AppText>
          </SafePressable>
        </View>
      )}

      {/* Specialty shortcut grid */}
      {!isLoading && !error && (
        <View className="flex-row flex-wrap justify-between gap-y-5 px-4">
          {specialties.map((specialty) => {
            const colorStyles = getSpecialtyTagColor(specialty.color);
            const iconName = getSpecialtyTagIcon(specialty.icon);
            const accentColor = colorStyles.borderColor;

            return (
              <SafePressable
                key={specialty.id}
                onPress={() => onSpecialtyPress?.(specialty.id)}
                disabled={!onSpecialtyPress}
                accessibilityRole={onSpecialtyPress ? "button" : undefined}
                accessibilityLabel={
                  onSpecialtyPress ? `Explore ${specialty.name}` : undefined
                }
                className={`w-[31%] items-center ${
                  onSpecialtyPress ? "cursor-pointer active:opacity-70" : ""
                }`}
              >
                {/* Specialty icon */}
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${accentColor}18`,
                  }}
                >
                  <MaterialCommunityIcons
                    name={iconName}
                    size={27}
                    color={accentColor}
                  />
                </View>

                {/* Specialty label */}
                <AppText
                  weight="semibold"
                  className="mt-2.5 text-center text-xs leading-4 text-text-primary"
                  numberOfLines={2}
                >
                  {specialty.name}
                </AppText>
              </SafePressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
