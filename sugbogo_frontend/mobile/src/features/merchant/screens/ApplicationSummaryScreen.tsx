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

  const { clusters, isLoading: isLoadingClusters } = useBusinessClusters();

  const { categories, isLoading: isLoadingCategories } =
    useBusinessCategories();

  if (isLoading || isLoadingClusters || isLoadingCategories) {
    return (
      <LoadingScreen
        title="Loading Application"
        description="Fetching your application..."
      />
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorState
          title="Unable to load application"
          description="Please check your internet connection and try again."
          primaryActionTitle="Try Again"
          onPrimaryAction={refetch}
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
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
