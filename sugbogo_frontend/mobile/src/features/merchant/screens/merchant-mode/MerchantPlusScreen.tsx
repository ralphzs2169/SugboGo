import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import ErrorState from "@/shared/components/ErrorState";
import { theme } from "@/constants/theme";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import useMerchantPlusCheckout from "../../hooks/payments/useMerchantPlusCheckout";
import MerchantPlusFeatures from "../../components/merchant-plus/MerchantPlusFeatures";
import MerchantPlusPaymentState from "../../components/merchant-plus/MerchantPlusPaymentState";
import { hasPaidMerchantPlus } from "../../utils/merchantPlusPayment";

const colors = theme.extends.colors;

/**
 * Brand orange (#F27F0D) darkened to the same hue so white text on it reaches
 * 4.5:1 contrast. Colors that need opacity or a custom value are set through
 * `style`, because arbitrary-value (`bg-[#...]`) and opacity (`bg-white/10`)
 * classes do not render in this app's NativeWind setup.
 */
const OFFER_SURFACE = "#B85F08";
const WHITE_SOFT = "rgba(255,255,255,0.2)";

/** Brand-colored action for the offer, with loading and disabled states. */
function OfferButton({
  title,
  onPress,
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      className="cursor-pointer active:opacity-80"
    >
      <View
        className="min-h-12 flex-row items-center justify-center gap-2 rounded-full px-3 py-2.5"
        style={{ backgroundColor: colors.brand }}
      >
        {loading && <ActivityIndicator size="small" color={colors.surface} />}
        <AppText
          weight="extrabold"
          className="min-w-0 shrink text-center text-base"
          style={{ color: colors.surface }}
        >
          {title}
        </AppText>
      </View>
    </SafePressable>
  );
}

/** Introduces the offer using the orange artwork from the Analytics entry. */
function OfferHero() {
  return (
    <View
      className="overflow-hidden rounded-2xl p-4"
      style={{ backgroundColor: OFFER_SURFACE }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -56,
          right: -48,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: colors.brand,
          opacity: 0.45,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -80,
          right: 24,
          width: 128,
          height: 128,
          borderRadius: 64,
          backgroundColor: colors.brand,
          opacity: 0.35,
        }}
      />
      <View
        className="flex-row items-center gap-1.5 self-start rounded-full px-2 py-1"
        style={{ backgroundColor: WHITE_SOFT }}
      >
        <MaterialCommunityIcons
          name="crown-outline"
          size={13}
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
      <View className="mt-2 flex-row items-center gap-2">
        <View className="min-w-0 flex-1 gap-1">
          <AppText
            accessibilityRole="header"
            weight="extrabold"
            className="text-2xl leading-7 text-white"
          >
            See more of what’s working
          </AppText>
          <AppText className="text-sm leading-5 text-white">
            Understand how people find, visit, and support your business.
          </AppText>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="mr-1 flex-row items-end gap-1"
        >
          <View
            className="h-5 w-2.5 rounded-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
          />
          <View
            className="h-7 w-2.5 rounded-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.75)" }}
          />
          <View
            className="h-10 w-2.5 rounded-sm"
            style={{ backgroundColor: colors.surface }}
          />
        </View>
      </View>
    </View>
  );
}

/** Keeps the price and purchase terms visible next to the checkout action. */
function OfferPrice() {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1 self-center">
          <AppText
            weight="extrabold"
            className="shrink text-sm text-text-primary"
          >
            30 days of Merchant Plus
          </AppText>
          <AppText
            weight="semibold"
            className="rounded-tag bg-surface-muted px-2 py-0.5 text-xs text-text-secondary"
          >
            Sandbox
          </AppText>
        </View>
        <AppText weight="extrabold" className="text-xl text-text-primary">
          ₱1.00
        </AppText>
      </View>
      <View className="flex-row items-start gap-1.5">
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={15}
          color={colors.border.success}
          accessible={false}
        />
        <AppText className="min-w-0 flex-1 text-small text-text-secondary">
          One-time payment · No automatic renewal
        </AppText>
      </View>
    </View>
  );
}

