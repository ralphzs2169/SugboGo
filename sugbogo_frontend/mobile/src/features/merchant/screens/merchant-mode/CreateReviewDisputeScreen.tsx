import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import ReviewContent from "@/features/explore/components/business-profile/review-section/ReviewContent";
import { useBusinessReviews } from "@/features/explore/hooks/useBusinessReviews";
import Button from "@/shared/components/Button";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import ErrorState from "@/shared/components/ErrorState";
import FormSelect from "@/shared/components/form/FormSelect";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import EvidencePickerActions from "../../components/review-disputes/EvidencePickerActions";
import SelectedEvidenceList from "../../components/review-disputes/SelectedEvidenceList";
import {
  MAX_REVIEW_DISPUTE_EVIDENCE,
  MAX_REVIEW_DISPUTE_EVIDENCE_BYTES,
  REVIEW_DISPUTE_REASON_LABELS,
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
 * Collects a merchant dispute and optional evidence as one guided experience.
 *
 * The dispute is created first, then evidence is uploaded sequentially so the
 * backend's separate upload contract and five-file limit remain authoritative.
 */
export default function CreateReviewDisputeScreen({ reviewId }: Props) {
  const reasonSheetRef = useRef<BottomSheetModal | null>(null);
  const [reason, setReason] = useState<ReviewDisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<LocalReviewDisputeEvidence[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const {
    business,
    isLoading: isBusinessLoading,
    error: businessError,
    refetch: refetchBusiness,
  } = useMerchantBusinessProfile();

  const businessId = business?.id ?? 0;
  const {
    reviews,
    isLoading: isReviewsLoading,
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
    addPickedEvidence(await pickReviewDisputeImages(remainingSlots));
  };

  const pickDocuments = async () => {
    addPickedEvidence(await pickReviewDisputeDocuments(remainingSlots));
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
    return Object.keys(nextErrors).length === 0;
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
          text2: `${failedUploads} evidence file${failedUploads === 1 ? "" : "s"} could not be uploaded. You can retry from the dispute page.`,
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
        params: { disputeId: String(dispute.id) },
      });
    } catch (caughtError) {
      const response = caughtError as ApiResponse<unknown>;

      if (!response.success) {
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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.extends.colors.brand} />
      </View>
    );
  }

  if (error || !business || !review) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          size="small"
          icon="comment-alert-outline"
          title="Unable to open this review"
          description="The review may no longer be available. Refresh your reviews and try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => {
            void Promise.all([refetchBusiness(), refetchReviews()]);
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 pb-8 pt-4"
        >
          {/* Screen introduction */}
          <Text className="text-sm leading-5 text-text-secondary">
            Tell us why this customer review may violate SugboGo&apos;s review
            policies. An administrator will evaluate your request.
          </Text>

          {/* Review context */}
          <View className="mt-5">
            <Text className="mb-2 text-base font-bold text-text-primary">
              Review being disputed
            </Text>

            <View className="rounded-card border border-border-primary bg-surface p-4">
              <ReviewContent review={review} perspective="merchant" />
            </View>
          </View>

          {/* Dispute explanation */}
          <View className="mt-6 gap-4">
            <FormSelect
              label="Dispute reason"
              value={reason ? REVIEW_DISPUTE_REASON_LABELS[reason] : undefined}
              placeholder="Select a reason"
              required
              error={errors.reason}
              onPress={() => presentBottomSheet(reasonSheetRef)}
            />

            <FormTextArea
              label="Description"
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                setErrors((current) => ({
                  ...current,
                  description: undefined,
                }));
              }}
              placeholder="Explain what is inaccurate or violates the review policy."
              required
              maxLength={2000}
              error={errors.description}
              helperText="Include specific details that will help the administrator investigate."
            />
          </View>

          {/* Optional evidence */}
          <View className="mt-6 rounded-card border border-border-primary bg-background p-4">
            <Text className="text-base font-bold text-text-primary">
              Supporting evidence
            </Text>
            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              Optional. Add images, PDF, DOC, or DOCX files up to 10 MB each.
            </Text>

            <SelectedEvidenceList
              evidence={evidence}
              disabled={isSubmitting}
              onRemove={(index) => {
                setEvidence((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                );
              }}
            />

            <View className="mt-4">
              <EvidencePickerActions
                remainingSlots={remainingSlots}
                disabled={isSubmitting}
                onPickImages={() => void pickImages()}
                onPickDocuments={() => void pickDocuments()}
              />
            </View>
          </View>

          {/* Submit action */}
          <Button
            title={
              evidence.length > 0
                ? "Submit dispute and evidence"
                : "Submit dispute"
            }
            onPress={submit}
            loading={isSubmitting}
            className="mt-6 rounded-full"
            fontClassName="font-bold"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Reason picker */}
      <SelectionBottomSheet
        sheetRef={reasonSheetRef}
        title="Dispute reason"
        description="Choose the reason that best describes the policy concern."
        options={REVIEW_DISPUTE_REASON_OPTIONS}
        selectedValue={reason ?? undefined}
        onSelect={(value) => {
          setReason(value as ReviewDisputeReason);
          setErrors((current) => ({ ...current, reason: undefined }));
        }}
      />
    </SafeAreaView>
  );
}
