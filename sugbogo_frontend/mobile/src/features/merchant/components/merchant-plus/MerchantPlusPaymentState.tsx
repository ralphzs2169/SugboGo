import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { AccessibilityInfo, View } from "react-native";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";
import ErrorState from "@/shared/components/ErrorState";
import { theme } from "@/constants/theme";
import approvedAnimation from "../../assets/animations/approved-application.json";
import failedAnimation from "../../assets/animations/changes-required.json";
import checkingAnimation from "../../assets/animations/under-review.json";
import {
  merchantPlusExpiry,
  merchantPlusPaymentState,
} from "../../utils/merchantPlusPayment";
import type { MerchantPlusStatus } from "../../types/merchantPlusAnalytics.types";

const colors = theme.extends.colors;
const TONES = {
  waiting: {
    background: "bg-brand/10",
    icon: colors.brand,
    labelColor: "#92400E",
  },
  success: {
    background: "bg-success/10",
    icon: colors.border.success,
    labelColor: "#166534",
  },
  error: {
    background: "bg-error",
    icon: colors.error,
    labelColor: "#B91C1C",
  },
  neutral: {
    background: "bg-background",
    icon: colors.text.secondary,
    labelColor: colors.text.secondary,
  },
};
const STATUS = {
  checking: {
    badge: "Verifying payment",
    title: "Checking your payment",
    description: "We’re checking for the latest payment status.",
    icon: "shield-search",
    tone: "waiting",
    animation: checkingAnimation,
  },
  unconfirmed: {
    badge: "Checkout started",
    title: "Payment not confirmed",
    description:
      "We haven’t received confirmation of a completed payment for this checkout.",
    icon: "clock-outline",
    tone: "waiting",
    animation: checkingAnimation,
  },
  limited: {
    badge: "Awaiting an update",
    title: "Status check paused",
    description:
      "The payment status hasn’t finished updating. You can check again when you’re ready.",
    icon: "timer-sand",
    tone: "waiting",
  },
  activating: {
    badge: "Activating access",
    title: "Payment confirmed",
    description:
      "Your Merchant Plus access is being set up. Your 30 days start when it’s active.",
    icon: "shield-check-outline",
    tone: "waiting",
    animation: checkingAnimation,
  },
  activationReview: {
    badge: "Access pending",
    title: "Your access is taking longer",
    description:
      "Your payment was confirmed. Check again for an update on your Merchant Plus access.",
    icon: "shield-check-outline",
    tone: "waiting",
  },
  active: {
    badge: "Access active",
    title: "Merchant Plus is active",
    description:
      "Peer comparisons, specialty trends, visit timing, and recommendations are ready in Analytics.",
    icon: "check-circle-outline",
    tone: "success",
    animation: approvedAnimation,
  },
  cancelled: {
    badge: "Cancelled",
    title: "Checkout cancelled",
    description: "No payment was confirmed for this checkout.",
    icon: "close-circle-outline",
    tone: "neutral",
  },
  failed: {
    badge: "Payment failed",
    title: "Payment wasn't completed",
    description:
      "The payment provider reported a failed payment. You can review the purchase from Merchant Plus.",
    icon: "alert-circle-outline",
    tone: "error",
    animation: failedAnimation,
  },
  expired: {
    badge: "Expired",
    title: "Checkout expired",
    description:
      "This checkout link has expired. Open Merchant Plus to review the purchase.",
    icon: "clock-alert-outline",
    tone: "neutral",
  },
  unknown: {
    badge: "Confirmation unavailable",
    title: "We're still checking this payment",
    description:
      "We haven’t received a final result for this checkout. Check the existing purchase again.",
    icon: "help-circle-outline",
    tone: "waiting",
  },
  inactive: {
    badge: "No purchase in progress",
    title: "Check your Merchant Plus purchase",
    description: "Return to Merchant Plus to review your access.",
    icon: "receipt-text-outline",
    tone: "neutral",
  },
} satisfies Record<
  string,
  {
    badge: string;
    title: string;
    description: string;
    icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
    tone: keyof typeof TONES;
    animation?: ComponentProps<typeof LottieView>["source"];
  }
>;

