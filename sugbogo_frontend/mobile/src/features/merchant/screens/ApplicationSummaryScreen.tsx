import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LoadingScreen from "@/shared/components/LoadingScreen";

import useCurrentApplication from "@/features/merchant/hooks/registration/useCurrentApplication";
import { mapApplicationToForm } from "../utils/merchant-application/mappers/mapApplicationToForm.utils";

import useBusinessCategories from "../hooks/registration/useCategories";
import useBusinessClusters from "../hooks/registration/useClusters";
import useSpecialtyTags from "../hooks/registration/useSpecialtyTags";

import ReviewBusinessIdentity from "@/features/merchant/components/registration/review/sections/ReviewBusinessIdentity";
import ErrorState from "@/shared/components/ErrorState";
import { router } from "expo-router";
import ReviewBusinessLocation from "../components/registration/review/sections/ReviewBusinessLocation";
import ReviewBusinessPhotos from "../components/registration/review/sections/ReviewBusinessPhotos";
import ReviewOperatingHours from "../components/registration/review/sections/ReviewOperatingHours";
import ReviewVerificationDocuments from "../components/registration/review/sections/ReviewVerificationDocuments";

export default function ApplicationSummaryScreen() {
  const { application, isLoading, error, refetch } = useCurrentApplication();

  const {
    clusters,
    isLoading: isLoadingClusters,
    hasData: hasClustersData,
    error: clustersError,
    refetch: refetchClusters,
  } = useBusinessClusters();

  const {
    categories,
    isLoading: isLoadingCategories,
    hasData: hasCategoriesData,
    error: categoriesError,
    refetch: refetchCategories,
  } = useBusinessCategories();

  const {
    isLoading: isLoadingSpecialtyTags,
    hasData: hasSpecialtyTagsData,
    error: specialtyTagsError,
    refetch: refetchSpecialtyTags,
  } = useSpecialtyTags();

  if (
    isLoading ||
    isLoadingClusters ||
    isLoadingCategories ||
    isLoadingSpecialtyTags
  ) {
    return (
      <LoadingScreen
        title="Loading Application"
        description="Fetching your application..."
      />
    );
  }

  if (
    (error && !application) ||
    (clustersError && !hasClustersData) ||
    (categoriesError && !hasCategoriesData) ||
    (specialtyTagsError && !hasSpecialtyTagsData)
  ) {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        edges={["left", "right", "bottom"]}
      >
        <ErrorState
          title="Unable to load application"
          description="Please check your internet connection and try again."
          primaryActionTitle="Try Again"
          onPrimaryAction={() => {
            void Promise.all([
              refetch(),
              refetchClusters(),
              refetchCategories(),
              refetchSpecialtyTags(),
            ]);
          }}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (!application) {
    return null;
  }

  const form = mapApplicationToForm(application);
  const hasBackgroundError = error || clustersError || categoriesError;

  return (
    <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
        }}
      >
        {hasBackgroundError && (
          <ErrorState
            size="section"
            title="Unable to refresh application"
            description="Showing the last available application details."
            primaryActionTitle="Try Again"
            onPrimaryAction={() => {
              void Promise.all([
                refetch(),
                refetchClusters(),
                refetchCategories(),
              ]);
            }}
          />
        )}

        <ReviewBusinessIdentity
          form={form}
          clusters={clusters}
          categories={categories}
        />

        <ReviewBusinessLocation form={form} returnTo="application-summary" />
        <ReviewOperatingHours form={form} />
        <ReviewBusinessPhotos form={form} />
        <ReviewVerificationDocuments form={form} />
      </ScrollView>
    </SafeAreaView>
  );
}
