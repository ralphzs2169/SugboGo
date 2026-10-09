import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation, type Href } from "expo-router";
import { HeaderBackButton } from "expo-router/build/react-navigation/elements/Header/HeaderBackButton";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackHandler, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import FormSelect from "@/shared/components/form/FormSelect";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import ClassificationChangeReviewSections from "../../components/classification-change/ClassificationChangeReviewSections";
import ClassificationLiveSummary from "../../components/classification-change/ClassificationLiveSummary";
import ClassificationSpecialtySelector from "../../components/classification-change/ClassificationSpecialtySelector";
import MerchantChangeCooldownState from "../../components/change-requests/MerchantChangeCooldownState";
import RegistrationSection from "../../components/registration/RegistrationSection";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantClassificationChangeRequests,
  useSubmitMerchantClassificationChange,
} from "../../hooks/classification-change/useMerchantClassificationChanges";
import useMerchantChangeEligibilityRefresh from "../../hooks/change-requests/useMerchantChangeEligibilityRefresh";
import useCategories from "../../hooks/registration/useCategories";
import useClusters from "../../hooks/registration/useClusters";
import useSpecialtyTags from "../../hooks/registration/useSpecialtyTags";
import {
  classificationHasChanged,
  mergeClassificationSpecialtyOptions,
} from "../../utils/classificationChange.utils";

/**
 * Allows merchants to request changes to their business classification.
 *
 * Provides a compact reference to the live classification, editable
 * category and specialty selections, and an informational notice
 * explaining discovery impact and historical vouch retention.
 * Changes are reviewed before submission and require Admin approval.
 */
