import { useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import RHFFormInput from "@/shared/components/form/RHFFormInput";
import RHFFormSelect from "@/shared/components/form/RHFFormSelect";
import RHFFormTextArea from "@/shared/components/form/RHFFormTextArea";
import FormFieldApiError from "@/shared/components/form/FormFieldApiError";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import RegistrationSection from "../RegistrationSection";
import SpecialtyTagsSection from "../specialty-tags/SpecialtyTagsSection";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import {
  ClusterOption,
  CategoryOption,
} from "@/features/merchant/types/registration/registrationOption.types";
import { ApiError } from "@/shared/types/apiResponse.types";
import type { RepresentativeRole } from "../../../types/registration/registrationApi.types";
import useRegistrationErrorScroll from "@/features/merchant/hooks/registration/useRegistrationErrorScroll";
import { View } from "react-native";

export const REPRESENTATIVE_ROLE_OPTIONS: {
  label: string;
  value: RepresentativeRole;
}[] = [
  { label: "Owner", value: "owner" },
  { label: "Manager", value: "manager" },
  {
    label: "Authorized Representative",
    value: "authorized_representative",
  },
  { label: "Other", value: "other" },
];

type Props = {
  clusters: ClusterOption[];
  categories: CategoryOption[];
  isLoadingClusters: boolean;
  isLoadingCategories: boolean;
  clustersError: ApiError | null;
  categoriesError: ApiError | null;
  refetchClusters?: () => void;
  refetchCategories?: () => void;
  registerErrorScrollTarget: ReturnType<
    typeof useRegistrationErrorScroll
  >["registerErrorScrollTarget"];
};

/**
 * Displays the business identity fields for the
 * merchant registration flow.
 */
export default function BusinessIdentityStep({
  clusters,
  categories,
  isLoadingClusters,
  isLoadingCategories,
  clustersError,
  categoriesError,
  refetchClusters,
  refetchCategories,
  registerErrorScrollTarget,
}: Props) {
  const clusterSheetRef = useRef<BottomSheetModal>(null);
  const categorySheetRef = useRef<BottomSheetModal>(null);

  const representativeRoleSheetRef = useRef<BottomSheetModal>(null);
  const { control, setValue } = useFormContext<MerchantRegistrationForm>();

  const selectedRepresentativeRole = useWatch({
    control,
    name: "representativeRole",
  });

  const selectedCluster = useWatch({
    control,
    name: "businessCluster",
  });

  const selectedCategory = useWatch({
    control,
    name: "businessCategory",
  });

  // Determine the options for the cluster select field.
  const clusterOptions = useMemo(
    () =>
      clusters.map((cluster) => ({
        label: cluster.name,
        value: String(cluster.id),
        icon: CLUSTER_ICONS[cluster.icon],
      })),
    [clusters],
  );

  // Determine the options for the category select field based on the selected cluster.
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.cluster_id === Number(selectedCluster))
        .map((category) => ({
          label: category.name,
          value: String(category.id),
        })),
    [categories, selectedCluster],
  );

  // Determine the placeholder text for the category select field based on the current state.
  let categoryPlaceholder = "Select a category";

  if (isLoadingCategories) {
    categoryPlaceholder = "Loading categories...";
  } else if (!selectedCluster) {
    categoryPlaceholder = "Select a cluster first";
  } else if (categoryOptions.length === 0) {
    categoryPlaceholder = "No categories available";
  }

  function handleSelectCluster(value: string) {
    setValue("businessCluster", value, {
      shouldValidate: true,
      shouldDirty: true,
    });

    // The existing category may no longer belong
    // to the newly selected cluster.
    setValue("businessCategory", "", {
      shouldValidate: false,
      shouldDirty: true,
    });
  }

  function handleSelectCategory(value: string) {
    setValue("businessCategory", value, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function handleOpenClusterSheet() {
    presentBottomSheet(clusterSheetRef);
  }

  function handleOpenCategorySheet() {
    if (!selectedCluster) {
      return;
    }

    presentBottomSheet(categorySheetRef);
  }

  function handleOpenRepresentativeRoleSheet() {
    presentBottomSheet(representativeRoleSheetRef);
  }

  /**
   * Updates the representative role selected in the form.
   */
  function handleSelectRepresentativeRole(value: string) {
    setValue("representativeRole", value as RepresentativeRole, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  // Determine the name of the selected cluster for display in the category sheet description.
  const selectedClusterName = useMemo(
    () =>
      clusters.find((cluster) => String(cluster.id) === selectedCluster)?.name,
    [clusters, selectedCluster],
  );

  return (
    <>
      <RegistrationSection
        icon="store-outline"
        title="Business Details"
        description="Tell us about the business you'd like to register."
      >
        <View {...registerErrorScrollTarget?.("businessName")}>
          <RHFFormInput
            name="businessName"
            label="Business Name"
            placeholder="e.g. Cafe Sugbo"
            minLength={3}
            showCharacterCount
            required
          />
        </View>

        {/* Cluster Select Input */}
        <View {...registerErrorScrollTarget?.("businessCluster")}>
          <RHFFormSelect
            name="businessCluster"
            label="Cluster"
            placeholder="Select a cluster"
            required
            disabled={isLoadingClusters || clusters.length === 0}
            options={clusterOptions}
            onSelectPress={handleOpenClusterSheet}
          />
        </View>
        {clustersError && (
          <FormFieldApiError
            message="Unable to load clusters."
            onRetry={refetchClusters}
          />
        )}

        {/* Category Select Input */}
        <View {...registerErrorScrollTarget?.("businessCategory")}>
          <RHFFormSelect
            name="businessCategory"
            label="Category"
            placeholder={categoryPlaceholder}
            required
            disabled={
              isLoadingCategories ||
              !selectedCluster ||
              categoryOptions.length === 0
            }
            options={categoryOptions}
            onSelectPress={handleOpenCategorySheet}
          />
        </View>

        {categoriesError && selectedCluster && (
          <FormFieldApiError
            message="Unable to load categories."
            onRetry={refetchCategories}
          />
        )}

        <View {...registerErrorScrollTarget?.("businessDescription")}>
          <RHFFormTextArea
            name="businessDescription"
            label="Description"
            placeholder="Tell explorers about your business..."
            maxLength={500}
            required
            minLength={10}
            showCharacterCount
          />
        </View>

        <RHFFormInput
          name="website"
          label="Website / Social Media (Optional)"
          placeholder="https://..."
          autoCapitalize="none"
        />
      </RegistrationSection>

      {/* Specialty Tags Section */}
      <RegistrationSection
        icon="tag-outline"
        title="Specialty Tags"
        description="Choose 3 tags that best describe your business."
      >
        <View {...registerErrorScrollTarget("specialtyTags")}>
          <SpecialtyTagsSection />
        </View>
      </RegistrationSection>

      {/* Contact Information Section */}
      <RegistrationSection
        icon="account-outline"
        title="Contact Information"
        description="We'll use these details to contact you regarding your application."
      >
        <View {...registerErrorScrollTarget("contactNumber")}>
          <RHFFormInput
            name="contactNumber"
            label="Mobile Number"
            placeholder="0912 345 6789"
            keyboardType="phone-pad"
            required
          />
        </View>

        <RHFFormInput
          name="businessEmail"
          label="Business Email (Optional)"
          placeholder="business@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </RegistrationSection>

      {/* Representative Information Section */}
      <RegistrationSection
        icon="account-check-outline"
        title="Representative Information"
        description="Tell us who is submitting this application."
      >
        <View {...registerErrorScrollTarget("representativeName")}>
          <RHFFormInput
            name="representativeName"
            label="Full Name"
            required
            placeholder="e.g. Juan Dela Cruz"
            minLength={2}
            showCharacterCount
          />
        </View>

        <View {...registerErrorScrollTarget("representativeRole")}>
          <RHFFormSelect
            name="representativeRole"
            label="Position / Role"
            required
            placeholder="Select your role"
            options={REPRESENTATIVE_ROLE_OPTIONS}
            onSelectPress={handleOpenRepresentativeRoleSheet}
          />
        </View>
      </RegistrationSection>

      <SelectionBottomSheet
        sheetRef={clusterSheetRef}
        title="Select Cluster"
        options={clusterOptions}
        selectedValue={selectedCluster}
        onSelect={handleSelectCluster}
      />

      <SelectionBottomSheet
        sheetRef={categorySheetRef}
        title="Select Category"
        description={
          selectedClusterName
            ? `Categories under ${selectedClusterName} cluster`
            : undefined
        }
        options={categoryOptions}
        selectedValue={selectedCategory}
        onSelect={handleSelectCategory}
      />

      <SelectionBottomSheet
        sheetRef={representativeRoleSheetRef}
        title="Select Position / Role"
        options={REPRESENTATIVE_ROLE_OPTIONS}
        selectedValue={selectedRepresentativeRole}
        onSelect={handleSelectRepresentativeRole}
      />
    </>
  );
}
