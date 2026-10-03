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
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantBusinessNameChangeRequest,
  useWithdrawMerchantBusinessNameChange,
} from "../../hooks/business-name-change/useMerchantBusinessNameChanges";

/** Shows live and proposed names separately and confirms pending withdrawal. */
export default function BusinessNameChangeDetailScreen({
  requestId,
}: {
  requestId: number;
}) {
  const withdrawingRef = useRef(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { business } = useMerchantBusinessProfile();
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
    if (withdrawingRef.current || withdraw.isPending) {
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
        {/* Live name and submitted proposal */}
        <View className="rounded-card border border-border-primary bg-surface p-4">
          <AppText weight="bold" className="text-base text-text-primary">
            Business Name Change
          </AppText>
          <View className="mt-4">
            <BusinessNameChangeStatusBadge status={request.status} />
          </View>
          <AppText className="mt-5 text-xs text-text-secondary">
            Current live name
          </AppText>
          <AppText
            weight="semibold"
            className="mt-1 text-base text-text-primary"
          >
            {business?.business_name ?? "Loading current name..."}
          </AppText>
          <AppText className="mt-4 text-xs text-text-secondary">
            Requested name
          </AppText>
          <AppText
            weight="semibold"
            className="mt-1 text-base text-text-primary"
          >
            {request.proposed_business_name}
          </AppText>
          <AppText className="mt-4 text-xs text-text-secondary">
            Submitted {formatDate(request.submitted_at)}
          </AppText>
          {request.resolved_at ? (
            <AppText className="mt-1 text-xs text-text-secondary">
              Resolved {formatDate(request.resolved_at)}
            </AppText>
          ) : null}
        </View>

        {/* Decision feedback */}
        {request.status === "pending" ? (
          <AppText className="mt-4 text-sm leading-5 text-text-secondary">
            Your current business name remains visible until Admin approval.
          </AppText>
        ) : request.status === "rejected" && request.rejection_reason ? (
          <View className="mt-4 rounded-card border border-border-primary bg-surface p-4">
            <AppText weight="bold" className="text-sm text-text-primary">
              Rejection reason
            </AppText>
            <AppText className="mt-2 text-sm leading-5 text-text-secondary">
              {request.rejection_reason}
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

      {/* Withdrawal confirmation */}
      <ConfirmModal
        visible={confirmVisible}
        title="Withdraw this request?"
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
