import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Toast from "react-native-toast-message";

import { useBusinessReviews } from "@/features/explore/hooks/useBusinessReviews";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import ErrorState from "@/shared/components/ErrorState";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import CreateReviewDisputeFooter from "../../components/review-disputes/create-dispute-screen/CreateReviewDisputeFooter";
import CreateReviewDisputeFooterSkeleton from "../../components/review-disputes/create-dispute-screen/CreateReviewDisputeFooterSkeleton";
import CreateReviewDisputeFormContent from "../../components/review-disputes/create-dispute-screen/CreateReviewDisputeFormContent";
import CreateReviewDisputeSkeleton from "../../components/review-disputes/create-dispute-screen/CreateReviewDisputeSkeleton";
import {
  MAX_REVIEW_DISPUTE_EVIDENCE,
  MAX_REVIEW_DISPUTE_EVIDENCE_BYTES,
  REVIEW_DISPUTE_REASON_OPTIONS,
} from "../../constants/reviewDispute.constants";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useAddReviewDisputeEvidence,
  useCreateReviewDispute,
} from "../../hooks/review-disputes/useReviewDisputes";
import type {
  LocalReviewDisputeEvidence,
  ReviewDisputeReason,
} from "../../types/review-disputes/reviewDispute.types";
import {
  pickReviewDisputeDocuments,
  pickReviewDisputeImages,
} from "../../utils/review-disputes/pickReviewDisputeEvidence.utils";

type Props = {
  reviewId: number;
};

type FormErrors = {
  reason?: string;
  description?: string;
};

/**
 * Coordinates creation of a merchant review dispute and optional evidence.
 *
 * Owns dispute form state, validation, loading, submission, evidence uploads,
 * navigation, and tab-bar-aware footer positioning while delegating form
 * presentation to child components.
 */
