import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import { theme } from "@/constants/theme";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  hasPaidMerchantPlus,
  hasResumableMerchantPlusCheckout,
  merchantPlusExpiry,
  merchantPlusPaymentState,
} from "../../utils/merchantPlusPayment";

const colors = theme.extends.colors;

/**
 * Brand orange (#F27F0D) darkened to the same hue at about 38% lightness, so
 * white text on it reaches 4.5:1 contrast. White on the raw brand is only 2.7:1.
 */
const OFFER_SURFACE = "#B85F08";
const WHITE_SOFT = "rgba(255,255,255,0.2)";

const ENTRY_STATUS = {
  active: {
    icon: "check-circle-outline",
    labelColor: "#166534",
    surface: "bg-success/10",
    color: colors.border.success,
  },
  waiting: {
    icon: "clock-outline",
    labelColor: "#92400E",
    surface: "bg-brand/10",
    color: OFFER_SURFACE,
  },
  failed: {
    icon: "alert-circle-outline",
    labelColor: "#B91C1C",
    surface: "bg-error",
    color: colors.error,
  },
  neutral: {
    icon: "information-outline",
    labelColor: colors.text.secondary,
    surface: "bg-surface-muted",
    color: colors.text.secondary,
  },
} as const;

const CHECKOUT_STATUS = {
  checking: { label: "Payment not confirmed", tone: "waiting" },
  activating: { label: "Activating access", tone: "waiting" },
  unknown: { label: "Checking payment status", tone: "waiting" },
  cancelled: { label: "Checkout cancelled", tone: "neutral" },
  expired: { label: "Checkout expired", tone: "neutral" },
  failed: { label: "Payment wasn't completed", tone: "failed" },
  active: { label: "Access active", tone: "active" },
  inactive: { label: "Not active", tone: "neutral" },
} as const;

function MerchantPlusBadge() {
  return (
    <View
      className="min-w-0 shrink flex-row items-center gap-1.5 self-start rounded-full py-1 pl-2 pr-2.5"
      style={{ backgroundColor: WHITE_SOFT }}
    >
      <MaterialCommunityIcons
        name="crown-outline"
        size={15}
        color={colors.surface}
        accessible={false}
      />
      <AppText
        weight="bold"
        className="shrink text-xs uppercase tracking-wide text-white"
      >
        Merchant Plus
      </AppText>
    </View>
  );
}

