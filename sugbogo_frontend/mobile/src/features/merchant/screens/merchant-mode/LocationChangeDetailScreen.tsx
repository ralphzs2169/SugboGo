import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
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

import BusinessNameChangeStatusBadge from "../../components/business-name-change/BusinessNameChangeStatusBadge";
import LocationChangeReviewSections from "../../components/location-change/LocationChangeReviewSections";
import MerchantChangeReasonCard from "../../components/change-requests/MerchantChangeReasonCard";
import { useLocationChangeReviewStore } from "../../stores/locationChangeReviewStore";
import {
  useMerchantLocationChangeRequest,
  useWithdrawMerchantLocationChange,
} from "../../hooks/location-change/useMerchantLocationChanges";

/**
 * Displays a merchant's submitted location change request and review status.
 *
 * Uses animated status presentations for pending and rejected requests,
 * displays only the changed address, pin, and landmark details. Pending
 * requests can be withdrawn through a confirmation modal.
 */
export default function LocationChangeDetailScreen({
  requestId,
}: {
  requestId: number;
}) {
  const withdrawingRef = useRef(false);

  const [confirmVisible, setConfirmVisible] = useState(false);

  const setReviewPreview = useLocationChangeReviewStore(
    (state) => state.setPreview,
  );

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
                We&apos;re reviewing your location change
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
                Your location change wasn&apos;t approved
              </AppText>

              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Review the administrator&apos;s feedback below.
              </AppText>

              {request.resolved_at ? (
                <AppText className="mt-3 text-center text-xs text-text-secondary">
                  Reviewed {formatDate(request.resolved_at)}
                </AppText>
              ) : null}
            </>
          ) : isWithdrawn ? (
            <>
              {/* Withdrawn status icon */}
              <View className="h-20 w-20 items-center justify-center rounded-full bg-background">
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={48}
                  color={theme.extends.colors.text.secondary}
                />
              </View>

              {/* Withdrawn status badge */}
              <View className="mt-4 rounded-full bg-background px-3.5 py-1.5">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-text-secondary"
                >
                  Withdrawn
                </AppText>
              </View>

              {/* Withdrawal explanation */}
              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                You withdrew this location change
              </AppText>

              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Your live location and landmarks remain unchanged.
              </AppText>

              <AppText className="mt-3 text-center text-xs text-text-secondary">
                Submitted {formatDate(request.submitted_at)}
              </AppText>
            </>
          ) : isApproved ? (
            <>
              {/* Approval animation */}
              <LottieView
                source={approvedApplicationAnimation}
                autoPlay
                loop={false}
                style={{ width: 100, height: 100 }}
              />

              {/* Approval status */}
              <View className="mt-4 rounded-full bg-success/10 px-3.5 py-1.5">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-success"
                >
                  Location Approved
                </AppText>
              </View>

              {/* Approval message */}
              <AppText
                weight="bold"
                className="mt-3 text-center text-xl text-text-primary"
              >
                Your location change was approved!
              </AppText>

              <AppText className="mt-2 text-center text-sm leading-6 text-text-secondary">
                Your updated business location and landmarks are now live on
                SugboGo.
              </AppText>

              {/* Approval date */}
              {request.resolved_at ? (
                <AppText className="mt-3 text-center text-xs text-text-secondary">
                  Approved {formatDate(request.resolved_at)}
                </AppText>
              ) : null}
            </>
          ) : (
            <>
              <BusinessNameChangeStatusBadge status={request.status} />

              <AppText className="mt-3 text-xs text-text-secondary">
                Submitted {formatDate(request.submitted_at)}
              </AppText>

              {request.resolved_at ? (
                <AppText className="mt-1 text-xs text-text-secondary">
                  Resolved {formatDate(request.resolved_at)}
                </AppText>
              ) : null}
            </>
          )}
        </View>

        {/* Changes captured in this request */}
        <View className="mb-4">
          <LocationChangeReviewSections
            variant="detail"
            currentLocation={request.previous.location}
            proposedLocation={request.proposed.location}
            currentLandmarks={request.previous.landmarks}
            proposedLandmarks={request.proposed.landmarks}
            status={request.status}
            onViewProposed={() => {
              setReviewPreview(
                "Requested location and landmarks",
                request.proposed.location,
                request.proposed.landmarks,
              );

              router.push(
                "/(merchant)/location-change/review-landmarks" as Href,
              );
            }}
            onViewCurrent={() => {
              setReviewPreview(
                "Location at submission",
                request.previous.location,
                request.previous.landmarks,
              );
              router.push(
                "/(merchant)/location-change/review-landmarks" as Href,
              );
            }}
          />
        </View>

        {/* Merchant's submitted reason */}
        {request.reason ? (
          <View className="mb-5">
            <MerchantChangeReasonCard value={request.reason} />
          </View>
        ) : null}

        {/* Administrator rejection feedback */}
        {isRejected && request.rejection_reason ? (
          <View className="mb-5 rounded-2xl border border-border-primary/70 bg-surface p-4">
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={18}
                color={theme.extends.colors.error}
              />

              <AppText
                weight="semibold"
                className="ml-2 text-sm text-text-primary"
              >
                Administrator Feedback
              </AppText>
            </View>

            <AppText className="mt-3 text-sm leading-6 text-text-primary">
              {request.rejection_reason}
            </AppText>

            <View className="mt-4 border-t border-border-primary/60 pt-3">
              <AppText className="text-xs leading-5 text-text-secondary">
                Your live location and landmarks were not changed.
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Pending request withdrawal */}
        {isPending ? (
          <View className="mt-2">
            <AppText className="mb-4 text-xs leading-5 text-text-secondary">
              Your current location remains live until this request is approved.
            </AppText>

            <Button
              title="Withdraw Request"
              variant="danger"
              rounded="full"
              onPress={() => setConfirmVisible(true)}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Withdrawal confirmation */}
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
