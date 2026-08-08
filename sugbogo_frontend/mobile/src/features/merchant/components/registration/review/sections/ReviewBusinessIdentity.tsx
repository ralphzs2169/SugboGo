import { Text, View } from "react-native";
import type { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

import type {
  ClusterOption,
  CategoryOption,
} from "@/features/merchant/types/registration/registrationOption.types";

import useSpecialtyTags from "@/features/merchant/hooks/registration/useSpecialtyTags";
import ReviewSection from "../ReviewSection";
import ReviewRow from "../ReviewRow";
import SpecialtyTagChip from "../../specialty-tags/SpecialtyTagChip";

type ReviewForm = z.input<typeof merchantRegistrationSchema>;
type ReviewBusinessIdentityProps = {
  form: ReviewForm;
  clusters: ClusterOption[];
  categories: CategoryOption[];
  onEdit?: () => void;
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
}: ReviewBusinessIdentityProps) {
  const { specialtyTags } = useSpecialtyTags();

  const clusterName =
    clusters.find((cluster) => cluster.id.toString() === form.businessCluster)
      ?.name ?? "Not provided";

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
        <ReviewRow
          label="Business Name"
          value={form.businessName}
          valueClassName="text-2xl font-bold text-brand"
        />
      </View>

      <View className="flex-row flex-wrap">
        <View className="w-1/2 pr-2">
          <ReviewRow label="Business Cluster" value={clusterName} />
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
          <Text className="mb-2 text-sm font-medium text-text-secondary">
            Specialty Tags
          </Text>

          {selectedSpecialtyTags.length > 0 ? (
            <View className="flex-row flex-wrap">
              {selectedSpecialtyTags.map((tag) => (
                <SpecialtyTagChip key={tag.id} tag={tag} />
              ))}
            </View>
          ) : (
            <Text className="text-sm text-text-primary">Not provided</Text>
          )}
        </View>
      </View>
    </ReviewSection>
  );
}