/** Provides a shared discovery card and compact access entry. */
export default function MerchantPlusEntry({
  discovery = false,
}: {
  discovery?: boolean;
}) {
  const access = useMerchantPlusAccess();
  const onOpen = () => router.push("/(merchant)/merchant-plus");
  const [dismissed, setDismissed] = useState(false);
  const expiry = merchantPlusExpiry(access.status?.entitlement_expires_at);
  if (access.state === "loading") {
    return (
      <View className="bg-surface px-5 py-4">
        <Skeleton
          className={discovery ? "h-72 rounded-card" : "h-24 rounded-card"}
        />
      </View>
    );
  }
  const active = !access.error && hasPaidMerchantPlus(access.status);
  const preview = access.status?.access_source === "preview";
  const unresolved = !!access.status?.unresolved_payment_id;
  const resume = hasResumableMerchantPlusCheckout(access.status);

  if (discovery && !active && !access.error && (!unresolved || resume)) {
    if (dismissed && !resume) return null;

    return (
      <View className="bg-surface px-5 pb-3 pt-4">
        <View
          className="overflow-hidden rounded-2xl p-4"
          style={{ backgroundColor: OFFER_SURFACE }}
        >
          {/* Decorative glow in brand orange */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -64,
              right: -56,
              width: 192,
              height: 192,
              borderRadius: 96,
              backgroundColor: colors.brand,
              opacity: 0.45,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -64,
              right: 32,
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: colors.brand,
              opacity: 0.35,
            }}
          />

          {/* Offer identity and dismiss */}
          <View className="flex-row items-center justify-between gap-2">
            <MerchantPlusBadge />
            {!resume && (
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss Merchant Plus offer"
                onPress={() => setDismissed(true)}
                className="-my-2 -mr-2 h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full active:opacity-70"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={colors.surface}
                  accessible={false}
                />
              </SafePressable>
            )}
          </View>

          {/* Pitch and locked preview */}
          <View className="mt-2 flex-row items-start gap-3">
            <View className="min-w-0 flex-1 gap-1.5">
              <AppText
                accessibilityRole="header"
                weight="extrabold"
                className="text-xl leading-7 text-white"
              >
                Know how you compare
              </AppText>
              <AppText className="text-sm leading-5 text-white">
                Peer comparisons, specialty trends, and profile visit timing.
              </AppText>
            </View>

            {/* Decorative teaser of the locked insight */}
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="shrink-0 rounded-2xl bg-white p-2.5"
              style={{
                width: 112,
                marginTop: 4,
                transform: [{ rotate: "3deg" }],
                shadowColor: "#000000",
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
                numberOfLines={1}
              >
                You vs. peers
              </AppText>
              <View className="mt-2 gap-2">
                <View className="flex-row items-center gap-1.5">
                  <AppText
                    className="text-xs text-text-secondary"
                    style={{ width: 34 }}
                  >
                    You
                  </AppText>
                  <View className="h-2 flex-1">
                    <View
                      className="h-2 rounded-full bg-brand"
                      style={{ width: "55%" }}
                    />
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <AppText
                    className="text-xs text-text-secondary"
                    style={{ width: 34 }}
                  >
                    Peers
                  </AppText>
                  <View className="h-2 flex-1">
                    <View
                      className="h-2 rounded-full bg-surface-muted-strong"
                      style={{ width: "90%" }}
                    />
                  </View>
                </View>
              </View>
              <View className="mt-2 h-9 items-center justify-center">
                <View
                  className="h-5 w-14 rounded-full"
                  style={{
                    backgroundColor: colors.border.success,
                    opacity: 0.3,
                  }}
                />
                <View
                  className="absolute h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.text.primary }}
                >
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={15}
                    color={colors.surface}
                    accessible={false}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Purchase action and terms */}
          {resume && (
            <AppText weight="semibold" className="mt-3 text-xs text-white">
              Checkout in progress
            </AppText>
          )}
          <SafePressable
            accessibilityRole="button"
            accessibilityLabel={
              resume ? "Continue checkout" : "Try 30 days for ₱1"
            }
            accessibilityHint="Opens Merchant Plus"
            onPress={onOpen}
            className="mt-4 min-h-12 cursor-pointer flex-row items-center justify-center gap-2 rounded-full bg-white px-3 py-2.5 active:opacity-80"
          >
            <AppText
              weight="extrabold"
              className="min-w-0 shrink text-center text-base"
              style={{ color: OFFER_SURFACE }}
            >
              {resume ? "Continue checkout" : "Try 30 days for ₱1"}
            </AppText>
            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color={OFFER_SURFACE}
              accessible={false}
            />
          </SafePressable>
          <View className="mt-3 flex-row items-center justify-center gap-1.5">
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={15}
              color={colors.surface}
              accessible={false}
            />
            <AppText
              weight="semibold"
              className="shrink text-center text-small text-white"
            >
              One-time payment · No automatic renewal
            </AppText>
          </View>
        </View>
      </View>
    );
  }

  let entryStatus: { label: string; tone: keyof typeof ENTRY_STATUS };
  if (access.error) {
    entryStatus = { label: "Check access status", tone: "neutral" };
  } else if (active && expiry) {
    entryStatus = { label: `Active until ${expiry}`, tone: "active" };
  } else if (resume) {
    entryStatus = { label: "Checkout in progress", tone: "neutral" };
  } else if (unresolved) {
    entryStatus = CHECKOUT_STATUS[merchantPlusPaymentState(access.status)];
  } else {
    entryStatus = {
      label: preview
        ? "Not active · Analytics preview"
        : "Not active",
      tone: "neutral",
    };
  }
  const statusStyle = ENTRY_STATUS[entryStatus.tone];

  return (
    <View className="bg-surface px-5 py-4">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? "View Merchant Plus access" : "Explore Merchant Plus"
        }
        accessibilityHint={entryStatus.label}
        onPress={onOpen}
        className="cursor-pointer overflow-hidden rounded-2xl border border-border-primary bg-surface active:opacity-80"
      >
        <View
          className="overflow-hidden px-4 py-3"
          style={{ backgroundColor: OFFER_SURFACE }}
        >
          <View
            pointerEvents="none"
            className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-brand"
            style={{ opacity: 0.45 }}
          />
          <MerchantPlusBadge />
          <AppText weight="bold" className="mt-1.5 text-base text-white">
            Advanced business analytics
          </AppText>
        </View>
        <View className="min-h-12 flex-row items-center justify-between gap-3 px-4 py-2.5">
          <View
            className={`min-w-0 shrink flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${statusStyle.surface}`}
          >
            <MaterialCommunityIcons
              name={statusStyle.icon}
              size={15}
              color={statusStyle.color}
              accessible={false}
            />
            <AppText
              weight="bold"
              className="shrink text-xs"
              style={{ color: statusStyle.labelColor }}
            >
              {entryStatus.label}
            </AppText>
          </View>
          <View className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <MaterialCommunityIcons
              name="arrow-right"
              size={17}
              color={OFFER_SURFACE}
              accessible={false}
            />
          </View>
        </View>
      </SafePressable>
    </View>
  );
}
