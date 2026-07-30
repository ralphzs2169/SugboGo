import { useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import RHFFormInput from "@/shared/components/form/RHFFormInput";
import RHFFormSelect from "@/shared/components/form/RHFFormSelect";
import RHFFormTextArea from "@/shared/components/form/RHFFormTextArea";
import FormFieldApiError from "@/shared/components/form/FormFieldApiError";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import RegistrationSection from "../RegistrationSection";

import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import {
  ClusterOption,
  CategoryOption,
} from "@/features/merchant/types/merchantRegistration.types";
import { ApiError } from "@/shared/api/types";

type Props = {
  clusters: ClusterOption[];
  categories: CategoryOption[];
  isLoadingClusters: boolean;
  isLoadingCategories: boolean;
  clustersError: ApiError | null;
  categoriesError: ApiError | null;
  refetchClusters?: () => void;
  refetchCategories?: () => void;
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
}: Props) {
  const clusterSheetRef = useRef<BottomSheetModal>(null);
  const categorySheetRef = useRef<BottomSheetModal>(null);

  const { control, setValue } = useFormContext<MerchantRegistrationForm>();

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
      shouldValidate: true,
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
    clusterSheetRef.current?.present();
  }

  function handleOpenCategorySheet() {
    if (!selectedCluster) {
      return;
    }

    categorySheetRef.current?.present();
  }

  return (
    <>
      <RegistrationSection
        icon="store-outline"
        title="Business Details"
        description="Tell us about the business you'd like to register."
      >
        <RHFFormInput
          name="businessName"
          label="Business Name"
          placeholder="e.g. Cafe Sugbo"
          required
        />

        {/* Cluster Select Input */}
        <RHFFormSelect
          name="businessCluster"
          label="Cluster"
          placeholder="Select a cluster"
          required
          disabled={isLoadingClusters || clusters.length === 0}
          options={clusterOptions}
          onSelectPress={handleOpenClusterSheet}
        />
        {clustersError && (
          <FormFieldApiError
            message="Unable to load clusters."
            onRetry={refetchClusters}
          />
        )}

        {/* Category Select Input */}
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
        {categoriesError && selectedCluster && (
          <FormFieldApiError
            message="Unable to load categories."
            onRetry={refetchCategories}
          />
        )}

        <RHFFormTextArea
          name="businessDescription"
          label="Description"
          placeholder="Tell explorers about your business..."
          maxLength={500}
        />

        <RHFFormInput
          name="website"
          label="Facebook Page / Website (Optional)"
          placeholder="https://..."
          autoCapitalize="none"
        />
      </RegistrationSection>

      <RegistrationSection
        icon="account-outline"
        title="Contact Information"
        description="We'll use these details to contact you regarding your application."
      >
        <RHFFormInput
          name="contactNumber"
          label="Mobile Number"
          placeholder="0912 345 6789"
          keyboardType="phone-pad"
          required
        />

        <RHFFormInput
          name="businessEmail"
          label="Email Address"
          placeholder="business@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          required
        />
      </RegistrationSection>

      <RegistrationSection
        icon="account-outline"
        title="Representative Information"
        description="Provide the details of the person authorized to submit this application."
      >
        <RHFFormInput
          name="representativeName"
          label="Representative Name"
          required
          placeholder="e.g. Juan Dela Cruz"
        />

        <RHFFormSelect
          name="representativeRole"
          label="Position / Role"
          required
          placeholder="Select your role"
          onSelectPress={() => {}}
        />
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
        options={categoryOptions}
        selectedValue={selectedCategory}
        onSelect={handleSelectCategory}
      />
    </>
  );
}
