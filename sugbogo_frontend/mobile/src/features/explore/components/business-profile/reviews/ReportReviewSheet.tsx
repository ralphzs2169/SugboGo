import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import type { ReviewReportReason } from "../../../api/reviewBusiness.service";
import { useReportReview } from "../../../hooks/useBusinessReviews";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  businessId: number;
  reviewId: number;
};

const REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse or Harassment" },
  { value: "misinformation", label: "False or Misleading Information" },
  { value: "off_topic", label: "Off-topic or Irrelevant" },
  { value: "private_information", label: "Personal or Private Information" },
  { value: "other", label: "Other" },
];

export default function ReportReviewSheet({
  sheetRef,
  businessId,
  reviewId,
}: Props) {
  const { mutateAsync: reportReview, isPending } = useReportReview(businessId);
  const submittingRef = useRef(false);
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [explanation, setExplanation] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const trimmedExplanation = explanation.trim();
  const explanationRequired = reason === "other";
  const explanationError =
    explanationRequired && !trimmedExplanation
      ? "Please explain why you are reporting this review."
      : undefined;
  const canSubmit = Boolean(reason) && !explanationError && !isPending;

  function resetForm() {
    setReason(null);
    setExplanation("");
    setSubmissionError(null);
  }

  async function submitReport() {
    if (!reason || explanationError || submittingRef.current || isPending) {
      return;
    }

    submittingRef.current = true;
    setSubmissionError(null);
    try {
      await reportReview({
        reviewId,
        reportType: reason,
        explanation: trimmedExplanation || undefined,
      });
      Toast.show({
        type: "info",
        text1: "Review reported",
        visibilityTime: 1500,
      });
      sheetRef.current?.dismiss();
      resetForm();
    } catch (error) {
      const response = error as ApiResponse<unknown>;
      const message = response.message || "Please try again.";
      setSubmissionError(message);
      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to report review",
          text2: message,
        });
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      onChange={(index) => {
        if (index < 0) {
          resetForm();
        }
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
        />
      )}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-screen-x pb-10 pt-2"
      >
        <AppText weight="bold" className="text-xl text-text-primary">
          Report Review
        </AppText>
        <AppText className="mt-1 text-sm text-text-secondary">
          Why are you reporting this review?
        </AppText>

        <View className="mt-4 gap-1">
          {REPORT_REASONS.map((option) => {
            const selected = reason === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected, disabled: isPending }}
                disabled={isPending}
                onPress={() => {
                  setReason(option.value);
                  setSubmissionError(null);
                }}
                className={`min-h-11 flex-row items-center gap-3 rounded-xl px-3 py-2 active:opacity-70 ${
                  selected ? "bg-brand/10" : "bg-surface"
                }`}
              >
                <MaterialCommunityIcons
                  name={selected ? "radiobox-marked" : "radiobox-blank"}
                  size={20}
                  color={
                    selected
                      ? theme.extends.colors.brand
                      : theme.extends.colors.text.secondary
                  }
                />
                <AppText className="flex-1 text-sm text-text-primary">
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-4">
          <FormTextArea
            label={
              explanationRequired
                ? "Additional details (Required)"
                : "Additional details (Optional)"
            }
            value={explanation}
            onChangeText={(value) => {
              setExplanation(value.slice(0, 500));
              setSubmissionError(null);
            }}
            placeholder="Share more context about your report"
            maxLength={500}
            error={explanationError}
            editable={!isPending}
            InputComponent={BottomSheetTextInput}
            rightElement={
              <AppText className="text-xs text-text-secondary">
                {explanation.length}/500
              </AppText>
            }
          />
        </View>

        {submissionError && (
          <AppText className="mt-3 text-xs font-medium text-text-error">
            {submissionError}
          </AppText>
        )}

        <View className="mt-5 flex-row gap-3">
          <View className="flex-1">
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => sheetRef.current?.dismiss()}
              disabled={isPending}
              rounded="full"
            />
          </View>
          <View className="flex-1">
            <Button
              title="Submit Report"
              onPress={submitReport}
              loading={isPending}
              disabled={!canSubmit}
              rounded="full"
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
