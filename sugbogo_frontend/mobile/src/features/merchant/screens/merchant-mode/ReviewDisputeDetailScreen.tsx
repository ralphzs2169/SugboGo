import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import ReviewDisputeAdminNotesSection from "../../components/review-disputes/dispute-detail-screen/ReviewDisputeAdminNotesSection";
import ReviewDisputeDetailSkeleton from "../../components/review-disputes/dispute-detail-screen/ReviewDisputeDetailSkeleton";
import ReviewDisputeEvidenceSection from "../../components/review-disputes/dispute-detail-screen/ReviewDisputeEvidenceSection";
import ReviewDisputeHistorySection from "../../components/review-disputes/dispute-detail-screen/ReviewDisputeHistorySection";
import ReviewDisputeOverviewSection from "../../components/review-disputes/dispute-detail-screen/ReviewDisputeOverviewSection";
import ReviewDisputeStickyHeader from "../../components/review-disputes/dispute-detail-screen/ReviewDisputeStickyHeader";
import ReviewDisputedReviewSection from "../../components/review-disputes/dispute-detail-screen/ReviewDisputedReviewSection";
import ReviewDisputeSection from "../../components/review-disputes/ReviewDisputeSection";
import {
  MAX_REVIEW_DISPUTE_EVIDENCE,
  MAX_REVIEW_DISPUTE_EVIDENCE_BYTES,
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

type EvidenceAction = "images" | "documents" | null;

/**
 * Displays a merchant review dispute with its review context, evidence,
 * moderation outcome, and previous dispute attempts.
 *
 * Pending disputes allow evidence management and withdrawal, while a compact
 * sticky context bar preserves dispute identity after the overview scrolls away.
 */
export default function ReviewDisputeDetailScreen({ disputeId }: Props) {
  const [evidenceToDelete, setEvidenceToDelete] =
    useState<ReviewDisputeEvidence | null>(null);
  const [isWithdrawVisible, setIsWithdrawVisible] = useState(false);
  const [evidenceAction, setEvidenceAction] = useState<EvidenceAction>(null);
  const [overviewHeight, setOverviewHeight] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;

  const { dispute, isLoading, isRefetching, error, refetch } =
    useReviewDisputeDetail(disputeId);

  const addEvidence = useAddReviewDisputeEvidence();
  const deleteEvidence = useDeleteReviewDisputeEvidence();
  const withdrawDispute = useWithdrawReviewDispute(dispute?.business_id ?? 0);

  const isPending = dispute?.status === "pending";

  const remainingSlots = dispute
    ? MAX_REVIEW_DISPUTE_EVIDENCE - dispute.evidence.length
    : 0;

  const contextRevealStart = Math.max(overviewHeight - 48, 0);
  const contextRevealEnd = Math.max(overviewHeight, 1);

  const contextOpacity = scrollY.interpolate({
    inputRange: [contextRevealStart, contextRevealEnd],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

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
    setEvidenceAction("images");

    try {
      const picked = await pickReviewDisputeImages(remainingSlots);
      await uploadEvidence(picked);
    } finally {
      setEvidenceAction(null);
    }
  };

  const pickDocuments = async () => {
    setEvidenceAction("documents");

    try {
      const picked = await pickReviewDisputeDocuments(remainingSlots);
      await uploadEvidence(picked);
    } finally {
      setEvidenceAction(null);
    }
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
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <ScrollView showsVerticalScrollIndicator={false}>
          <ReviewDisputeDetailSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !dispute) {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          size="small"
          icon="file-alert-outline"
          title="Unable to load dispute"
          description="We couldn't load this review dispute right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void refetch()}
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      {/* Dispute content */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
          },
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      >
        {/* Dispute overview */}
        <View
          onLayout={(event) => {
            setOverviewHeight(event.nativeEvent.layout.height);
          }}
        >
          <ReviewDisputeOverviewSection
            attemptNumber={dispute.attempt_number}
            createdAt={dispute.created_at}
            resolvedAt={dispute.resolved_at}
            status={dispute.status}
            reason={dispute.reason}
          />
        </View>

        {/* Disputed review and merchant explanation */}
        <ReviewDisputeSection
          title="Disputed review"
          showBorder={false}
          icon={
            <MaterialCommunityIcons
              name="message-alert-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          }
        >
          <ReviewDisputedReviewSection
            review={dispute.review}
            reason={dispute.reason}
            description={dispute.description}
          />
        </ReviewDisputeSection>

        {/* Administrator notes */}
        {dispute.admin_notes && (
          <ReviewDisputeSection
            title="Administrator notes"
            showBorder={false}
            icon={
              <MaterialCommunityIcons
                name="shield-account-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            }
          >
            <ReviewDisputeAdminNotesSection notes={dispute.admin_notes} />
          </ReviewDisputeSection>
        )}

        {/* Supporting evidence */}
        <ReviewDisputeSection
          title="Supporting evidence"
          description={isPending ? "" : "Evidence submitted with this dispute."}
          icon={
            <MaterialCommunityIcons
              name="paperclip"
              size={21}
              color={theme.extends.colors.text.secondary}
            />
          }
        >
          <ReviewDisputeEvidenceSection
            evidence={dispute.evidence}
            isPending={isPending}
            remainingSlots={remainingSlots}
            isAddingEvidence={addEvidence.isPending}
            isDeletingEvidence={deleteEvidence.isPending}
            isPickingImages={evidenceAction === "images"}
            isPickingDocuments={evidenceAction === "documents"}
            onPickImages={() => void pickImages()}
            onPickDocuments={() => void pickDocuments()}
            onRequestDelete={setEvidenceToDelete}
          />
        </ReviewDisputeSection>

        {/* Previous dispute attempts */}
        <ReviewDisputeSection
          title="Previous disputes"
          description={
            dispute.previous_disputes.length > 0
              ? "Earlier dispute attempts for this review."
              : undefined
          }
          icon={
            <MaterialCommunityIcons
              name="history"
              size={21}
              color={theme.extends.colors.text.secondary}
            />
          }
        >
          <ReviewDisputeHistorySection
            currentAttemptNumber={dispute.attempt_number}
            previousDisputes={dispute.previous_disputes}
            onViewAttempt={(attemptId) =>
              router.push({
                pathname: "/(merchant)/review-disputes/[disputeId]",
                params: {
                  disputeId: String(attemptId),
                },
              })
            }
          />
        </ReviewDisputeSection>

        {/* Pending dispute action */}
        {isPending && (
          <View className="bg-surface px-4 py-3">
            <Button
              title="Withdraw dispute"
              variant="danger"
              onPress={() => setIsWithdrawVisible(true)}
              rounded="full"
              fontClassName="font-bold"
            />
          </View>
        )}
      </Animated.ScrollView>

      {/* Sticky dispute context */}
      <ReviewDisputeStickyHeader
        attemptNumber={dispute.attempt_number}
        status={dispute.status}
        reason={dispute.reason}
        opacity={contextOpacity}
      />

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
