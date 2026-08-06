import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LoadingScreen from "@/shared/components/LoadingScreen";

import useCurrentApplication from "@/features/merchant/hooks/registration/useCurrentApplication";
import { mapApplicationToForm } from "../utils/merchant-application/mappers/mapApplicationToForm.utils";

import useBusinessClusters from "../hooks/registration/useClusters";
import useBusinessCategories from "../hooks/registration/useCategories";

import ReviewBusinessIdentity from "@/features/merchant/components/registration/review/sections/ReviewBusinessIdentity";
import ReviewBusinessLocation from "../components/registration/review/sections/ReviewBusinessLocation";
import ReviewOperatingHours from "../components/registration/review/sections/ReviewOperatingHours";
import ReviewBusinessPhotos from "../components/registration/review/sections/ReviewBusinessPhotos";
import ReviewVerificationDocuments from "../components/registration/review/sections/ReviewVerificationDocuments";

export default function ApplicationSummaryScreen() {
  const { application, isLoading, error } = useCurrentApplication();

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

  if (!application || error) {
    return null;
  }

  const form = mapApplicationToForm(application);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        <ReviewBusinessIdentity
          form={mapApplicationToForm(application)}
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
