import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import ErrorState from "@/shared/components/ErrorState";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import InterestCategoriesSection, {
  type InterestCategoryGroup,
} from "../components/your-interests/InterestCategoriesSection";
import InterestsIntroCard from "../components/your-interests/InterestsIntroCard";
import InterestsSaveFooter from "../components/your-interests/InterestsSaveFooter";
import InterestSpecialtiesSection from "../components/your-interests/InterestSpecialtiesSection";
import RecommendationInfoCard from "../components/your-interests/RecommendationInfoCard";
import YourInterestsSection from "../components/your-interests/YourInterestsSection";
import YourInterestsSkeleton from "../components/your-interests/YourInterestsSkeleton";
import useUserInterests from "../hooks/your-interests/useUserInterests";
import { useUpdateUserInterests } from "../hooks/your-interests/useInterestMutations";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";
import { router } from "expo-router";

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
 * Lets explorers manage the interests that help personalize SugboGo.
 *
 * Keeps category and specialty selections local until saved and protects
 * unsaved changes when the user attempts to leave the screen.
 */
export default function YourInterestsScreen() {
  const interestsQuery = useUserInterests();
  const updateMutation = useUpdateUserInterests();

  const initialized = useRef(false);

  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [specialtyTagIds, setSpecialtyTagIds] = useState<number[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!interestsQuery.data || initialized.current) {
      return;
    }

    setCategoryIds(
      interestsQuery.data.categories.map((category) => category.id),
    );

    setSpecialtyTagIds(interestsQuery.data.specialty_tags.map((tag) => tag.id));

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
    const groups = new Map<number, InterestCategoryGroup>();

    for (const category of interestsQuery.data?.available_categories ?? []) {
      const existing = groups.get(category.cluster.id);

      if (existing) {
        existing.categories.push(category);
      } else {
        groups.set(category.cluster.id, {
          clusterName: category.cluster.name,
          clusterIcon: category.cluster.icon,
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

  const {
    showConfirm,
    confirmLeave,
    cancelLeave,
    navigateWithoutConfirmation,
  } = useUnsavedChangesGuard(hasChanges);

  async function handleRetry() {
    setIsRetrying(true);

    try {
      await interestsQuery.refetch();
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleSave() {
    if (updateMutation.isPending) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        category_ids: categoryIds,
        specialty_tag_ids: specialtyTagIds,
      });

      setTimeout(() => {
        Toast.show({
          type: "info",
          text1: "Your interests have been updated",
        });
      }, 1000);

      navigateWithoutConfirmation(() => {
        router.replace("/profile");
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

  if (interestsQuery.isLoading || isRetrying) {
    return <YourInterestsSkeleton />;
  }

  if (interestsQuery.error || !interestsQuery.data) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <ErrorState
          title="Unable to load your interests"
          description="We couldn't load your choices right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void handleRetry()}
          onSecondaryAction={() => {
            navigateWithoutConfirmation(() => {
              router.back();
            });
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Personalization guidance */}
        <YourInterestsSection>
          <InterestsIntroCard />
          <RecommendationInfoCard />
        </YourInterestsSection>

        {/* Category interests */}
        <YourInterestsSection
          title="Categories"
          description="Choose the kinds of places you usually enjoy."
          selectedCount={categoryIds.length}
        >
          <InterestCategoriesSection
            categoryGroups={categoryGroups}
            selectedCategoryIds={categoryIds}
            onToggleCategory={(categoryId) => {
              setCategoryIds((current) => toggleId(current, categoryId));
            }}
          />
        </YourInterestsSection>

        {/* Specialty interests */}
        <YourInterestsSection
          title="Specialties"
          description="Pick the specific things you want to discover more often."
          selectedCount={specialtyTagIds.length}
        >
          <InterestSpecialtiesSection
            availableSpecialtyTags={
              interestsQuery.data.available_specialty_tags
            }
            selectedSpecialtyTagIds={specialtyTagIds}
            onToggleSpecialty={(specialtyTagId) => {
              setSpecialtyTagIds((current) =>
                toggleId(current, specialtyTagId),
              );
            }}
          />
        </YourInterestsSection>
      </ScrollView>

      {/* Persistent save action */}
      <InterestsSaveFooter
        hasChanges={hasChanges}
        isPending={updateMutation.isPending}
        onSave={() => void handleSave()}
      />

      {/* Unsaved changes confirmation */}
      <ConfirmModal
        visible={showConfirm}
        title="Discard changes?"
        message="You have unsaved interest changes. Are you sure you want to leave?"
        confirmText="Discard"
        destructive
        onCancel={cancelLeave}
        onConfirm={confirmLeave}
      />
    </View>
  );
}
