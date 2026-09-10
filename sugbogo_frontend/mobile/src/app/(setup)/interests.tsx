import InterestFooter from "@/features/interest-selection/components/InterestFooter";
import InterestGrid from "@/features/interest-selection/components/InterestGrid";
import InterestHeader from "@/features/interest-selection/components/InterestHeader";
import SetupSkipButton from "@/features/interest-selection/components/SetupSkipButton";
import { useCompleteOnboardingInterests } from "@/features/interests/hooks/useInterestMutations";
import useUserInterests from "@/features/interests/hooks/useUserInterests";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/features/auth/store/auth.store";
import Toast from "react-native-toast-message";

const MAX_SELECTIONS = 3;

/** Lets new users optionally choose up to three authoritative specialties. */
export default function Interests() {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const interestsQuery = useUserInterests();
  const completeMutation = useCompleteOnboardingInterests();

  useEffect(() => {
    if (!interestsQuery.error) {
      return;
    }

    const response = interestsQuery.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load interests",
        text2: response.message || "Please try again.",
      });
    }
  }, [interestsQuery.error]);

  const handleCompleteSelection = async (specialtyTagIds = selected) => {
    try {
      await completeMutation.mutateAsync(specialtyTagIds);

      if (user) {
        setUser({
          ...user,
          has_completed_interest_selection: true,
        });
      }

      router.replace("/(explorer)/(tabs)/explore");
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
  };

  const handleToggle = (id: number) => {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }

      if (current.length >= MAX_SELECTIONS) {
        return current;
      }

      return [...current, id];
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-6">
        <SetupSkipButton
          disabled={completeMutation.isPending}
          onPress={() => {
            void handleCompleteSelection([]);
          }}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6 pt-xl"
        showsVerticalScrollIndicator={false}
      >
        <InterestHeader />

        {/* Authoritative specialty options */}
        {interestsQuery.isLoading ? (
          <View testID="onboarding-interests-loading" className="gap-3">
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-11 w-4/5 rounded-full" />
            <Skeleton className="h-11 w-2/3 rounded-full" />
          </View>
        ) : interestsQuery.error ? (
          <ErrorState
            title="Unable to load interests"
            description="We couldn't load specialty options right now."
            primaryActionTitle="Retry"
            onPrimaryAction={() => {
              void interestsQuery.refetch();
            }}
            size="section"
          />
        ) : (
          <InterestGrid
            tags={interestsQuery.data?.available_specialty_tags ?? []}
            selected={selected}
            onToggle={handleToggle}
          />
        )}
      </ScrollView>

      <InterestFooter
        selectedCount={selected.length}
        isSubmitting={completeMutation.isPending}
        onPress={() => {
          void handleCompleteSelection();
        }}
      />
    </SafeAreaView>
  );
}
