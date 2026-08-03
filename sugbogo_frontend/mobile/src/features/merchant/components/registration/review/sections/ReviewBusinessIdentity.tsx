import { useFormContext } from "react-hook-form";
import { View } from "react-native";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import {
  type ClusterOption,
  type CategoryOption,
  SPECIALTY_TAGS,
} from "@/features/merchant/types/merchantRegistration.types";

import ReviewSection from "../ReviewSection";
import ReviewRow from "../ReviewRow";

type ReviewBusinessIdentityProps = {
  clusters: ClusterOption[];
  categories: CategoryOption[];
  onEdit?: () => void;
};

export default function ReviewBusinessIdentity({
  clusters,
  categories,
  onEdit,
}: ReviewBusinessIdentityProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const form = watch();

  const clusterName =
    clusters.find((cluster) => cluster.id.toString() === form.businessCluster)
      ?.name ?? "Not provided";

  const categoryName =
    categories.find(
      (category) => category.id.toString() === form.businessCategory,
    )?.name ?? "Not provided";

  return (
    <ReviewSection
      icon="store-outline"
      title="Business Identity"
      onEdit={onEdit}
    >
      {/* Business Name */}
      <View className="w-full">
        <ReviewRow
          label="Business Name"
          value={form.businessName}
          valueClassName="text-md font-bold text-brand"
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
            value={form.representativeRole}
          />
        </View>

        {/* Full-width fields */}
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
          <ReviewRow
            label="Specialty Tags"
            value={form.specialtyTags
              .map(
                (tagId) => SPECIALTY_TAGS.find((tag) => tag.id === tagId)?.name,
              )
              .filter(Boolean)
              .join(", ")}
          />
        </View>
      </View>
    </ReviewSection>
  );
}
