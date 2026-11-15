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
  merchantPlusExpiry,
} from "../../utils/merchantPlusPayment";

/**
 * Deep orange for the discovery card. White text on it stays above 4.5:1
 * contrast. Replace with a theme token if one exists, and keep the
 * `text-[#C2410C]` class on the CTA label in sync with this value.
 */
const OFFER_SURFACE = "#C2410C";

/** Provides a shared discovery card or quiet Business row, reflecting authoritative access. */
export default function MerchantPlusEntry({
  discovery = false,
}: {
  discovery?: boolean;
}) {
  const access = useMerchantPlusAccess();
  const [dismissed, setDismissed] = useState(false);
  const expiry = merchantPlusExpiry(access.status?.entitlement_expires_at);
  const openPlus = () => router.push("/(merchant)/merchant-plus");
  if (access.state === "loading") {
    return (
      <View className="bg-surface px-5 py-4">
        <Skeleton
          className={discovery ? "h-60 rounded-card" : "h-24 rounded-card"}
        />
      </View>
    );
  }
  const active = !access.error && hasPaidMerchantPlus(access.status);
  const preview = access.status?.access_source === "preview";
  const demo = access.status?.access_source === "mock";
  const unresolved = !!access.status?.unresolved_payment_id;

  if (discovery && !active && !access.error && !unresolved) {
    if (dismissed) return null;

    return (
      <View className="bg-surface px-5 pb-3 pt-4">
        <View
          className="overflow-hidden rounded-[20px] p-4"
          style={{ backgroundColor: OFFER_SURFACE }}
        >
          {/* Decorative depth */}
          <View
            pointerEvents="none"
            className="absolute -right-14 -top-16 h-48 w-48 rounded-full bg-white/10"
          />
          <View
            pointerEvents="none"
            className="absolute -bottom-16 right-8 h-32 w-32 rounded-full bg-white/10"
          />

          {/* Offer identity and dismiss */}
          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 shrink flex-row items-center gap-1.5 rounded-full bg-white/20 py-1 pl-2 pr-2.5">
              <MaterialCommunityIcons
                name="crown-outline"
                size={15}
                color="#FFFFFF"
                accessible={false}
              />
              <AppText
                weight="bold"
                className="shrink text-xs uppercase tracking-wide text-white"
              >
                Merchant Plus
              </AppText>
            </View>
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss Merchant Plus offer"
              onPress={() => setDismissed(true)}
              className="-my-2 -mr-2 h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-white/20"
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color="#FFFFFF"
                accessible={false}
              />
            </SafePressable>
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
                Peer benchmarks, trends, and tips to get more visits.
              </AppText>
            </View>

            {/* Decorative teaser of the locked insight */}
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="w-[104px] rounded-2xl bg-white p-2.5"
              style={{
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
                  <AppText className="w-9 text-xs text-text-secondary">
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
                  <AppText className="w-9 text-xs text-text-secondary">
                    Peers
                  </AppText>
                  <View className="h-2 flex-1">
                    <View
                      className="h-2 rounded-full bg-surface-muted"
                      style={{ width: "90%" }}
                    />
                  </View>
                </View>
              </View>
              <View className="mt-3 h-9 items-center justify-center">
                <View
                  className="h-5 w-14 rounded-full"
                  style={{
                    backgroundColor: theme.extends.colors.border.success,
                    opacity: 0.3,
                  }}
                />
                <View className="absolute h-8 w-8 items-center justify-center rounded-full bg-text-primary">
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={15}
                    color="#FFFFFF"
                    accessible={false}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Purchase action and terms */}
          <SafePressable
            accessibilityRole="button"
            accessibilityLabel="Try 30 days for ₱1"
            accessibilityHint="Opens Merchant Plus"
            onPress={openPlus}
            className="mt-3.5 min-h-12 cursor-pointer flex-row items-center justify-center gap-2 rounded-btn bg-white px-3 py-2.5 active:opacity-80"
          >
            <AppText
              weight="extrabold"
              className="min-w-0 shrink text-center text-base text-[#C2410C]"
            >
              Try 30 days for ₱1
            </AppText>
            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color={OFFER_SURFACE}
              accessible={false}
            />
          </SafePressable>
          <View className="mt-2.5 flex-row items-center justify-center gap-1.5">
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={15}
              color="#FFFFFF"
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

  return (
    <View className="bg-surface px-5 py-4">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? "View Merchant Plus access" : "Explore Merchant Plus"
        }
        onPress={openPlus}
        className="min-h-16 cursor-pointer rounded-card border border-border-primary bg-background p-4 active:opacity-80"
      >
        {/* Identity and current access */}
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={20}
            color={theme.extends.colors.brand}
            accessible={false}
          />
          <AppText
            weight="bold"
            className="min-w-0 flex-1 text-base text-text-primary"
          >
            Merchant Plus
          </AppText>
          {(!discovery || active) && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          )}
        </View>
        <AppText className="mt-1 text-sm text-text-secondary">
          Advanced business analytics
        </AppText>
        <AppText weight="semibold" className="mt-2 text-xs text-text-primary">
          {access.error
            ? "Check access status"
            : active
              ? expiry
                ? `Active until ${expiry}`
                : "Access enabled"
              : unresolved
                ? "Purchase in progress · Check status"
                : preview
                  ? "Not active · Analytics preview"
                  : demo
                    ? "Not active · Demo access"
                    : "Not active"}
        </AppText>
      </SafePressable>
    </View>
  );
}
