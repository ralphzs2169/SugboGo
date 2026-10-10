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
import MerchantChangeDetailSkeleton from "../../components/change-requests/MerchantChangeDetailSkeleton";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";

import underReviewAnimation from "../../assets/animations/under-review.json";
import rejectedApplicationAnimation from "../../assets/animations/changes-required.json";
import approvedApplicationAnimation from "../../assets/animations/approved-application.json";
import BusinessNameChangeComparison from "../../components/business-name-change/BusinessNameChangeComparison";
import MerchantChangeReasonCard from "../../components/change-requests/MerchantChangeReasonCard";
import {
  useMerchantBusinessNameChangeRequest,
  useWithdrawMerchantBusinessNameChange,
} from "../../hooks/business-name-change/useMerchantBusinessNameChanges";

/** Shows the captured name change, review decision, and pending withdrawal action. */
export default function BusinessNameChangeDetailScreen({
  requestId,
}: {
  requestId: number;
}) {
  const withdrawingRef = useRef(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { request, isLoading, isRefetching, error, refetch } =
    useMerchantBusinessNameChangeRequest(requestId);
  const withdraw = useWithdrawMerchantBusinessNameChange();

  useQueryErrorNotification({
    error,
    toastId: "business-name-change-detail-error",
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
      Toast.show({ type: "success", text1: "Request withdrawn" });
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
    return <MerchantChangeDetailSkeleton />;
  }

  if (!request) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load request"
          description="Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  const isPending = request.status === "pending";
  const isRejected = request.status === "rejected";
  const isWithdrawn = request.status === "withdrawn";
  const isApproved = request.status === "approved";

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
                We&apos;re reviewing your business name change
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
                Your business name change wasn&apos;t approved
              </AppText>
              {request.rejection_reason ? (
                <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                  Read the administrator&apos;s notes below.
                </AppText>
              ) : null}
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
                You withdrew this name change
              </AppText>
              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                This request was withdrawn without changing your live business
                name.
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
                  Name Approved
                </AppText>
              </View>
              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                Your business name change was approved!
              </AppText>
              <AppText className="mt-2 text-center text-sm leading-6 text-text-secondary">
                Your approved name is now visible on your business profile.
              </AppText>
              {request.resolved_at ? (
                <AppText className="mt-3 text-center text-xs text-text-secondary">
                  Approved {formatDate(request.resolved_at)}
                </AppText>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Name captured at submission and requested name */}
        <BusinessNameChangeComparison
          previousName={request.previous_business_name}
          proposedName={request.proposed_business_name}
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

        {/* Pending withdrawal */}
        {isPending ? (
          <View className="mt-2">
            <AppText className="mb-4 text-xs leading-5 text-text-secondary">
              Your current business name remains live until this request is
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
        title="Withdraw this name change request?"
        message="Your current business name will remain unchanged. This request will remain in your history."
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
