import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
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

const HORIZONTAL_PADDING = 16;
const COLUMN_GAP = 12;
const LOADING_TILE_COUNT = 6;

/**
 * Displays rotating Specialty Tag shortcuts for focused Explorer discovery.
 *
 * The backend selects and orders up to six useful specialties based on active
 * business availability. The section renders that order directly and provides
 * loading, error, empty, and retry behavior without applying client ranking.
 */
export default function ExploreBySpecialtySection({ onSpecialtyPress }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const { specialties, isLoading, error, refetch } = useExploreSpecialties();

  const tileWidth = (screenWidth - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;

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
      <View className="mb-4 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Explore by Specialty
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Browse places by what they&apos;re known for.
        </AppText>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View className="flex-row flex-wrap gap-3 px-4">
          {Array.from({ length: LOADING_TILE_COUNT }).map((_, index) => (
            <View
              key={index}
              style={{
                width: tileWidth,
              }}
              className="min-h-[104px] rounded-card border border-border-primary bg-background"
            />
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
        <View className="flex-row flex-wrap gap-3 px-4">
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
                style={{
                  width: tileWidth,
                }}
                className={`min-h-[104px] justify-between rounded-card border border-border-primary bg-surface p-3.5 active:opacity-80 ${
                  onSpecialtyPress ? "cursor-pointer" : ""
                }`}
                android_ripple={
                  onSpecialtyPress
                    ? {
                        color: `${accentColor}12`,
                      }
                    : undefined
                }
              >
                {/* Specialty identity */}
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${accentColor}18`,
                  }}
                >
                  <MaterialCommunityIcons
                    name={iconName}
                    size={22}
                    color={accentColor}
                  />
                </View>

                {/* Specialty details */}
                <View className="mt-3">
                  <AppText
                    weight="bold"
                    className="text-sm leading-5 text-text-primary"
                    numberOfLines={1}
                  >
                    {specialty.name}
                  </AppText>

                  <AppText className="mt-0.5 text-xs text-text-tertiary">
                    {specialty.business_count}{" "}
                    {specialty.business_count === 1 ? "place" : "places"}
                  </AppText>
                </View>
              </SafePressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
