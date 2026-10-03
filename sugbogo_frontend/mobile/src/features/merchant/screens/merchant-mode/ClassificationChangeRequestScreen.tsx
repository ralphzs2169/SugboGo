import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import FormSelect from "@/shared/components/form/FormSelect";
import LoadingScreen from "@/shared/components/LoadingScreen";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import ClassificationComparison from "../../components/classification-change/ClassificationComparison";
import ClassificationSpecialtySelector from "../../components/classification-change/ClassificationSpecialtySelector";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantClassificationChangeRequests,
  useSubmitMerchantClassificationChange,
} from "../../hooks/classification-change/useMerchantClassificationChanges";
import useCategories from "../../hooks/registration/useCategories";
import useClusters from "../../hooks/registration/useClusters";
import useSpecialtyTags from "../../hooks/registration/useSpecialtyTags";
import type { ClassificationSnapshot } from "../../types/classificationChange.types";
import {
  classificationHasChanged,
  mergeClassificationSpecialtyOptions,
} from "../../utils/classificationChange.utils";

/** Builds a reviewed classification proposal from live defaults while keeping the live profile unchanged. */
export default function ClassificationChangeRequestScreen() {
  const insets = useSafeAreaInsets();
  const submittingRef = useRef(false);
  const initializedBusinessId = useRef<number | null>(null);
  const clusterSheetRef = useRef<BottomSheetModal>(null);
  const categorySheetRef = useRef<BottomSheetModal>(null);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [specialtyTagIds, setSpecialtyTagIds] = useState<number[]>([]);
  const [categoryError, setCategoryError] = useState<string | undefined>();
  const [specialtyError, setSpecialtyError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isReviewing, setIsReviewing] = useState(false);

  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();
  const {
    pendingRequest,
    hasData: hasRequestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useMerchantClassificationChangeRequests();
  const {
    clusters,
    isLoading: isClustersLoading,
    error: clustersError,
    refetch: refetchClusters,
  } = useClusters();
  const {
    categories,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories();
  const {
    specialtyTags,
    isLoading: isTagsLoading,
    error: tagsError,
    refetch: refetchTags,
  } = useSpecialtyTags();
  const submitRequest = useSubmitMerchantClassificationChange();

  useEffect(() => {
    if (!business || initializedBusinessId.current === business.id) {
      return;
    }
    initializedBusinessId.current = business.id;
    setClusterId(business.cluster.id);
    setCategoryId(business.category.id);
    setSpecialtyTagIds(business.specialty_tags.map((tag) => Number(tag.id)));
  }, [business]);

  const loadError =
    profileError ??
    requestsError ??
    clustersError ??
    categoriesError ??
    tagsError;
  useQueryErrorNotification({
    error: loadError,
    toastId: "classification-change-form-error",
    title: "Unable to load classification options",
    fallbackMessage: "Please try again.",
  });

  const clusterOptions = useMemo(
    () =>
      clusters.map((cluster) => ({
        label: cluster.name,
        value: String(cluster.id),
      })),
    [clusters],
  );
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.cluster_id === clusterId)
        .map((category) => ({
          label: category.name,
          value: String(category.id),
        })),
    [categories, clusterId],
  );
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedCluster = clusters.find(
    (item) => item.id === selectedCategory?.cluster_id,
  );
  const availableTags = useMemo(
    () =>
      mergeClassificationSpecialtyOptions(
        specialtyTags,
        business?.specialty_tags ?? [],
      ),
    [business?.specialty_tags, specialtyTags],
  );

  function selectCluster(value: string) {
    const nextClusterId = Number(value);
    if (nextClusterId !== clusterId) {
      setClusterId(nextClusterId);
      setCategoryId(null);
      setCategoryError(undefined);
      setIsReviewing(false);
    }
  }

  function selectCategory(value: string) {
    const nextCategory = categories.find((item) => item.id === Number(value));
    if (!nextCategory) {
      return;
    }
    setCategoryId(nextCategory.id);
    setClusterId(nextCategory.cluster_id);
    setCategoryError(undefined);
    setFormError(undefined);
    setIsReviewing(false);
  }

  function selectSpecialties(ids: number[]) {
    setSpecialtyTagIds(ids);
    setSpecialtyError(undefined);
    setFormError(undefined);
    setIsReviewing(false);
  }

  function reviewRequest() {
    if (!business) {
      return;
    }
    if (!categoryId || !selectedCategory || !selectedCluster) {
      setCategoryError("Choose a valid category.");
      return;
    }
    if (specialtyTagIds.length !== 3 || new Set(specialtyTagIds).size !== 3) {
      setSpecialtyError("Choose exactly 3 different specialty tags.");
      return;
    }
    if (!classificationHasChanged(business, categoryId, specialtyTagIds)) {
      setFormError(
        "Make at least one classification change before submitting.",
      );
      return;
    }
    setFormError(undefined);
    setIsReviewing(true);
  }

  async function submitValues() {
    if (
      submittingRef.current ||
      submitRequest.isPending ||
      !business ||
      pendingRequest ||
      !categoryId ||
      !isReviewing
    ) {
      return;
    }
    submittingRef.current = true;
    try {
      const created = await submitRequest.mutateAsync({
        proposed_category_id: categoryId,
        proposed_specialty_tag_ids: specialtyTagIds,
      });
      Toast.show({
        type: "success",
        text1: "Classification change requested",
        text2: "Your current classification stays visible until approval.",
      });
      router.replace(
        `/(merchant)/business-update-requests/classification/${created.id}` as Href,
      );
    } catch (error) {
      const response = error as ApiError;
      const categoryMessage = getFieldError(response, "proposed_category_id");
      const tagsMessage = getFieldError(response, "proposed_specialty_tag_ids");
      if (categoryMessage || tagsMessage) {
        setCategoryError(categoryMessage);
        setSpecialtyError(tagsMessage);
        setIsReviewing(false);
      } else {
        if (response.code === "VALIDATION_ERROR") {
          await refetchRequests();
          setFormError(response.message);
          setIsReviewing(false);
          return;
        }
        if (!handleSystemError(response)) {
          Toast.show({
            type: "error",
            text1: "Unable to submit request",
            text2: response.message || "Please try again.",
          });
        }
      }
    } finally {
      submittingRef.current = false;
    }
  }

  if (
    (isProfileLoading && !business) ||
    isRequestsLoading ||
    isClustersLoading ||
    isCategoriesLoading ||
    isTagsLoading
  ) {
    return (
      <LoadingScreen
        title="Loading Classification"
        description="Checking your business and available choices..."
      />
    );
  }

  const cannotRender =
    !business ||
    (requestsError && !hasRequestsData) ||
    (clustersError && clusters.length === 0) ||
    (categoriesError && categories.length === 0) ||
    (tagsError && specialtyTags.length === 0);

  if (cannotRender) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load classification"
          description="Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => {
            if (profileError || !business) void refetchProfile();
            if (requestsError) void refetchRequests();
            if (clustersError) void refetchClusters();
            if (categoriesError) void refetchCategories();
            if (tagsError) void refetchTags();
          }}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  if (business.status === "suspended") {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Request unavailable"
          description="Classification changes cannot be requested while your business is suspended."
          primaryActionTitle="Go Back"
          onPrimaryAction={() => router.back()}
        />
      </View>
    );
  }

  if (pendingRequest) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Pending Admin review"
          description="A classification request is already pending. Your current category and specialties remain visible."
          primaryActionTitle="View Request"
          onPrimaryAction={() =>
            router.replace(
              `/(merchant)/business-update-requests/classification/${pendingRequest.id}` as Href,
            )
          }
        />
      </View>
    );
  }

  const current: ClassificationSnapshot = {
    category: business.category,
    cluster: business.cluster,
    specialty_tags: business.specialty_tags,
  };
  const proposed: ClassificationSnapshot = {
    category: selectedCategory ?? business.category,
    cluster: selectedCluster ?? business.cluster,
    specialty_tags: specialtyTagIds.map((id) => {
      const tag = availableTags.find((item) => item.id === id);
      return { id, name: tag?.name ?? `Specialty ${id}` };
    }),
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-5 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? (
          <ErrorState
            size="section"
            title="Unable to refresh classification"
            description="Showing the last available choices."
            primaryActionTitle="Retry"
            onPrimaryAction={() => {
              if (profileError) void refetchProfile();
              if (requestsError) void refetchRequests();
              if (clustersError) void refetchClusters();
              if (categoriesError) void refetchCategories();
              if (tagsError) void refetchTags();
            }}
          />
        ) : null}
        {/* Current and requested classification */}
        <ClassificationComparison
          title="Current Classification"
          classification={current}
        />
        {isReviewing ? (
          <View className="mt-4">
            <ClassificationComparison
              title="Requested Classification"
              classification={proposed}
            />
          </View>
        ) : (
          <View className="mt-4 rounded-card border border-border-primary bg-surface p-4">
            <AppText weight="bold" className="mb-4 text-base text-text-primary">
              Requested Classification
            </AppText>
            <FormSelect
              label="Cluster"
              value={clusters.find((item) => item.id === clusterId)?.name}
              placeholder="Choose a cluster to browse categories"
              onPress={() => clusterSheetRef.current?.present()}
            />
            <AppText className="mb-4 text-xs text-text-secondary">
              Cluster is derived from your category and is not submitted
              separately.
            </AppText>
            <FormSelect
              label="Category"
              value={selectedCategory?.name}
              placeholder="Choose a category"
              disabled={!clusterId}
              required
              error={categoryError}
              onPress={() => categorySheetRef.current?.present()}
            />
            <AppText className="mb-4 text-xs text-text-secondary">
              Derived cluster: {selectedCluster?.name ?? "Choose a category"}
            </AppText>
            <ClassificationSpecialtySelector
              tags={availableTags}
              selectedIds={specialtyTagIds}
              onChange={selectSpecialties}
              error={specialtyError}
            />
          </View>
        )}
        {formError ? (
          <AppText className="mt-3 text-sm text-text-error">
            {formError}
          </AppText>
        ) : null}
        <AppText className="mt-4 text-sm leading-5 text-text-secondary">
          Your current classification will remain visible until an Admin
          approves this request.
        </AppText>
      </ScrollView>

      {/* Review and submission controls */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title={isReviewing ? "Edit" : "Cancel"}
          variant="outline"
          className="flex-1"
          onPress={() => (isReviewing ? setIsReviewing(false) : router.back())}
          disabled={submitRequest.isPending}
        />
        <Button
          title={isReviewing ? "Submit Request" : "Review Request"}
          className="flex-1"
          onPress={() => (isReviewing ? void submitValues() : reviewRequest())}
          loading={submitRequest.isPending}
        />
      </View>
      <SelectionBottomSheet
        sheetRef={clusterSheetRef}
        title="Select Cluster"
        options={clusterOptions}
        selectedValue={clusterId ? String(clusterId) : undefined}
        onSelect={selectCluster}
      />
      <SelectionBottomSheet
        sheetRef={categorySheetRef}
        title="Select Category"
        options={categoryOptions}
        selectedValue={categoryId ? String(categoryId) : undefined}
        onSelect={selectCategory}
      />
    </View>
  );
}
