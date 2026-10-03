import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessNameChangeRequest } from "../../types/businessNameChange.types";

/** Keeps the live name and review-request entry distinct in Merchant Profile. */
export default function BusinessNameChangeEntry({
  businessName,
  businessStatus,
  pendingRequest,
  isChecking,
  hasError,
  onRequest,
  onHistory,
  onRetry,
}: {
  businessName: string;
  businessStatus: "active" | "suspended";
  pendingRequest: BusinessNameChangeRequest | null;
  isChecking: boolean;
  hasError: boolean;
  onRequest: () => void;
  onHistory: () => void;
  onRetry: () => void;
}) {
  const canRequest =
    businessStatus === "active" && !isChecking && !hasError && !pendingRequest;

  return (
    <View className="mb-2 bg-surface px-5 py-4">
      {/* Current identity and request state */}
      <AppText weight="bold" className="text-base text-text-primary">
        Business Name
      </AppText>
      <AppText className="mt-1 text-sm text-text-primary">
        {businessName}
      </AppText>
      {businessStatus === "suspended" ? (
        <AppText className="mt-2 text-xs text-text-secondary">
          Name changes cannot be requested while your business is suspended.
        </AppText>
      ) : pendingRequest ? (
        <AppText className="mt-2 text-xs text-text-secondary">
          Pending Admin review: {pendingRequest.proposed_business_name}. Your
          current name remains visible.
        </AppText>
      ) : isChecking ? (
        <AppText className="mt-2 text-xs text-text-secondary">
          Checking requested changes...
        </AppText>
      ) : hasError ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-2 min-h-11 justify-center active:opacity-75"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            Retry request status
          </AppText>
        </Pressable>
      ) : null}

      {/* Request and history actions */}
      <View className="mt-3 flex-row flex-wrap gap-3">
        {canRequest ? (
          <Pressable
            onPress={onRequest}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center rounded-lg px-2 active:bg-brand/10"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              Request name change
            </AppText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.brand}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onHistory}
          accessibilityRole="button"
          className="min-h-11 flex-row items-center rounded-lg px-2 active:bg-brand/10"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            {pendingRequest ? "View pending request" : "Requested Changes"}
          </AppText>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.extends.colors.brand}
          />
        </Pressable>
      </View>
    </View>
  );
}
