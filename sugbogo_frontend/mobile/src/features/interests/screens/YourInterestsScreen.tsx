import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { useUpdateUserInterests } from "../hooks/useInterestMutations";
import useUserInterests from "../hooks/useUserInterests";
import type { InterestCategory } from "../types/interest.types";

function toggleId(current: number[], id: number) {
  return current.includes(id)
    ? current.filter((currentId) => currentId !== id)
    : [...current, id];
}

function idsMatch(first: number[], second: number[]) {
  const sortedFirst = [...first].sort((a, b) => a - b);
  const sortedSecond = [...second].sort((a, b) => a - b);

  return (
    sortedFirst.length === sortedSecond.length &&
    sortedFirst.every((id, index) => id === sortedSecond[index])
  );
}

/**
 * Edits the user's durable category and specialty interests.
 *
 * Backend state initializes a local draft, and only the Save action persists
 * changes or invalidates the recommendation query.
 */
export default function YourInterestsScreen() {
  const interestsQuery = useUserInterests();
  const updateMutation = useUpdateUserInterests();
  const initialized = useRef(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [specialtyTagIds, setSpecialtyTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (!interestsQuery.data || initialized.current) {
      return;
    }

    setCategoryIds(
      interestsQuery.data.categories.map((category) => category.id),
    );
    setSpecialtyTagIds(
      interestsQuery.data.specialty_tags.map((tag) => tag.id),
    );
    initialized.current = true;
  }, [interestsQuery.data]);

  useEffect(() => {
    if (!interestsQuery.error) {
      return;
    }

    const response = interestsQuery.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load your interests",
        text2: response.message || "Please try again.",
      });
    }
  }, [interestsQuery.error]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<
      number,
      {
        clusterName: string;
        categories: InterestCategory[];
      }
    >();

    for (const category of interestsQuery.data?.available_categories ?? []) {
      const existing = groups.get(category.cluster.id);

      if (existing) {
        existing.categories.push(category);
      } else {
        groups.set(category.cluster.id, {
          clusterName: category.cluster.name,
          categories: [category],
        });
      }
    }

    return Array.from(groups.entries());
  }, [interestsQuery.data?.available_categories]);

  const hasChanges = interestsQuery.data
    ? !idsMatch(
        categoryIds,
        interestsQuery.data.categories.map((category) => category.id),
      ) ||
      !idsMatch(
        specialtyTagIds,
        interestsQuery.data.specialty_tags.map((tag) => tag.id),
      )
    : false;

  async function handleSave() {
    if (updateMutation.isPending) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        category_ids: categoryIds,
        specialty_tag_ids: specialtyTagIds,
      });

      Toast.show({
        type: "success",
        text1: "Interests updated",
        text2: "Your recommendations will reflect your latest choices.",
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to save interests",
          text2: response.message || "Please try again.",
        });
      }
    }
  }

  if (interestsQuery.isLoading) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background p-5">
        <View testID="your-interests-loading" className="gap-4">
          <Skeleton className="h-5 w-4/5 rounded-md" />
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </View>
      </SafeAreaView>
    );
  }

  if (interestsQuery.error || !interestsQuery.data) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <ErrorState
          title="Unable to load your interests"
          description="We couldn't load your choices right now."
          primaryActionTitle="Retry"
          onPrimaryAction={() => {
            void interestsQuery.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Screen introduction */}
        <AppText className="text-base leading-6 text-text-secondary">
          Personalize what you&apos;d like to discover around Cebu.
        </AppText>

        {/* Category interests grouped by authoritative clusters */}
        <View className="mt-7">
          <AppText
            weight="bold"
            className="text-xs uppercase tracking-wider text-text-secondary"
          >
            Categories
          </AppText>

          {categoryGroups.map(([clusterId, group]) => (
            <View key={clusterId} className="mt-5">
              <AppText weight="bold" className="text-base text-text-primary">
                {group.clusterName}
              </AppText>

              <View className="mt-3 flex-row flex-wrap">
                {group.categories.map((category) => {
                  const isSelected = categoryIds.includes(category.id);

                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => {
                        setCategoryIds((current) => {
                          return toggleId(current, category.id);
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={category.name}
                      accessibilityState={{ selected: isSelected }}
                      className={`mb-2 mr-2 min-h-12 flex-row items-center justify-center rounded-full border px-4 py-2 active:opacity-70 ${
                        isSelected
                          ? "border-brand bg-brand"
                          : "border-border-primary bg-surface"
                      }`}
                    >
                      <AppText
                        weight="semibold"
                        className={
                          isSelected ? "text-white" : "text-text-secondary"
                        }
                      >
                        {category.name}
                      </AppText>

                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={16}
                          color={theme.extends.colors.background}
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Specialty interests with configured taxonomy colors */}
        <View className="mt-8">
          <AppText
            weight="bold"
            className="text-xs uppercase tracking-wider text-text-secondary"
          >
            Specialties
          </AppText>

          <View className="mt-4 flex-row flex-wrap">
            {interestsQuery.data.available_specialty_tags.map((tag) => (
              <SpecialtyTagChip
                key={tag.id}
                tag={tag}
                mode="registration"
                isSelected={specialtyTagIds.includes(tag.id)}
                showSelectionIndicator
                onPress={() => {
                  setSpecialtyTagIds((current) => {
                    return toggleId(current, tag.id);
                  });
                }}
              />
            ))}
          </View>
        </View>

        {/* Explicit save action */}
        <Button
          title="Save Interests"
          onPress={handleSave}
          loading={updateMutation.isPending}
          disabled={!hasChanges || updateMutation.isPending}
          rounded="full"
          className="mb-4 mt-8"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