export default function ClassificationChangeRequestScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const hasChangesRef = useRef(false);
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
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);

  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();

  const {
    eligibility,
    pendingRequest,
    hasData: hasRequestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useMerchantClassificationChangeRequests();
  useMerchantChangeEligibilityRefresh(eligibility, refetchRequests);

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
        icon: CLUSTER_ICONS[cluster.icon],
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

  const browsingCluster = clusters.find((item) => item.id === clusterId);

  const availableTags = useMemo(
    () =>
      mergeClassificationSpecialtyOptions(
        specialtyTags,
        business?.specialty_tags ?? [],
      ),
    [business?.specialty_tags, specialtyTags],
  );

  // Detect proposal and draft changes.
  const hasProposalChanges = Boolean(
    business &&
    categoryId &&
    classificationHasChanged(business, categoryId, specialtyTagIds),
  );

  const hasDraftChanges = Boolean(
    business &&
    clusterId !== null &&
    (clusterId !== business.cluster.id ||
      categoryId !== business.category.id ||
      specialtyTagIds.length !== business.specialty_tags.length ||
      specialtyTagIds.some(
        (id) => !business.specialty_tags.some((tag) => Number(tag.id) === id),
      )),
  );

  useLayoutEffect(() => {
    hasChangesRef.current = hasDraftChanges;
  }, [hasDraftChanges]);

  const requestExit = useCallback(() => {
    if (submittingRef.current || submittedRef.current) {
      return;
    }

    if (hasChangesRef.current) {
      setDiscardVisible(true);
      return;
    }

    router.back();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderBackButton onPress={requestExit} />,
    });
  }, [navigation, requestExit]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          requestExit();
          return true;
        },
      );

      return () => subscription.remove();
    }, [requestExit]),
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
    setIsSubmittingRequest(true);

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

      submittedRef.current = true;

      router.replace(
        `/(merchant)/business-update-requests/classification/${created.id}` as Href,
      );
    } catch (error) {
      setIsSubmittingRequest(false);

      const response = error as ApiError;
      const cooldownBlocked = response.errors?.reason?.[0] === "cooldown";

      if (cooldownBlocked) {
        await refetchRequests();
        Toast.show({
          type: "info",
          text1: "Classification change temporarily unavailable",
          text2: response.message,
        });
        return;
      }

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
    (!hasRequestsData && !requestsError)
  ) {
    return (
      <LoadingScreen
        title="Loading Classification"
        description="Checking your business and available choices..."
      />
    );
  }

  const cannotRender = !business || (requestsError && !hasRequestsData);

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
          }}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  if (pendingRequest && !isSubmittingRequest) {
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

  if (
    eligibility?.reason === "cooldown" &&
    eligibility.cooldown_until &&
    eligibility.last_approved_request_id
  ) {
    return (
      <MerchantChangeCooldownState
        description="Your recent classification change was approved. You can submit another request after the waiting period."
        cooldownDurationHours={eligibility.cooldown_duration_hours}
        cooldownUntil={eligibility.cooldown_until}
        onViewApprovedRequest={() =>
          router.push(
            `/(merchant)/business-update-requests/classification/${eligibility.last_approved_request_id}` as Href,
          )
        }
        onGoBack={() => router.back()}
      />
    );
  }

  if (isClustersLoading || isCategoriesLoading || isTagsLoading) {
    return (
      <LoadingScreen
        title="Loading Classification"
        description="Preparing your classification choices..."
      />
    );
  }

  if (
    (clustersError && clusters.length === 0) ||
    (categoriesError && categories.length === 0) ||
    (tagsError && specialtyTags.length === 0)
  ) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load classification choices"
          description="Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => {
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

  const currentCluster = clusters.find(
    (item) => item.id === business.cluster.id,
  );

  const requestedTags = specialtyTagIds.flatMap((id) => {
    const tag = availableTags.find((item) => item.id === id);
    return tag ? [tag] : [];
  });

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="pt-2"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Data refresh error */}
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

        {isReviewing ? (
          /* Current and proposed classification */
          <ClassificationChangeReviewSections
            current={{
              category: business.category,
              cluster: {
                ...business.cluster,
                icon: currentCluster?.icon,
              },
            }}
            proposed={{
              category: selectedCategory ?? business.category,
              cluster: {
                name: selectedCluster?.name ?? business.cluster.name,
                icon: selectedCluster?.icon,
              },
            }}
            currentTags={business.specialty_tags}
            proposedTags={requestedTags}
          />
        ) : (
          <>
            {/* Current classification reference */}
            <ClassificationLiveSummary
              category={business.category.name}
              cluster={business.cluster.name}
              clusterIcon={currentCluster?.icon}
              specialties={business.specialty_tags}
            />

            {/* Category selection */}
            <RegistrationSection
              title="Category"
              icon="store-outline"
              description="Choose the category that best describes your business."
            >
              <FormSelect
                label="Browse by cluster"
                value={browsingCluster?.name}
                icon={
                  browsingCluster
                    ? CLUSTER_ICONS[browsingCluster.icon]
                    : undefined
                }
                placeholder="Choose a cluster"
                onPress={() => clusterSheetRef.current?.present()}
              />

              <View className="mt-4">
                <FormSelect
                  label="Category"
                  value={selectedCategory?.name}
                  placeholder="Choose a category"
                  disabled={!clusterId}
                  required
                  error={categoryError}
                  onPress={() => categorySheetRef.current?.present()}
                />
              </View>
            </RegistrationSection>

            {/* Specialty selection */}
            <RegistrationSection
              title="Specialties"
              icon="tag-outline"
              description="Choose three specialties that describe what makes your business distinctive."
            >
              <ClassificationSpecialtySelector
                tags={availableTags}
                selectedIds={specialtyTagIds}
                onChange={selectSpecialties}
                error={specialtyError}
              />

              {/* Discovery and vouch retention guidance */}
              <View className="mt-4 rounded-xl bg-info px-4 py-4">
                <View className="flex-row items-start">
                  <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={18}
                      color={theme.extends.colors.text.info}
                    />
                  </View>

                  <View className="ml-3 flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      About specialty changes
                    </AppText>

                    <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                      Changing specialties may affect how your business appears
                      in discovery. Your previous vouches are retained, even if
                      you switch back to a specialty later.
                    </AppText>
                  </View>
                </View>
              </View>
            </RegistrationSection>
          </>
        )}

        {/* Form and approval information */}
        {formError ? (
          <AppText className="mx-6 mt-3 text-sm text-text-error">
            {formError}
          </AppText>
        ) : null}

        <AppText className="mx-6 mt-3 text-sm leading-5 text-text-secondary">
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
          onPress={() => (isReviewing ? setIsReviewing(false) : requestExit())}
          disabled={submitRequest.isPending || isSubmittingRequest}
          rounded="full"
        />

        <Button
          title={isReviewing ? "Submit Request" : "Review Changes"}
          className="flex-1"
          onPress={() => (isReviewing ? void submitValues() : reviewRequest())}
          disabled={
            submitRequest.isPending ||
            isSubmittingRequest ||
            (!isReviewing && !hasProposalChanges)
          }
          loading={submitRequest.isPending || isSubmittingRequest}
          rounded="full"
        />
      </View>

      {/* Classification selection sheets */}
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

      {/* Discard confirmation */}
      <ConfirmModal
        visible={discardVisible}
        title="Discard classification changes?"
        message="Your current live classification will remain unchanged."
        confirmText="Discard"
        destructive
        onCancel={() => setDiscardVisible(false)}
        onConfirm={() => {
          setDiscardVisible(false);
          router.back();
        }}
      />
    </View>
  );
}
