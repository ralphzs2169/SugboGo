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
import RegistrationSection from "../RegistrationSection";

type ReviewSubmitStepProps = {
  clusters: ClusterOption[];
  categories: CategoryOption[];
};

export default function ReviewSubmitStep({
  clusters,
  categories,
}: ReviewSubmitStepProps) {
  return (
    <>
      <View className="">
        <RegistrationSection
          icon="check-circle-outline"
          title=" Review Application"
          description=" Review your information before submitting your merchant application."
          showBorder={false}
        >
          <ReviewBusinessIdentity clusters={clusters} categories={categories} />
          <ReviewBusinessLocation />
          <ReviewOperatingHours />
          <ReviewBusinessPhotos />
          <ReviewVerificationDocuments />
        </RegistrationSection>
      </View>
    </>
  );
}
