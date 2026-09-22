import { ActivityIndicator, View } from "react-native";
import type { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

import type {
  ClusterOption,
  CategoryOption,
} from "@/features/merchant/types/registration/registrationOption.types";

import useSpecialtyTags from "@/features/merchant/hooks/registration/useSpecialtyTags";
import ReviewSection from "../ReviewSection";
import ReviewRow from "../ReviewRow";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";
import ReviewSectionFeedback from "../ReviewSectionFeedback";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import FormFieldApiError from "@/shared/components/form/FormFieldApiError";
import AppText from "@/shared/components/AppText";

type ReviewForm = z.input<typeof merchantRegistrationSchema>;
type ReviewBusinessIdentityProps = {
  form: ReviewForm;
  clusters: ClusterOption[];
  categories: CategoryOption[];
  onEdit?: () => void;
  feedback?: ApplicationFeedbackResponse;
};

const REPRESENTATIVE_ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  authorized_representative: "Authorized Representative",
  other: "Other",
} as const;

export default function ReviewBusinessIdentity({
  form,
  clusters,
  categories,
  onEdit,
  feedback,
}: ReviewBusinessIdentityProps) {
  const {
    specialtyTags,
    isLoading: isLoadingSpecialtyTags,
    hasData: hasSpecialtyTagsData,
    error: specialtyTagsError,
    refetch: refetchSpecialtyTags,
  } = useSpecialtyTags();

  const selectedCluster = clusters.find(
    (cluster) => cluster.id.toString() === form.businessCluster,
  );

  const clusterName = selectedCluster?.name ?? "Not provided";
  const clusterIcon = selectedCluster
    ? CLUSTER_ICONS[selectedCluster.icon]
    : undefined;

  const categoryName =
    categories.find(
      (category) => category.id.toString() === form.businessCategory,
    )?.name ?? "Not provided";

  const selectedSpecialtyTags = specialtyTags.filter((tag) =>
    form.specialtyTags.includes(tag.id),
  );

  return (
    <ReviewSection
      icon="store-outline"
      title="Business Identity"
      onEdit={onEdit}
    >
      <View className="w-full">
        <ReviewSectionFeedback feedback={feedback} />
        <ReviewRow
          label="Business Name"
          value={form.businessName}
          valueClassName="text-2xl font-bold text-brand"
        />
      </View>

      <View className="flex-row flex-wrap">
        <View className="w-1/2 pr-2">
          <AppText
            weight="semibold"
            className="mb-1 text-sm text-text-secondary"
          >
            Business Cluster
          </AppText>

          <View className="flex-row items-center">
            {clusterIcon && (
              <MaterialCommunityIcons
                name={clusterIcon}
                size={17}
                color={theme.extends.colors.text.primary}
              />
            )}

            <AppText className="ml-1 flex-1 text-base text-text-primary">
              {clusterName}
            </AppText>
          </View>
        </View>

        <View className="w-1/2 pl-2">
          <ReviewRow label="Business Category" value={categoryName} />
        </View>

        <View className="w-1/2 pr-2">
          <ReviewRow
            label="Representative Name"
            value={form.representativeName}
          />
        </View>

        <View className="w-1/2 pl-2">
          <ReviewRow
            label="Representative Role"
            value={
              form.representativeRole
                ? REPRESENTATIVE_ROLE_LABELS[form.representativeRole]
                : "Not provided"
            }
          />
        </View>

        <View className="w-full">
          <ReviewRow
            label="Business Description"
            value={form.businessDescription}
          />
        </View>

        <View className="w-1/2 pr-2">
          <ReviewRow label="Contact Number" value={form.contactNumber} />
        </View>

        <View className="w-1/2 pl-2">
          <ReviewRow label="Business Email" value={form.businessEmail} />
        </View>

        <View className="w-1/2 pr-2">
          <ReviewRow label="Website" value={form.website} />
        </View>

        <View className="w-full">
          <AppText className="mb-2 text-sm font-medium text-text-secondary">
            Specialty Tags
          </AppText>

          {isLoadingSpecialtyTags && !hasSpecialtyTagsData ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />
              <AppText className="text-sm text-text-secondary">
                Loading specialty tags...
              </AppText>
            </View>
          ) : specialtyTagsError && !hasSpecialtyTagsData ? (
            <FormFieldApiError
              message="Unable to load specialty tags."
              onRetry={() => {
                void refetchSpecialtyTags();
              }}
            />
          ) : selectedSpecialtyTags.length > 0 ? (
            <View className="flex-row flex-wrap">
              {selectedSpecialtyTags.map((tag) => (
                <SpecialtyTagChip key={tag.id} tag={tag} showIcon />
              ))}
            </View>
          ) : (
            <AppText className="text-sm text-text-primary">
              Not provided
            </AppText>
          )}

          {specialtyTagsError && hasSpecialtyTagsData && (
            <FormFieldApiError
              message="Specialty tags could not be refreshed."
              onRetry={() => {
                void refetchSpecialtyTags();
              }}
            />
          )}
        </View>
      </View>
    </ReviewSection>
  );
}
