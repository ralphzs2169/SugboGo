import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
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
  onReported?: () => void;
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
  onReported,
}: Props) {
  const { mutateAsync: reportReview, isPending } = useReportReview(businessId);
  const submittingRef = useRef(false);
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [explanation, setExplanation] = useState("");
  const [explanationError, setExplanationError] = useState<string | undefined>();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const trimmedExplanation = explanation.trim();
  const explanationRequired = reason === "other";
  const canSubmit = Boolean(reason) && !isPending;

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isPending) {
          sheetRef.current?.dismiss();
        }
        return true;
      },
    );

    return () => subscription.remove();
  }, [isPending, isSheetOpen, sheetRef]);

  function resetForm() {
    setReason(null);
    setExplanation("");
    setExplanationError(undefined);
    setSubmissionError(null);
  }

  async function submitReport() {
    if (!reason || submittingRef.current || isPending) {
      return;
    }

    if (explanationRequired && !trimmedExplanation) {
      setExplanationError("Please explain why you are reporting this review.");
      return;
    }

    if (trimmedExplanation.length > 0 && trimmedExplanation.length < 10) {
      setExplanationError("Explanation must be at least 10 characters long.");
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
      onReported?.();
      Toast.show({
        type: "info",
        text1: "Review reported",
        visibilityTime: 1500,
      });
      sheetRef.current?.dismiss();
      resetForm();
    } catch (error) {
      const response = error as ApiResponse<unknown>;
      if (!response.success && response.code === "ALREADY_REPORTED") {
        onReported?.();
        Toast.show({
          type: "info",
          text1: "You already reported this review",
        });
        sheetRef.current?.dismiss();
        resetForm();
        return;
      }
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
        setIsSheetOpen(index >= 0);
        if (index < 0) {
          resetForm();
        }
      }}
      onDismiss={() => {
        setIsSheetOpen(false);
        resetForm();
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
                  setExplanationError(undefined);
                  setSubmissionError(null);
                }}
                className={`min-h-11 flex-row items-center gap-3 rounded-xl px-3 py-2 active:opacity-70 bg-surface`}
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
              setExplanationError(undefined);
              setSubmissionError(null);
            }}
            onFocus={() => setExplanationError(undefined)}
            placeholder="Share more context about your report"
            accessibilityLabel="Additional details"
            maxLength={500}
            minLength={10}
            showCharacterCount
            helperText="Up to 500 characters"
            error={explanationError}
            editable={!isPending}
            InputComponent={BottomSheetTextInput}
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
