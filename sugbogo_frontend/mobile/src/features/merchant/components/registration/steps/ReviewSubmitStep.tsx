import { View, Text } from "react-native";

import { useFormContext } from "react-hook-form";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import type {
  ClusterOption,
  CategoryOption,
} from "@/features/merchant/types/merchantRegistration.types";

import ReviewBusinessIdentity from "../review/sections/ReviewBusinessIdentity";
import ReviewBusinessLocation from "../review/sections/ReviewBusinessLocation";
import ReviewOperatingHours from "../review/sections/ReviewOperatingHours";
import ReviewBusinessPhotos from "../review/sections/ReviewBusinessPhotos";
import ReviewVerificationDocuments from "../review/sections/ReviewVerificationDocuments";
import ReviewSection from "../review/ReviewSection";

type ReviewSubmitStepProps = {
  clusters: ClusterOption[];
  categories: CategoryOption[];
  onEditSection: (step: number) => void;
};

export default function ReviewSubmitStep({
  clusters,
  categories,
  onEditSection,
}: ReviewSubmitStepProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();
  const form = watch();
  return (
    <>
      <View className="">
        <ReviewSection
          icon="check-circle-outline"
          title="Review Your Application"
          description="Check your information before submitting your application."
          isPageHeader
          showBorder={false}
        />
        {/* <View className="px-6 pb-5 pt-2">
          <Text className="text-2xl font-bold text-text-primary">
            Review Your Application
          </Text>

          <Text className="mt-1 text-sm leading-5 text-text-secondary">
            Check your information before submitting your application.
          </Text>
        </View> */}
        <ReviewBusinessIdentity
          form={form}
          clusters={clusters}
          categories={categories}
          onEdit={() => onEditSection(1)}
        />

        <ReviewBusinessLocation
          form={form}
          onEdit={() => onEditSection(2)}
          returnTo="registration-review"
        />

        <ReviewOperatingHours form={form} onEdit={() => onEditSection(3)} />
        <ReviewBusinessPhotos form={form} onEdit={() => onEditSection(4)} />
        <ReviewVerificationDocuments
          form={form}
          onEdit={() => onEditSection(5)}
        />
      </View>
    </>
  );
}
