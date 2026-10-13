import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { formatDate } from "@/shared/utils/date.utils";

import { useMyReviewReport } from "../../../hooks/useBusinessReviews";
import type { ReviewReportReason } from "../../../api/reviewBusiness.service";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  reviewId: number;
  isOpen: boolean;
  onDismiss: () => void;
};

const REASON_LABELS: Record<ReviewReportReason, string> = {
  spam: "Spam",
  abuse: "Abuse or Harassment",
  misinformation: "False or Misleading Information",
  off_topic: "Off-topic or Irrelevant",
  private_information: "Personal or Private Information",
  other: "Other",
};

const STATE_LABELS = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  withdrawn: "Withdrawn",
} as const;

/**
 * Read-only receipt for a report submitted by the current user.
 */
export default function ReviewReportReceiptSheet({
  sheetRef,
  reviewId,
  isOpen,
  onDismiss,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useMyReviewReport(
    reviewId,
    isOpen,
  );

  const closeSheet = () => {
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      maxDynamicContentSize={height * 0.85}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      onDismiss={onDismiss}
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
      >
        <View className="px-screen-x pt-3">
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: theme.extends.colors.background,
              }}
            >
              <MaterialCommunityIcons
                name="flag-outline"
                size={24}
                color={theme.extends.colors.text.secondary}
              />
            </View>

            <View className="min-w-0 flex-1">
              <AppText weight="bold" className="text-xl text-text-primary">
                Your report
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-secondary">
                Report details and status
              </AppText>
            </View>

            {data && (
              <View className="shrink-0 rounded-full border border-border-primary px-3 py-1.5">
                <AppText
                  weight="semibold"
                  className="text-xs text-text-secondary"
                >
                  {STATE_LABELS[data.state]}
                </AppText>
              </View>
            )}
          </View>

          <View className="my-5 border-t border-border-primary" />

          {/* Loading */}
          {isLoading ? (
            <View className="items-center gap-3 py-10">
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.text.secondary}
              />

              <AppText className="text-sm text-text-secondary">
                Loading your report...
              </AppText>
            </View>
          ) : isError ? (
            /* Error */
            <View className="items-center gap-3 py-7">
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={30}
                color={theme.extends.colors.text.secondary}
              />

              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                Couldn't load your report
              </AppText>

              <AppText className="text-center text-sm text-text-secondary">
                Please check your connection and try again.
              </AppText>

              <View className="mt-2">
                <Button
                  title="Retry"
                  variant="outline"
                  onPress={() => void refetch()}
                />
              </View>
            </View>
          ) : data ? (
            <View className="gap-5">
              {/* Report reason */}
              <View className="gap-2">
                <AppText
                  weight="medium"
                  className="text-xs text-text-secondary"
                >
                  Reason for reporting
                </AppText>

                <AppText
                  weight="semibold"
                  className="text-base text-text-primary"
                >
                  {REASON_LABELS[data.reason]}
                </AppText>
              </View>

              {/* Original explanation */}
              {data.explanation?.trim() ? (
                <View className="gap-2">
                  <AppText
                    weight="medium"
                    className="text-xs text-text-secondary"
                  >
                    Your explanation
                  </AppText>

                  <View
                    className="rounded-xl border border-border-primary p-4"
                    style={{
                      backgroundColor: theme.extends.colors.background,
                    }}
                  >
                    <AppText className="text-sm leading-6 text-text-primary">
                      {data.explanation}
                    </AppText>
                  </View>
                </View>
              ) : null}

              {/* Submission date */}
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={17}
                  color={theme.extends.colors.text.tertiary}
                />

                <AppText className="text-sm text-text-secondary">
                  Submitted {formatDate(data.submitted_at)}
                </AppText>
              </View>

              {/* Informational message */}
              <View
                className="flex-row items-start gap-3 rounded-xl p-3.5"
                style={{
                  backgroundColor: theme.extends.colors.info,
                }}
              >
                <MaterialCommunityIcons
                  name="information-outline"
                  size={19}
                  color={theme.extends.colors.text.info}
                />

                <View className="min-w-0 flex-1">
                  <AppText className="text-xs leading-5 text-text-secondary">
                    Reports don't automatically remove reviews. Administrators
                    evaluate reported content before making a decision.
                  </AppText>
                </View>
              </View>
            </View>
          ) : (
            <View className="items-center gap-2 py-8">
              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                Report unavailable
              </AppText>

              <AppText className="text-center text-sm text-text-secondary">
                We couldn't find a report for this review.
              </AppText>
            </View>
          )}

          {/* Close action */}
          <View className="mt-6">
            <Button title="Close" onPress={closeSheet} rounded="full" />
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