function PaymentProgress({ confirmed }: { confirmed: boolean }) {
  return (
    <View className="rounded-xl bg-surface-muted px-5 py-5">
      <View className="flex-row items-stretch gap-3">
        <View className="w-8 shrink-0 items-center" aria-hidden>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-background">
            <MaterialCommunityIcons
              name={confirmed ? "check-circle-outline" : "clock-outline"}
              size={22}
              color={confirmed ? colors.border.success : colors.brand}
              accessible={false}
            />
          </View>
          <DottedTimelineConnector className="my-1 min-h-4 w-full flex-1" />
        </View>
        <View className="min-w-0 flex-1 gap-0.5 pb-5">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Payment verification
          </AppText>
          <AppText className="text-xs text-text-secondary">
            {confirmed ? "Confirmed" : "Awaiting provider confirmation"}
          </AppText>
        </View>
      </View>
      <View className="flex-row items-start gap-3">
        <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
          <MaterialCommunityIcons
            name={confirmed ? "progress-clock" : "lock-outline"}
            size={22}
            color={confirmed ? colors.brand : colors.text.secondary}
            accessible={false}
          />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Merchant Plus access
          </AppText>
          <AppText className="text-xs text-text-secondary">
            {confirmed ? "Activation pending" : "Not active yet"}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/** Presents backend payment and access evidence using the request-detail layout. */
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
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let current = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        changed = true;
        setReduceMotion(enabled);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (current && !changed) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  if (error) {
    return (
      <ErrorState
        title="Unable to check payment status"
        description={
          error instanceof Error && error.name === "MerchantPlusReconciliationError"
            ? error.message
            : "Try again to get the latest status."
        }
        primaryActionTitle="Try again"
        onPrimaryAction={onCheck}
        secondaryActionTitle={returning ? "Go back" : undefined}
        secondaryActionVariant="soft"
        onSecondaryAction={returning ? onContinue : undefined}
      />
    );
  }

  const state = merchantPlusPaymentState(status);
  const confirmed = status?.unresolved_payment_status === "paid";
  const unconfirmed =
    state === "checking" &&
    !!status?.unresolved_payment_id &&
    (!returning || exhausted);
  const limited = exhausted && state === "checking";
  let presentation: keyof typeof STATUS = state;
  if (confirmed && state === "unknown") {
    presentation = "activationReview";
  } else if (unconfirmed) {
    presentation = "unconfirmed";
  } else if (limited) {
    presentation = "limited";
  }

  const detail = STATUS[presentation];
  const tone = TONES[detail.tone];
  const animation = "animation" in detail ? detail.animation : null;
  const active = presentation === "active";
  const expiry = active
    ? merchantPlusExpiry(status?.entitlement_expires_at)
    : null;
  const showProgress =
    state === "activating" ||
    state === "unknown" ||
    (state === "checking" && !!status?.unresolved_payment_id);
  const canRecheck = exhausted || state === "unknown";
  const showCheck =
    canRecheck || (!returning && (unconfirmed || state === "activating"));

  return (
    <View className="gap-5">
      <View
        className="items-center px-3 pb-1 pt-2"
        accessibilityLiveRegion="polite"
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-24 w-24 items-center justify-center"
        >
          {animation && !reduceMotion ? (
            <LottieView
              key={presentation}
              source={animation}
              autoPlay
              loop={false}
              style={{ width: 96, height: 96 }}
            />
          ) : (
            <View
              className={`h-20 w-20 items-center justify-center rounded-full ${tone.background}`}
            >
              <MaterialCommunityIcons
                name={detail.icon}
                size={42}
                color={tone.icon}
              />
            </View>
          )}
        </View>
        <View className={`mt-3 rounded-full px-3.5 py-1.5 ${tone.background}`}>
          <AppText
            weight="bold"
            className="text-center text-xs uppercase tracking-wide"
            style={{ color: tone.labelColor }}
          >
            {detail.badge}
          </AppText>
        </View>
        <AppText
          accessibilityRole="header"
          weight="bold"
          className="mt-3 text-center text-xl text-text-primary"
        >
          {detail.title}
        </AppText>
        <AppText className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          {presentation === "unconfirmed" && status?.checkout_can_resume === true
            ? "You can continue the existing checkout."
            : detail.description}
        </AppText>
      </View>
      {showProgress && <PaymentProgress confirmed={confirmed} />}
      {expiry && (
        <View className="flex-row items-center gap-3 rounded-xl bg-surface-muted p-5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={22}
              color={colors.border.success}
              accessible={false}
            />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <AppText className="text-xs text-text-secondary">
              Active until
            </AppText>
            <AppText weight="bold" className="text-base text-text-primary">
              {expiry}
            </AppText>
          </View>
        </View>
      )}
      {(showCheck || returning || active) && (
        <View className="gap-2.5">
          {showCheck && (
            <Button
              title={
                !returning && status?.unresolved_payment_id
                  ? "Check payment status"
                  : canRecheck
                    ? "Check status again"
                    : "Check payment status"
              }
              rounded="full"
              variant={canRecheck ? "primary" : "soft"}
              onPress={onCheck}
            />
          )}
          {(returning || active) && (
            <Button
              title={
                active
                  ? "View Analytics"
                  : exhausted
                    ? "Return to Analytics"
                    : "Return to Merchant Plus"
              }
              rounded="full"
              variant={
                canRecheck || state === "checking" || state === "activating"
                  ? "soft"
                  : "primary"
              }
              onPress={onContinue}
            />
          )}
        </View>
      )}
    </View>
  );
}
