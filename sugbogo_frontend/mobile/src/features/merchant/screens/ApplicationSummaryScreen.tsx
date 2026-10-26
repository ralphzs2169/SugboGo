import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LoadingScreen from "@/shared/components/LoadingScreen";

import useCurrentApplication from "@/features/merchant/hooks/registration/useCurrentApplication";
import { mapApplicationToForm } from "../utils/merchant-application/mappers/mapApplicationToForm.utils";

import useBusinessCategories from "../hooks/registration/useCategories";
import useBusinessClusters from "../hooks/registration/useClusters";

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
    error: clustersError,
    refetch: refetchClusters,
  } = useBusinessClusters();

  const {
    categories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useBusinessCategories();

  if (isLoading && !application) {
    return (
      <LoadingScreen
        title="Loading Application"
        description="Fetching your application..."
      />
    );
  }

  if (error && !application) {
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
            void refetch();
          }}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        edges={["left", "right", "bottom"]}
      >
        <ErrorState
          icon="file-document-outline"
          title="No submitted application"
          description="There is no submitted application to display."
          primaryActionTitle="Go Back"
          onPrimaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const form = mapApplicationToForm(application);

  return (
    <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
        }}
      >
        {error && (
          <ErrorState
            size="section"
            title="Unable to refresh application"
            description="Showing the last available application details."
            primaryActionTitle="Try Again"
            onPrimaryAction={() => {
              void refetch();
            }}
          />
        )}

        <ReviewBusinessIdentity
          form={form}
          clusters={clusters}
          categories={categories}
          clusterNameFallback={application.identity?.business_cluster_name}
          categoryNameFallback={application.identity?.business_category_name}
          classificationError={Boolean(clustersError || categoriesError)}
          onRetryClassification={() => {
            if (clustersError) {
              void refetchClusters();
            }
            if (categoriesError) {
              void refetchCategories();
            }
          }}
        />

        <ReviewBusinessLocation form={form} returnTo="application-summary" />
        <ReviewOperatingHours form={form} />
        <ReviewBusinessPhotos form={form} />
        <ReviewVerificationDocuments form={form} />
      </ScrollView>
    </SafeAreaView>
  );
}
