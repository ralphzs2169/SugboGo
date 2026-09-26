import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import ReviewContent from "@/features/explore/components/business-profile/reviews/ReviewContent";
import type { BusinessReview } from "@/features/explore/types/review.types";
import AppText from "@/shared/components/AppText";
import FormSelect from "@/shared/components/form/FormSelect";
import FormTextArea from "@/shared/components/form/FormTextArea";

import EvidencePickerActions from "../EvidencePickerActions";
import ReviewDisputeSection from "../ReviewDisputeSection";
import SelectedEvidenceList from "../SelectedEvidenceList";
import {
  MAX_REVIEW_DISPUTE_EVIDENCE,
  REVIEW_DISPUTE_REASON_LABELS,
} from "../../../constants/reviewDispute.constants";
import type {
  LocalReviewDisputeEvidence,
  ReviewDisputeReason,
} from "../../../types/review-disputes/reviewDispute.types";

type FormErrors = {
  reason?: string;
  description?: string;
};

type Props = {
  review: BusinessReview;
  reason: ReviewDisputeReason | null;
  description: string;
  evidence: LocalReviewDisputeEvidence[];
  errors: FormErrors;
  remainingSlots: number;
  isSubmitting: boolean;
  isPickingImages: boolean;
  isPickingDocuments: boolean;
  onReasonPress: () => void;
  onDescriptionChange: (value: string) => void;
  onPickImages: () => void;
  onPickDocuments: () => void;
  onRemoveEvidence: (index: number) => void;
};

/**
 * Renders the editable content for creating a merchant review dispute.
 *
 * Groups the dispute process guidance, review context, dispute details, and
 * supporting evidence while leaving submission orchestration to the parent.
 */
export default function CreateReviewDisputeFormContent({
  review,
  reason,
  description,
  evidence,
  errors,
  remainingSlots,
  isSubmitting,
  isPickingImages,
  isPickingDocuments,
  onReasonPress,
  onDescriptionChange,
  onPickImages,
  onPickDocuments,
  onRemoveEvidence,
}: Props) {
  const evidenceCount = evidence.length;

  return (
    <>
      {/* Dispute process notice */}
      <View className="bg-info px-4 py-4">
        <View className="flex-row items-start">
          <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={17}
              color={theme.extends.colors.text.info}
            />
          </View>

          <View className="ml-3 flex-1">
            <AppText weight="semibold" className="text-sm text-text-primary">
              How disputes work
            </AppText>

            <AppText className="mt-1 text-sm leading-5 text-text-secondary">
              A SugboGo administrator will review your concern, the original
              review, and any evidence you provide.
            </AppText>
          </View>
        </View>
      </View>

      {/* Review being disputed */}
      <ReviewDisputeSection
        title="Review being disputed"
        description="This is the review you are disputing."
        showBorder={false}
        icon={
          <MaterialCommunityIcons
            name="message-alert-outline"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        }
      >
        <View className="rounded-xl border border-border-primary p-4">
          <ReviewContent
            review={review}
            perspective="merchant"
            showEngagement={false}
            showSpecialtyVouches={false}
          />
        </View>
      </ReviewDisputeSection>

      {/* Dispute details */}
      <ReviewDisputeSection
        title="Tell us your concern"
        description="Choose the reason that best matches your concern and provide enough context for the administrator to investigate."
        icon={
          <MaterialCommunityIcons
            name="pencil-outline"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        }
      >
        <View className="gap-5">
          <FormSelect
            label="Reason"
            value={reason ? REVIEW_DISPUTE_REASON_LABELS[reason] : undefined}
            placeholder="Select a reason"
            required
            error={errors.reason}
            onPress={onReasonPress}
          />

          <FormTextArea
            label="Details"
            value={description}
            onChangeText={onDescriptionChange}
            placeholder="Explain why this review should be investigated."
            required
            maxLength={2000}
            error={errors.description}
            helperText="Include specific facts, dates, or context that can help the administrator verify your claim."
          />
        </View>
      </ReviewDisputeSection>

      {/* Supporting evidence */}
      <ReviewDisputeSection
        title="Supporting evidence"
        description="Optional. Attach images or documents that support your claim."
        icon={
          <MaterialCommunityIcons
            name="paperclip"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        }
      >
        {/* Evidence summary */}
        <View className="mb-4">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {evidenceCount} {evidenceCount === 1 ? "file" : "files"} attached
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {remainingSlots} {remainingSlots === 1 ? "slot" : "slots"} remaining
          </AppText>
        </View>

        {/* Evidence files */}
        {evidenceCount === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-border-primary bg-surface-secondary px-5 py-7">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
              <MaterialCommunityIcons
                name="file-plus-outline"
                size={23}
                color={theme.extends.colors.text.tertiary}
              />
            </View>

            <AppText
              weight="semibold"
              className="mt-3 text-sm text-text-primary"
            >
              No evidence added
            </AppText>

            <AppText className="mt-1 text-center text-xs leading-5 text-text-secondary">
              Add photos or documents that support your dispute.
            </AppText>
          </View>
        ) : (
          <SelectedEvidenceList
            evidence={evidence}
            disabled={isSubmitting}
            onRemove={onRemoveEvidence}
          />
        )}

        {/* Evidence upload actions */}
        <View className="mt-4">
          <EvidencePickerActions
            remainingSlots={remainingSlots}
            disabled={isSubmitting}
            isPickingImages={isPickingImages}
            isPickingDocuments={isPickingDocuments}
            onPickImages={onPickImages}
            onPickDocuments={onPickDocuments}
          />

          <AppText className="mt-3 text-center text-xs text-text-tertiary">
            Up to 5 files · Images, PDF, DOC, or DOCX · 10 MB max each
          </AppText>
        </View>
      </ReviewDisputeSection>
    </>
  );
}
