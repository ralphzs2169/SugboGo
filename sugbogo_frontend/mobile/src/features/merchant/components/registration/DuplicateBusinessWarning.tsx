import { View } from "react-native";
import { useFormContext, useWatch } from "react-hook-form";
import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";
import useDuplicateWarning from "../../hooks/registration/useDuplicateWarning";
import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";
import type { MerchantRegistrationForm } from "../../validation/merchantRegistration.schema";

/** Shows an advisory check only for the saved name and location currently visible in the form. */
export default function DuplicateBusinessWarning({
  application,
  onReviewLocation,
}: {
  application: ApplicationDetailResponse | null;
  onReviewLocation?: () => void;
}) {
  const { control } = useFormContext<MerchantRegistrationForm>();
  const values = useWatch({
    control,
    name: [
      "businessName",
      "province",
      "city",
      "barangay",
      "streetAddress",
      "unit",
      "latitude",
      "longitude",
    ],
  });
  const identity = application?.identity;
  const location = application?.location;
  const savedValues =
    identity && location
      ? [
          identity.business_name,
          location.province,
          location.city,
          location.barangay,
          location.street_address,
          location.unit || "",
          location.latitude,
          location.longitude,
        ]
      : null;
  const savedEvidence = savedValues ? JSON.stringify(savedValues) : null;
  const matchesSaved = JSON.stringify(values) === savedEvidence;
  if (!savedEvidence || !matchesSaved) return null;
  return (
    <SavedDuplicateWarning
      key={savedEvidence}
      savedEvidence={savedEvidence}
      onReviewLocation={onReviewLocation}
    />
  );
}

/** Keeps request state mounted only while the form still represents this saved evidence. */
function SavedDuplicateWarning({
  savedEvidence,
  onReviewLocation,
}: {
  savedEvidence: string;
  onReviewLocation?: () => void;
}) {
  const query = useDuplicateWarning(savedEvidence, true);
  if (query.isError) {
    return (
      <View className="mb-4">
        <InfoBanner
          title="Duplicate check unavailable"
          actionTitle="Try Again"
          onAction={() => {
            void query.refetch();
          }}
        >
          <AppText className="text-sm leading-5 text-text-secondary">
            We couldn’t check for possible duplicates. You can still continue;
            an administrator will review your application.
          </AppText>
        </InfoBanner>
      </View>
    );
  }
  if (query.isPending || query.isFetching) {
    return (
      <AppText
        accessibilityLiveRegion="polite"
        className="mb-4 text-sm text-text-secondary"
      >
        Checking for possible existing businesses…
      </AppText>
    );
  }
  if (!query.data?.evaluated || !query.data.possible_duplicate) return null;
  return (
    <View accessibilityLiveRegion="polite" className="mb-4">
      {/* Non-blocking saved-location warning */}
      <InfoBanner
        title="Possible existing business"
        variant="warning"
        icon="alert-outline"
        actionTitle={onReviewLocation ? "Review location" : undefined}
        onAction={onReviewLocation}
      >
        <AppText className="text-sm leading-5 text-text-secondary">
          A business with a matching name and location may already be registered
          on SugboGo. Please verify your details. You can still continue if this
          is a separate business or branch.
        </AppText>
      </InfoBanner>
    </View>
  );
}
