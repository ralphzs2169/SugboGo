import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import useExploreSpecialties from "../../hooks/useExploreSpecialties";
import ExploreSectionHeader from "../ExploreSectionHeader";
import ExploreBySpecialtySkeleton from "./ExploreBySpecialtySkeleton";

type Props = {
  onSpecialtyPress?: (specialtyId: number) => void;
};

/**
 * Displays specialty shortcuts for quickly narrowing Explore results.
 *
 * The section owns its specialty query states and hides itself when no active
 * specialty shortcuts are available.
 */
export default function ExploreBySpecialtySection({ onSpecialtyPress }: Props) {
  const { specialties, isLoading, error, refetch } = useExploreSpecialties();
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
      {/* Section heading */}
      <ExploreSectionHeader
        title="Explore by Specialty"
        subtitle="Browse places by what they're known for."
      />

      {/* Loading state */}
      {(isLoading || isRetrying) && <ExploreBySpecialtySkeleton />}

      {/* Section recovery */}
      {!isLoading && !isRetrying && error && (
        <ErrorState
          title="Unable to load specialties"
          description="Specialty shortcuts couldn't be loaded right now."
          icon="tag-off-outline"
          primaryActionTitle="Retry"
          onPrimaryAction={() => void handleRetry()}
          size="section"
        />
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
