import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { theme } from "@/constants/theme";
import {
  merchantPlusExpiry,
  merchantPlusPaymentState,
} from "../../utils/merchantPlusPayment";
import type { MerchantPlusStatus } from "../../types/merchantPlusAnalytics.types";

const COPY = {
  checking: [
    "Checking your payment",
    "We're confirming your payment with Maya.",
  ],
  activating: [
    "Payment confirmed",
    "Activating Merchant Plus… Your access will be available shortly.",
  ],
  active: [
    "Merchant Plus is active",
    "Your advanced analytics are now unlocked.",
  ],
  cancelled: ["Checkout cancelled", "No payment was confirmed."],
  failed: ["Payment wasn't completed", "No successful payment was confirmed."],
  expired: ["Checkout expired", "This checkout can no longer be used."],
  unknown: [
    "We're still checking this payment",
    "We don't have a final result yet. Your existing purchase is being kept safe.",
  ],
  inactive: [
    "Check your Merchant Plus purchase",
    "Your backend status is up to date. Return to Merchant Plus to review your access.",
  ],
} as const;

/** Translates backend evidence into an actionable status independently of navigation hints. */
export default function MerchantPlusPaymentState({
  status,
  error,
  exhausted = false,
  onCheck,
  onContinue,
  returning = false,
}: {
  status?: MerchantPlusStatus;
  error?: unknown;
  exhausted?: boolean;
  onCheck: () => void;
  onContinue: () => void;
  returning?: boolean;
}) {
  const state = merchantPlusPaymentState(status);
  const limited = exhausted && (state === "checking" || state === "activating");
  const waiting =
    !error && !exhausted && (state === "checking" || state === "activating");
  const title = error
    ? "Unable to check payment status"
    : limited
      ? "Still processing"
      : COPY[state][0];
  const body = error
    ? "Your payment information is still safe. Please try checking again."
    : limited
      ? "Your payment status hasn't finished updating yet."
      : COPY[state][1];
  const expiry = merchantPlusExpiry(status?.entitlement_expires_at);
  return (
    <View className="gap-5 rounded-card border border-border-primary bg-surface p-5">
      {/* Backend-driven outcome and next action */}
      <View className="h-12 w-12 items-center justify-center rounded-full bg-background">
        {waiting ? (
          <ActivityIndicator
            color={theme.extends.colors.brand}
            accessibilityLabel="Checking payment status"
          />
        ) : (
          <MaterialCommunityIcons
            name={
              state === "active" || state === "activating"
                ? "check-circle-outline"
                : "information-outline"
            }
            size={27}
            color={theme.extends.colors.text.primary}
            accessible={false}
          />
        )}
      </View>
      <View className="gap-2" accessibilityLiveRegion="polite">
        <AppText weight="bold" className="text-xl text-text-primary">
          {title}
        </AppText>
        <AppText className="text-sm leading-6 text-text-secondary">
          {body}
        </AppText>
      </View>
      {state === "active" && !error && expiry && (
        <View className="border-t border-border-primary pt-4">
          <AppText className="text-xs text-text-secondary">
            Active until
          </AppText>
          <AppText weight="bold" className="mt-1 text-lg text-text-primary">
            {expiry}
          </AppText>
        </View>
      )}
      {error || exhausted || state === "unknown" ? (
        <Button
          fontClassName="text-sm"
          title={error ? "Try again" : "Check status again"}
          onPress={onCheck}
        />
      ) : null}
      {!returning && waiting && (
        <Button
          title="Check payment status"
          variant="outline"
          onPress={onCheck}
        />
      )}
      {(returning || state === "active") && (
        <Button
          fontClassName="text-sm"
          title={
            state === "active" && !error
              ? "View Analytics"
              : exhausted
                ? "Return to Analytics"
                : "Return to Merchant Plus"
          }
          variant={
            error || exhausted || state === "unknown" ? "outline" : "primary"
          }
          onPress={onContinue}
        />
      )}
    </View>
  );
}
