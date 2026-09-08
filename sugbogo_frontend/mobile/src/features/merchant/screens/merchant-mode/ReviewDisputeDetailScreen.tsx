import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";

import DisputedReviewContext from "../../components/review-disputes/DisputedReviewContext";
import EvidencePickerActions from "../../components/review-disputes/EvidencePickerActions";
import ReviewDisputeSection from "../../components/review-disputes/ReviewDisputeSection";
import ReviewDisputeStatusBadge from "../../components/review-disputes/ReviewDisputeStatusBadge";
import {
  MAX_REVIEW_DISPUTE_EVIDENCE,
  MAX_REVIEW_DISPUTE_EVIDENCE_BYTES,
  REVIEW_DISPUTE_REASON_LABELS,
} from "../../constants/reviewDispute.constants";
import {
  useAddReviewDisputeEvidence,
  useDeleteReviewDisputeEvidence,
  useReviewDisputeDetail,
  useWithdrawReviewDispute,
} from "../../hooks/review-disputes/useReviewDisputes";
import type {
  LocalReviewDisputeEvidence,
  ReviewDisputeEvidence,
} from "../../types/review-disputes/reviewDispute.types";
import {
  pickReviewDisputeDocuments,
  pickReviewDisputeImages,
} from "../../utils/review-disputes/pickReviewDisputeEvidence.utils";

type Props = {
  disputeId: number;
};

/**
 * Displays a merchant review dispute with its review context, evidence,
 * moderation outcome, and previous dispute attempts.
 *
 * Pending disputes allow evidence management and withdrawal while resolved
 * disputes remain available as read-only history.
 */