/** Presents the fixed one-time offer and existing-purchase management from backend status. */
export default function MerchantPlusScreen() {
  const access = useMerchantPlusAccess();
  const checkout = useMerchantPlusCheckout();
  const onCheckPayment = () => router.push("/(merchant)/merchant-plus/return");
  const onViewAnalytics = () => router.replace("/(merchant)/(tabs)/analytics");
  const status = access.status;
  const paidActive = !access.error && hasPaidMerchantPlus(status);
  const unresolved = !!status?.unresolved_payment_id;
  const resume = unresolved && status?.checkout_can_resume === true;
  const product = status?.product;
  const offerValid =
    product?.code === "merchant_plus" &&
    product?.currency === "PHP" &&
    product?.amount_centavos === 100 &&
    product?.access_duration_days === 30 &&
    product?.payment_type === "one-time";
  const canPurchase =
    !paidActive &&
    !access.error &&
    offerValid &&
    status?.checkout_enabled === true &&
    ((!unresolved && status.purchase_eligible === true) || resume);
  const showOffer =
    access.state !== "loading" && !access.error && !paidActive && !unresolved;
  const checkoutProgress =
    checkout.phase === "preparing"
      ? "Preparing secure checkout…"
      : checkout.phase === "opening"
        ? "Opening Maya Checkout…"
        : null;

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-surface"
    >
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={access.isFetching}
            onRefresh={() => void access.refetch()}
            tintColor={colors.brand}
          />
        }
      >
        {/* Access and purchase recovery */}
        {checkout.error ? (
          <View className="px-5 pt-5">
            <ErrorState
              size="section"
              title="Unable to open checkout"
              description="Your existing purchase is safe. Check its status before trying again."
              primaryActionTitle="Check payment status"
              onPrimaryAction={onCheckPayment}
            />
          </View>
        ) : null}
        {access.state === "loading" ? (
          <View className="gap-4 px-5 py-6">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </View>
        ) : access.error ? (
          <View className="px-5 py-5">
            <ErrorState
              size="section"
              title="Unable to check Merchant Plus"
              description="Please check your connection and try again."
              primaryActionTitle="Try again"
              onPrimaryAction={() => void access.refetch()}
            />
          </View>
        ) : paidActive || unresolved ? (
          <View className="px-4 pb-5 pt-5">
            <MerchantPlusPaymentState
              status={status}
              onCheck={onCheckPayment}
              onContinue={onViewAnalytics}
            />
          </View>
        ) : null}
        {/* Offer introduction and benefits */}
        {showOffer && (
          <View className="gap-3 px-4 pt-4">
            <OfferHero />
            <View className="gap-2">
              <AppText
                accessibilityRole="header"
                weight="bold"
                className="text-small text-text-secondary"
              >
                What’s included
              </AppText>
              <MerchantPlusFeatures />
            </View>
            {status?.access_source === "preview" && (
              <View className="flex-row items-start gap-2 rounded-card border border-border-info bg-info px-3 py-2.5">
                <View className="mt-0.5 shrink-0">
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={15}
                    color={colors.text.info}
                    accessible={false}
                  />
                </View>
                <AppText className="min-w-0 flex-1 text-small leading-4 text-text-info">
                  <AppText weight="bold">Preview mode:</AppText>
                  {" Some Plus analytics are available in this test build."}
                </AppText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {/* Safe-area-aware checkout action */}
      {(canPurchase || showOffer) && (
        <View className="gap-2.5 border-t border-border-primary bg-surface px-4 py-3">
          {!resume && <OfferPrice />}
          {canPurchase ? (
            <>
              <OfferButton
                title={
                  checkoutProgress ??
                  (resume ? "Continue checkout" : "Pay ₱1.00")
                }
                loading={checkout.busy}
                disabled={checkout.busy}
                onPress={checkout.startCheckout}
              />
              {checkoutProgress && (
                <AppText
                  accessibilityLiveRegion="polite"
                  className="text-center text-xs text-text-secondary"
                >
                  {checkoutProgress}
                </AppText>
              )}
            </>
          ) : (
            <>
              <View className="flex-row items-start gap-2 rounded-card bg-surface-muted px-3 py-2.5">
                <MaterialCommunityIcons
                  name="cloud-off-outline"
                  size={15}
                  color={colors.text.secondary}
                  accessible={false}
                />
                <AppText className="min-w-0 flex-1 text-small leading-4 text-text-secondary">
                  Checkout is unavailable right now. Try again in a few minutes.
                </AppText>
              </View>
              <Button
                title="Check again"
                variant="soft"
                rounded="full"
                className="min-h-12"
                textWeight="extrabold"
                loading={access.isFetching}
                onPress={() => void access.refetch()}
                icon={
                  <MaterialCommunityIcons
                    name="refresh"
                    size={17}
                    color={colors.brand}
                    accessible={false}
                  />
                }
              />
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
