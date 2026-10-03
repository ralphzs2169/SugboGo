import { router } from "expo-router";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";

import BusinessNameChangeStatusBadge from "../../components/business-name-change/BusinessNameChangeStatusBadge";
import LocationChangeComparison from "../../components/location-change/LocationChangeComparison";
import {
  useMerchantLocationChangeRequest,
  useWithdrawMerchantLocationChange,
} from "../../hooks/location-change/useMerchantLocationChanges";

/** Presents immutable Location snapshots and confirms pending withdrawal. */
export default function LocationChangeDetailScreen({
  requestId,
}: {
  requestId: number;
}) {
  const withdrawingRef = useRef(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { request, isLoading, isRefetching, error, refetch } =
    useMerchantLocationChangeRequest(requestId);
  const withdraw = useWithdrawMerchantLocationChange();

  useQueryErrorNotification({
    error,
    toastId: "location-change-detail-error",
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

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-5 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        {error ? (
          <ErrorState
            size="section"
            title="Unable to refresh request"
            description="Showing the last available request."
            primaryActionTitle="Retry"
            onPrimaryAction={() => void refetch()}
          />
        ) : null}
        {/* Decision and submitted snapshots */}
        <View className="mb-4 rounded-card border border-border-primary bg-surface p-4">
          <AppText weight="bold" className="text-base text-text-primary">
            Location & Landmark Change
          </AppText>
          <View className="mt-3">
            <BusinessNameChangeStatusBadge status={request.status} />
          </View>
          <AppText className="mt-4 text-xs text-text-secondary">
            Submitted {formatDate(request.submitted_at)}
          </AppText>
          {request.resolved_at ? (
            <AppText className="mt-1 text-xs text-text-secondary">
              Resolved {formatDate(request.resolved_at)}
            </AppText>
          ) : null}
        </View>
        <LocationChangeComparison
          title="Current at Submission"
          location={request.previous.location}
          landmarks={request.previous.landmarks}
        />
        <View className="mt-4">
          <LocationChangeComparison
            title="Requested Location"
            location={request.proposed.location}
            landmarks={request.proposed.landmarks}
          />
        </View>

        {/* Resolution feedback and withdrawal */}
        {request.status === "pending" ? (
          <AppText className="mt-4 text-sm leading-5 text-text-secondary">
            Your current business location and landmarks remain visible until
            Admin approval.
          </AppText>
        ) : request.status === "rejected" && request.rejection_reason ? (
          <View className="mt-4 rounded-card border border-border-primary bg-surface p-4">
            <AppText weight="bold" className="text-sm text-text-primary">
              Rejection reason
            </AppText>
            <AppText className="mt-2 text-sm leading-5 text-text-secondary">
              {request.rejection_reason}
            </AppText>
            <AppText className="mt-2 text-xs text-text-secondary">
              Your live location and landmarks were not changed.
            </AppText>
          </View>
        ) : null}
        {request.status === "pending" ? (
          <Button
            title="Withdraw Request"
            variant="danger"
            className="mt-6"
            onPress={() => setConfirmVisible(true)}
          />
        ) : null}
      </ScrollView>
      <ConfirmModal
        visible={confirmVisible}
        title="Withdraw this location change request?"
        message="Your current live location and landmarks will remain unchanged. This request will remain in your history."
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
