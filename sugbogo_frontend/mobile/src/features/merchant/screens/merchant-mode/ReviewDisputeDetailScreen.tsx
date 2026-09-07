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
 * Shows one canonical merchant dispute record with history and evidence.
 *
 * Evidence editing and withdrawal are exposed only while the backend record is
 * pending, with mutations refreshing both detail and list caches.
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
        await addEvidence.mutateAsync({ disputeId, evidence: item });
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
      Toast.show({ type: "success", text1: "Evidence deleted" });
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
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      >
        {/* Dispute summary */}
        <View className="rounded-card border border-border-primary bg-surface p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-text-primary">
                Dispute attempt {dispute.attempt_number}
              </Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Submitted {formatDate(dispute.created_at)}
              </Text>
            </View>
            <ReviewDisputeStatusBadge status={dispute.status} />
          </View>

          {dispute.resolved_at && (
            <Text className="mt-3 text-xs text-text-secondary">
              Resolved {formatDate(dispute.resolved_at)}
            </Text>
          )}
        </View>

        {/* Disputed review */}
        <View className="mt-6">
          <Text className="mb-2 text-base font-bold text-text-primary">
            Disputed review
          </Text>
          <DisputedReviewContext review={dispute.review} />
        </View>

        {/* Merchant explanation */}
        <View className="mt-6 rounded-card border border-border-primary bg-surface p-4">
          <Text className="text-base font-bold text-text-primary">
            Your dispute
          </Text>
          <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Reason
          </Text>
          <Text className="mt-1 text-sm text-text-primary">
            {REVIEW_DISPUTE_REASON_LABELS[dispute.reason]}
          </Text>
          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Description
          </Text>
          <Text className="mt-1 text-sm leading-6 text-text-primary">
            {dispute.description}
          </Text>
        </View>

        {/* Resolution information */}
        {dispute.admin_notes && (
          <View className="mt-6 rounded-card border border-border-primary bg-surface p-4">
            <Text className="text-base font-bold text-text-primary">
              Administrator notes
            </Text>
            <Text className="mt-2 text-sm leading-6 text-text-secondary">
              {dispute.admin_notes}
            </Text>
          </View>
        )}

        {/* Supporting evidence */}
        <View className="mt-6">
          <Text className="text-base font-bold text-text-primary">
            Supporting evidence
          </Text>
          {dispute.evidence.length === 0 ? (
            <View className="mt-2 rounded-card border border-border-primary bg-surface px-4 py-6">
              <Text className="text-center text-sm text-text-secondary">
                No evidence has been added.
              </Text>
            </View>
          ) : (
            <View className="mt-2 gap-2">
              {dispute.evidence.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center rounded-xl border border-border-primary bg-surface p-2"
                >
                  <Pressable
                    onPress={() => void Linking.openURL(item.url)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${item.file_name ?? "evidence"}`}
                    className="min-h-14 min-w-0 flex-1 cursor-pointer flex-row items-center active:opacity-70"
                  >
                    {item.type === "image" ? (
                      <Image
                        source={{ uri: item.url }}
                        className="h-14 w-14 rounded-lg bg-surface-secondary"
                        contentFit="cover"
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
                      size={19}
                      color={theme.extends.colors.text.tertiary}
                    />
                  </Pressable>

                  {isPending && (
                    <Pressable
                      onPress={() => setEvidenceToDelete(item)}
                      disabled={deleteEvidence.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.file_name ?? "evidence"}`}
                      className="ml-2 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full active:bg-red-50"
                    >
                      <MaterialCommunityIcons
                        name="delete-outline"
                        size={21}
                        color={theme.extends.colors.error}
                      />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

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
        </View>

        {/* Previous attempts */}
        <View className="mt-6">
          <Text className="text-base font-bold text-text-primary">
            Previous disputes
          </Text>
          {dispute.previous_disputes.length === 0 ? (
            <View className="mt-2 rounded-card border border-border-primary bg-surface px-4 py-6">
              <Text className="text-center text-sm text-text-secondary">
                This is the first dispute attempt for this review.
              </Text>
            </View>
          ) : (
            <View className="mt-2 gap-2">
              {dispute.previous_disputes.map((attempt, index) => (
                <View
                  key={attempt.id}
                  className="rounded-xl border border-border-primary bg-surface p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-semibold text-text-primary">
                        Attempt {dispute.attempt_number - index - 1}
                      </Text>
                      <Text className="mt-1 text-xs text-text-secondary">
                        {formatDate(attempt.created_at)}
                      </Text>
                    </View>
                    <ReviewDisputeStatusBadge status={attempt.status} />
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/(merchant)/review-disputes/[disputeId]",
                        params: { disputeId: String(attempt.id) },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View dispute attempt ${
                      dispute.attempt_number - index - 1
                    }`}
                    className="mt-3 min-h-11 cursor-pointer self-start justify-center active:opacity-70"
                  >
                    <Text className="text-sm font-bold text-brand">
                      View dispute →
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pending dispute action */}
        {isPending && (
          <Button
            title="Withdraw dispute"
            variant="danger"
            onPress={() => setIsWithdrawVisible(true)}
            className="mt-6 rounded-full"
            fontClassName="font-bold"
          />
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
