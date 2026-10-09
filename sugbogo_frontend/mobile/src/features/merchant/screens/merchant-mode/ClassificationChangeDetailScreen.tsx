import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";

import underReviewAnimation from "../../assets/animations/under-review.json";
import rejectedApplicationAnimation from "../../assets/animations/changes-required.json";
import approvedApplicationAnimation from "../../assets/animations/approved-application.json";

import ClassificationChangeReviewSections from "../../components/classification-change/ClassificationChangeReviewSections";
import MerchantChangeReasonCard from "../../components/change-requests/MerchantChangeReasonCard";
import {
  useMerchantClassificationChangeRequest,
  useWithdrawMerchantClassificationChange,
} from "../../hooks/classification-change/useMerchantClassificationChanges";
import useClusters from "../../hooks/registration/useClusters";
import useSpecialtyTags from "../../hooks/registration/useSpecialtyTags";

/**
 * Displays a classification change request and its review decision.
 *
 * Uses the same status presentation and card styling as location change
 * details, reuses classification difference cards with specialty chips,
 * and allows pending requests to be withdrawn.
 */
export default function ClassificationChangeDetailScreen({
  requestId,
}: {
  requestId: number;
}) {
  const withdrawingRef = useRef(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const { request, isLoading, isRefetching, error, refetch } =
    useMerchantClassificationChangeRequest(requestId);

  const withdraw = useWithdrawMerchantClassificationChange();

  // Optional color enrichment for historical specialty snapshots.
  const { specialtyTags } = useSpecialtyTags();
  const { clusters } = useClusters();

  useQueryErrorNotification({
    error,
    toastId: "classification-change-detail-error",
    title: "Unable to load request",
    fallbackMessage: "Please try again.",
  });

  async function confirmWithdraw() {
    if (
      withdrawingRef.current ||
      withdraw.isPending ||
      request?.status !== "pending"
    ) {
      return;
    }

    withdrawingRef.current = true;

    try {
      await withdraw.mutateAsync(requestId);

      setConfirmVisible(false);

      Toast.show({
        type: "success",
        text1: "Request withdrawn",
      });
    } catch (error) {
      const response = error as ApiError;

      if (!handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to withdraw request",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      withdrawingRef.current = false;
    }
  }

  if (isLoading && !request) {
    return (
      <LoadingScreen
        title="Loading Request"
        description="Fetching the latest decision..."
      />
    );
  }

  if (!request) {
    return (
      <ErrorState
        title="Unable to load request"
        description="Please try again."
        primaryActionTitle="Retry"
        onPrimaryAction={() => void refetch()}
        secondaryActionTitle="Go Back"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  const isPending = request.status === "pending";
  const isRejected = request.status === "rejected";
  const isWithdrawn = request.status === "withdrawn";
  const isApproved = request.status === "approved";

  // Restore available tag colors without changing historical names.
  const tagColors = new Map(
    specialtyTags.map((tag) => [Number(tag.id), tag.color]),
  );

  const previousTags = request.previous.specialty_tags.map((tag) => ({
    ...tag,
    color: tagColors.get(tag.id),
  }));

  const proposedTags = request.proposed.specialty_tags.map((tag) => ({
    ...tag,
    color: tagColors.get(tag.id),
  }));

  // Historical snapshots contain cluster IDs and names; registration options own their icons.
  const previousClusterIcon = clusters.find(
    (cluster) => cluster.id === request.previous.cluster.id,
  )?.icon;
  const proposedClusterIcon = clusters.find(
    (cluster) => cluster.id === request.proposed.cluster.id,
  )?.icon;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        {/* Request refresh error */}
        {error ? (
          <View className="mb-4">
            <ErrorState
              size="section"
              title="Unable to refresh request"
              description="Showing the last available request."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void refetch()}
            />
          </View>
        ) : null}

        {/* Request review status */}
        <View className="mb-6 items-center px-3 pb-2">
          {isPending ? (
            <>
              <LottieView
                source={underReviewAnimation}
                autoPlay
                loop={false}
                style={{ width: 100, height: 100 }}
              />

              <View className="mt-4 rounded-full bg-brand/10 px-3.5 py-1.5">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-brand"
                >
                  Under Review
                </AppText>
              </View>

              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                We&apos;re reviewing your classification change
              </AppText>

              <AppText className="mt-2 text-center text-xs text-text-secondary">
                Submitted {formatDate(request.submitted_at)}
              </AppText>
            </>
          ) : isRejected ? (
            <>
              <LottieView
                source={rejectedApplicationAnimation}
                autoPlay
                loop={false}
                style={{ width: 80, height: 80 }}
              />

              <View className="mt-4 rounded-full bg-text-error/10 px-3.5 py-1.5">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-text-error"
                >
                  Request Rejected
                </AppText>
              </View>

              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                Your classification change wasn&apos;t approved
              </AppText>

              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Read the administrator&apos;s notes below.
              </AppText>

              {request.resolved_at ? (
                <AppText className="mt-3 text-center text-xs text-text-secondary">
                  Reviewed {formatDate(request.resolved_at)}
                </AppText>
              ) : null}
            </>
          ) : isWithdrawn ? (
            <>
              <View className="h-20 w-20 items-center justify-center rounded-full bg-background">
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={48}
                  color={theme.extends.colors.text.secondary}
                />
              </View>

              <View className="mt-4 rounded-full bg-background px-3.5 py-1.5">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-text-secondary"
                >
                  Withdrawn
                </AppText>
              </View>

              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                You withdrew this classification change
              </AppText>

              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                This request was withdrawn without changing your live
                classification.
              </AppText>

              <AppText className="mt-3 text-center text-xs text-text-secondary">
                Submitted {formatDate(request.submitted_at)}
              </AppText>
            </>
          ) : isApproved ? (
            <>
              <LottieView
                source={approvedApplicationAnimation}
                autoPlay
                loop={false}
                style={{ width: 100, height: 100 }}
              />

              <View className="mt-4 rounded-full bg-success/10 px-3.5 py-1.5">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-success"
                >
                  Classification Approved
                </AppText>
              </View>

              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                Your classification change was approved!
              </AppText>

              <AppText className="mt-2 text-center text-sm leading-6 text-text-secondary">
                Your requested category and specialty changes were approved and
                applied to your business.
              </AppText>

              {request.resolved_at ? (
                <AppText className="mt-3 text-center text-xs text-text-secondary">
                  Approved {formatDate(request.resolved_at)}
                </AppText>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Category and specialty difference cards */}
        <ClassificationChangeReviewSections
          current={{
            category: request.previous.category,
            cluster: {
              ...request.previous.cluster,
              icon: previousClusterIcon,
            },
          }}
          proposed={{
            category: request.proposed.category,
            cluster: {
              ...request.proposed.cluster,
              icon: proposedClusterIcon,
            },
          }}
          currentTags={previousTags}
          proposedTags={proposedTags}
          status={request.status}
          presentation="card"
        />

        {/* Administrator rejection feedback */}
        {request.reason ? (
          <View className="mb-4">
            <MerchantChangeReasonCard value={request.reason} />
          </View>
        ) : null}

        {isRejected && request.rejection_reason ? (
          <View className="mb-4 rounded-2xl border border-border-primary/70 bg-surface p-4">
            {/* Card header */}
            <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Administrator notes
              </AppText>

              <MaterialCommunityIcons
                name="shield-account-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </View>

            {/* Administrator feedback content */}
            <View className="pt-4">
              <View className="overflow-hidden rounded-xl bg-background">
                <View className="flex-row">
                  <View className="w-1 bg-blue-500" />

                  <View className="flex-1 px-4 py-4">
                    <MaterialCommunityIcons
                      name="format-quote-open"
                      size={20}
                      color={theme.extends.colors.text.tertiary}
                    />

                    <AppText className="mt-1 text-sm leading-6 text-text-primary">
                      {request.rejection_reason}
                    </AppText>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Pending request withdrawal */}
        {isPending ? (
          <View className="mt-2">
            <AppText className="mb-4 text-xs leading-5 text-text-secondary">
              Your current classification remains live until this request is
              approved.
            </AppText>

            <Button
              title="Withdraw Request"
              variant="danger"
              rounded="full"
              onPress={() => setConfirmVisible(true)}
              disabled={withdraw.isPending}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Withdrawal confirmation */}
      <ConfirmModal
        visible={confirmVisible}
        title="Withdraw this classification request?"
        message="Your current classification will remain unchanged by this request. The request will remain in your history."
        confirmText="Withdraw"
        destructive
        isLoading={withdraw.isPending}
        loadingText="Withdrawing request..."
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => void confirmWithdraw()}
      />
    </SafeAreaView>
  );
}