export default function ReviewDisputeDetailScreen({ disputeId }: Props) {
  const [evidenceToDelete, setEvidenceToDelete] =
    useState<ReviewDisputeEvidence | null>(null);
  const [isWithdrawVisible, setIsWithdrawVisible] = useState(false);

  const { dispute, isLoading, isRefetching, error, refetch } =
    useReviewDisputeDetail(disputeId);

  const addEvidence = useAddReviewDisputeEvidence();
  const deleteEvidence = useDeleteReviewDisputeEvidence();
  const withdrawDispute = useWithdrawReviewDispute(dispute?.business_id ?? 0);

  const isPending = dispute?.status === "pending";

  const remainingSlots = dispute
    ? MAX_REVIEW_DISPUTE_EVIDENCE - dispute.evidence.length
    : 0;

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load dispute",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  const showMutationError = (caughtError: unknown, title: string) => {
    const response = caughtError as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: title,
        text2: response.message || "Please try again.",
      });
    }
  };

  const uploadEvidence = async (picked: LocalReviewDisputeEvidence[]) => {
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

    let failedUploads = 0;
    let firstUploadError: unknown;

    for (const item of validEvidence) {
      try {
        await addEvidence.mutateAsync({
          disputeId,
          evidence: item,
        });
      } catch (caughtError) {
        failedUploads += 1;
        firstUploadError ??= caughtError;
      }
    }

    if (failedUploads > 0) {
      const response = firstUploadError as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Some evidence was not uploaded",
          text2: response.message || "Try adding the failed files again.",
        });
      }

      return;
    }

    if (validEvidence.length > 0) {
      Toast.show({
        type: "success",
        text1: "Evidence added",
      });
    }
  };

  const pickImages = async () => {
    await uploadEvidence(await pickReviewDisputeImages(remainingSlots));
  };

  const pickDocuments = async () => {
    await uploadEvidence(await pickReviewDisputeDocuments(remainingSlots));
  };

  const confirmDeleteEvidence = async () => {
    if (!evidenceToDelete) {
      return;
    }

    try {
      await deleteEvidence.mutateAsync({
        disputeId,
        evidenceId: evidenceToDelete.id,
      });

      setEvidenceToDelete(null);

      Toast.show({
        type: "success",
        text1: "Evidence deleted",
      });
    } catch (caughtError) {
      showMutationError(caughtError, "Unable to delete evidence");
    }
  };

  const confirmWithdraw = async () => {
    try {
      await withdrawDispute.mutateAsync({ disputeId });

      setIsWithdrawVisible(false);

      Toast.show({
        type: "success",
        text1: "Dispute withdrawn",
      });
    } catch (caughtError) {
      showMutationError(caughtError, "Unable to withdraw dispute");
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.extends.colors.brand} />
      </View>
    );
  }

  if (error || !dispute) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          size="small"
          icon="file-alert-outline"
          title="Unable to load dispute"
          description="We couldn't load this review dispute right now."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      >
        {/* Dispute summary */}
        <ReviewDisputeSection>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-text-primary">
                Dispute attempt {dispute.attempt_number}
              </Text>

              <Text className="mt-1 text-xs text-text-secondary">
                Submitted {formatDate(dispute.created_at)}
              </Text>

              {dispute.resolved_at && (
                <Text className="mt-1 text-xs text-text-secondary">
                  Resolved {formatDate(dispute.resolved_at)}
                </Text>
              )}
            </View>

            <ReviewDisputeStatusBadge status={dispute.status} />
          </View>
        </ReviewDisputeSection>

        {/* Disputed review */}
        <ReviewDisputeSection title="Disputed review">
          <DisputedReviewContext review={dispute.review} />
        </ReviewDisputeSection>

        {/* Merchant dispute */}
        <ReviewDisputeSection title="Your dispute">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Reason
            </Text>

            <Text className="mt-1 text-sm font-medium text-text-primary">
              {REVIEW_DISPUTE_REASON_LABELS[dispute.reason]}
            </Text>
          </View>

          <View className="mt-5">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Details
            </Text>

            <Text className="mt-1 text-sm leading-6 text-text-primary">
              {dispute.description}
            </Text>
          </View>
        </ReviewDisputeSection>

        {/* Administrator resolution */}
        {dispute.admin_notes && (
          <ReviewDisputeSection
            title="Administrator notes"
            description="This is the administrator's explanation for the dispute decision."
          >
            <Text className="text-sm leading-6 text-text-primary">
              {dispute.admin_notes}
            </Text>
          </ReviewDisputeSection>
        )}

        {/* Supporting evidence */}
        <ReviewDisputeSection
          title="Supporting evidence"
          description={
            isPending
              ? "Evidence can be added or removed while this dispute is pending."
              : "Evidence submitted with this dispute."
          }
        >
          {dispute.evidence.length === 0 ? (
            <View className="rounded-xl bg-surface-secondary px-4 py-5">
              <Text className="text-center text-sm text-text-secondary">
                No evidence has been added.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {dispute.evidence.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center rounded-xl border border-border-primary bg-surface px-2 py-2"
                >
                  {/* Evidence file */}
                  <Pressable
                    onPress={() => void Linking.openURL(item.url)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${item.file_name ?? "evidence"}`}
                    className="min-h-14 min-w-0 flex-1 cursor-pointer flex-row items-center active:opacity-70"
                  >
                    {item.type === "image" ? (
                      <Image
                        source={{ uri: item.url }}
                        contentFit="cover"
                        transition={150}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <View className="h-14 w-14 items-center justify-center rounded-lg bg-brand/10">
                        <MaterialCommunityIcons
                          name="file-document-outline"
                          size={27}
                          color={theme.extends.colors.brand}
                        />
                      </View>
                    )}

                    <View className="ml-3 min-w-0 flex-1">
                      <Text
                        className="text-sm font-semibold text-text-primary"
                        numberOfLines={1}
                      >
                        {item.file_name ?? "Evidence file"}
                      </Text>

                      <Text className="mt-0.5 text-xs capitalize text-text-secondary">
                        {item.type}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="open-in-new"
                      size={18}
                      color={theme.extends.colors.text.tertiary}
                    />
                  </Pressable>

                  {/* Delete evidence */}
                  {isPending && (
                    <Pressable
                      onPress={() => setEvidenceToDelete(item)}
                      disabled={deleteEvidence.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${
                        item.file_name ?? "evidence"
                      }`}
                      className="ml-2 min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-full active:bg-red-50"
                    >
                      <MaterialCommunityIcons
                        name="delete-outline"
                        size={20}
                        color={theme.extends.colors.error}
                      />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Add evidence */}
          {isPending && (
            <View className="mt-4">
              <EvidencePickerActions
                remainingSlots={remainingSlots}
                disabled={addEvidence.isPending}
                onPickImages={() => void pickImages()}
                onPickDocuments={() => void pickDocuments()}
              />
            </View>
          )}
        </ReviewDisputeSection>

        {/* Previous attempts */}
        <ReviewDisputeSection
          title="Previous disputes"
          description={
            dispute.previous_disputes.length > 0
              ? "Earlier dispute attempts for this review."
              : undefined
          }
        >
          {dispute.previous_disputes.length === 0 ? (
            <View className="rounded-xl bg-surface-secondary px-4 py-5">
              <Text className="text-center text-sm text-text-secondary">
                This is the first dispute attempt for this review.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {dispute.previous_disputes.map((attempt, index) => {
                const attemptNumber = dispute.attempt_number - index - 1;

                return (
                  <View
                    key={attempt.id}
                    className="rounded-xl border border-border-primary bg-surface-secondary p-4"
                  >
                    {/* Attempt summary */}
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="font-semibold text-text-primary">
                          Attempt {attemptNumber}
                        </Text>

                        <Text className="mt-1 text-xs text-text-secondary">
                          {formatDate(attempt.created_at)}
                        </Text>
                      </View>

                      <ReviewDisputeStatusBadge status={attempt.status} />
                    </View>

                    {/* View attempt */}
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/(merchant)/review-disputes/[disputeId]",
                          params: {
                            disputeId: String(attempt.id),
                          },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`View dispute attempt ${attemptNumber}`}
                      className="mt-3 min-h-10 cursor-pointer self-start justify-center active:opacity-70"
                    >
                      <Text className="text-sm font-bold text-brand">
                        View dispute →
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ReviewDisputeSection>

        {/* Pending dispute action */}
        {isPending && (
          <View className="px-4 pt-3">
            <Button
              title="Withdraw dispute"
              variant="danger"
              onPress={() => setIsWithdrawVisible(true)}
              className="rounded-full"
              fontClassName="font-bold"
            />
          </View>
        )}
      </ScrollView>

      {/* Evidence deletion confirmation */}
      <ConfirmModal
        visible={Boolean(evidenceToDelete)}
        title="Delete evidence?"
        message="This file will be removed from your pending dispute."
        confirmText="Delete"
        destructive
        isLoading={deleteEvidence.isPending}
        loadingText="Deleting evidence..."
        onCancel={() => setEvidenceToDelete(null)}
        onConfirm={() => void confirmDeleteEvidence()}
      />

      {/* Withdrawal confirmation */}
      <ConfirmModal
        visible={isWithdrawVisible}
        title="Withdraw dispute?"
        message="The dispute and its evidence will remain in your history, but administrators will no longer review it."
        confirmText="Withdraw"
        destructive
        isLoading={withdrawDispute.isPending}
        loadingText="Withdrawing dispute..."
        onCancel={() => setIsWithdrawVisible(false)}
        onConfirm={() => void confirmWithdraw()}
      />
    </SafeAreaView>
  );
}