export default function CreateReviewDisputeScreen({ reviewId }: Props) {
  const reasonSheetRef = useRef<BottomSheetModal | null>(null);

  const [reason, setReason] = useState<ReviewDisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<LocalReviewDisputeEvidence[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const [isPickingImages, setIsPickingImages] = useState(false);
  const [isPickingDocuments, setIsPickingDocuments] = useState(false);

  const tabBarSpacing = useTabBarSpacing(8);

  const {
    business,
    isLoading: isBusinessLoading,
    error: businessError,
    refetch: refetchBusiness,
  } = useMerchantBusinessProfile();

  const businessId = business?.id ?? 0;

  const {
    reviews,
    isInitialLoading: isReviewsLoading,
    error: reviewsError,
    refetch: refetchReviews,
  } = useBusinessReviews(businessId);

  const createDispute = useCreateReviewDispute(businessId);
  const addEvidence = useAddReviewDisputeEvidence();

  const review = reviews.find((item) => item.id === reviewId);

  const isSubmitting = createDispute.isPending || addEvidence.isPending;
  const remainingSlots = MAX_REVIEW_DISPUTE_EVIDENCE - evidence.length;
  const error = businessError || reviewsError;

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load review",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  const addPickedEvidence = (picked: LocalReviewDisputeEvidence[]) => {
    const validEvidence = picked.filter(
      (item) =>
        item.fileSize === undefined ||
        item.fileSize <= MAX_REVIEW_DISPUTE_EVIDENCE_BYTES,
    );

    if (validEvidence.length !== picked.length) {
      Toast.show({
        type: "error",
        text1: "Some files were too large",
        text2: "Evidence files must be 10 MB or smaller.",
      });
    }

    setEvidence((current) => [
      ...current,
      ...validEvidence.slice(0, MAX_REVIEW_DISPUTE_EVIDENCE - current.length),
    ]);
  };

  const pickImages = async () => {
    if (isPickingImages || remainingSlots <= 0) {
      return;
    }

    setIsPickingImages(true);

    try {
      const picked = await pickReviewDisputeImages(remainingSlots);
      addPickedEvidence(picked);
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to attach image",
        text2:
          "The selected image could not be accessed. Try choosing it again.",
      });
    } finally {
      setIsPickingImages(false);
    }
  };

  const pickDocuments = async () => {
    if (isPickingDocuments || remainingSlots <= 0) {
      return;
    }

    setIsPickingDocuments(true);

    try {
      const picked = await pickReviewDisputeDocuments(remainingSlots);
      addPickedEvidence(picked);
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to attach document",
        text2:
          "The selected file could not be accessed. Try choosing it again.",
      });
    } finally {
      setIsPickingDocuments(false);
    }
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!reason) {
      nextErrors.reason = "Select a reason for this dispute.";
    }

    if (!description.trim()) {
      nextErrors.description =
        "Explain why this review should be investigated.";
    }

    setErrors(nextErrors);

    const isValid = Object.keys(nextErrors).length === 0;

    if (!isValid) {
      Toast.show({
        type: "error",
        text1: "Complete the required fields",
        text2: "Select a dispute reason and provide your explanation.",
      });
    }

    return isValid;
  };

  const submit = async () => {
    if (!validate() || !reason) {
      return;
    }

    try {
      const dispute = await createDispute.mutateAsync({
        reviewId,
        reason,
        description: description.trim(),
      });

      let failedUploads = 0;

      for (const item of evidence) {
        try {
          await addEvidence.mutateAsync({
            disputeId: dispute.id,
            evidence: item,
          });
        } catch {
          failedUploads += 1;
        }
      }

      if (failedUploads > 0) {
        Toast.show({
          type: "info",
          text1: "Dispute submitted",
          text2: `${failedUploads} evidence file${
            failedUploads === 1 ? "" : "s"
          } could not be uploaded. You can retry from the dispute page.`,
        });
      } else {
        Toast.show({
          type: "success",
          text1: "Dispute submitted",
          text2: "We'll notify you when an administrator reviews it.",
        });
      }

      router.replace({
        pathname: "/(merchant)/review-disputes/[disputeId]",
        params: {
          disputeId: String(dispute.id),
        },
      });
    } catch (caughtError) {
      const response = caughtError as ApiResponse<unknown>;

      if (!response.success) {
        Toast.show({
          type: "error",
          text1: "Unable to submit dispute",
          text2: response.message || "Review your information and try again.",
        });
        const descriptionError = getFieldError(response, "description");

        if (descriptionError) {
          setErrors((current) => ({
            ...current,
            description: descriptionError,
          }));
        }

        if (!handleSystemError(response)) {
          Toast.show({
            type: "error",
            text1: "Unable to submit dispute",
            text2: response.message || "Review your information and try again.",
          });
        }
      }
    }
  };

  if (isBusinessLoading || (business && isReviewsLoading)) {
    return (
      <View className="flex-1 bg-background">
        {/* Loading form content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-6"
        >
          <CreateReviewDisputeSkeleton />
        </ScrollView>

        {/* Loading submit footer */}
        <View
          className="bg-surface"
          style={{
            paddingBottom: tabBarSpacing,
          }}
        >
          <CreateReviewDisputeFooterSkeleton />
        </View>
      </View>
    );
  }

  if (error || !business || !review) {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          size="small"
          icon="comment-alert-outline"
          title="Unable to open this review"
          description="The review may no longer be available. Refresh your reviews and try again."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => {
            void Promise.all([refetchBusiness(), refetchReviews()]);
          }}
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Dispute form */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-6"
        >
          <CreateReviewDisputeFormContent
            review={review}
            reason={reason}
            description={description}
            evidence={evidence}
            errors={errors}
            remainingSlots={remainingSlots}
            isSubmitting={isSubmitting}
            isPickingImages={isPickingImages}
            isPickingDocuments={isPickingDocuments}
            onReasonPress={() => presentBottomSheet(reasonSheetRef)}
            onDescriptionChange={(value) => {
              setDescription(value);

              setErrors((current) => ({
                ...current,
                description: undefined,
              }));
            }}
            onPickImages={() => void pickImages()}
            onPickDocuments={() => void pickDocuments()}
            onRemoveEvidence={(index) => {
              setEvidence((current) =>
                current.filter((_, itemIndex) => itemIndex !== index),
              );
            }}
          />
        </ScrollView>

        {/* Submit action */}
        <View className="bg-surface">
          <CreateReviewDisputeFooter
            isSubmitting={isSubmitting}
            onSubmit={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Reason picker */}
      <SelectionBottomSheet
        sheetRef={reasonSheetRef}
        title="Dispute reason"
        description="Choose the reason that best describes your concern."
        options={REVIEW_DISPUTE_REASON_OPTIONS}
        selectedValue={reason ?? undefined}
        onSelect={(value) => {
          setReason(value as ReviewDisputeReason);

          setErrors((current) => ({
            ...current,
            reason: undefined,
          }));
        }}
      />
    </View>
  );
}
