import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import MerchantContentSection from "../../layout/MerchantContentSection";
import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";

type SuggestionKind = "email" | "website" | "products" | "landmarks";

type SuggestionItem = {
  key: SuggestionKind;
  title: string;
  description: string;
  action: string;
  onOpen: () => void;
};

type LeavingCard = { item: SuggestionItem; index: number };

const FLIP_DURATION_MS = 380;
const FLIP_FAILSAFE_MS = 550;

const TIP_IMAGES: Record<SuggestionKind, number> = {
  email: require("../../assets/icons/add-email.webp"),
  website: require("../../assets/icons/add-website.webp"),
  products: require("../../assets/icons/add-photos.webp"),
  landmarks: require("../../assets/icons/add-landmarks.webp"),
};

/** Displays each bundled illustration without cropping its transparent edges. */
function ListingTipIllustration({ kind }: { kind: SuggestionKind }) {
  return (
    <Image
      testID="listing-tip-illustration"
      source={TIP_IMAGES[kind]}
      recyclingKey={kind}
      contentFit="contain"
      accessible={false}
      style={{ width: 112, height: 144 }}
    />
  );
}

/** Card content (tip + footer). Shared by the live card and the flipping copy. */
function TipCardBody({
  item,
  index,
  count,
  stackIllustration,
  onNext,
}: {
  item: SuggestionItem;
  index: number;
  count: number;
  stackIllustration: boolean;
  onNext: () => void;
}) {
  return (
    <>
      <View className="bg-brand/5 p-4">
        {/* Benefit-led text sits beside the matching bundled illustration */}
        <View
          className={
            stackIllustration ? "gap-3" : "flex-row items-center gap-2"
          }
        >
          <View
            className={stackIllustration ? "gap-2" : "min-w-0 flex-1 gap-2"}
          >
            <View className="mb-1 flex-row items-center gap-1.5 self-start">
              <MaterialCommunityIcons
                name="lightbulb-outline"
                size={16}
                color={theme.extends.colors.brand}
                accessible={false}
              />
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
              >
                Optional tip
              </AppText>
            </View>
            <AppText
              weight="bold"
              accessibilityLiveRegion="polite"
              className="text-lg leading-6 text-text-primary"
            >
              {item.title}
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              {item.description}
            </AppText>
          </View>
          <View className={stackIllustration ? "self-center" : ""}>
            <ListingTipIllustration kind={item.key} />
          </View>
        </View>

        {/* The rounded brand action opens the relevant profile editor. */}
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel={item.action}
          onPress={item.onOpen}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          className="mt-3 min-h-10 max-w-full cursor-pointer flex-row items-center justify-center gap-1.5 self-start rounded-full bg-brand px-4 py-2 active:opacity-70"
        >
          <AppText
            weight="semibold"
            className="min-w-0 shrink text-sm text-white"
          >
            {item.action}
          </AppText>
          <MaterialCommunityIcons
            name="arrow-right"
            size={16}
            color={theme.extends.colors.surface}
            accessible={false}
          />
        </SafePressable>
      </View>

      {count > 1 ? (
        <View className="flex-row items-center justify-between gap-3 border-t border-border-primary/60 bg-surface px-4 py-1">
          {/* Dots indicate the available tips, never profile completion */}
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Tip ${index + 1} of ${count}`}
            className="flex-row items-center gap-1.5"
          >
            {Array.from({ length: count }, (_, dot) => (
              <View
                key={dot}
                accessible={false}
                className={
                  dot === index
                    ? "h-1.5 w-4 rounded-full bg-brand"
                    : "h-1.5 w-1.5 rounded-full bg-text-primary/30"
                }
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next tip"
            onPress={onNext}
            className="min-h-12 min-w-0 cursor-pointer flex-row items-center gap-1 px-2 active:opacity-70"
          >
            <AppText
              weight="semibold"
              className="min-w-0 shrink text-sm text-text-secondary"
            >
              Next tip
            </AppText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

/**
 * Presents optional listing tips as a deck. The live card is never animated, so
 * it always stays tappable; a non-interactive copy of the previous card flips
 * away on top of it.
 */
export default function MerchantListingSuggestion({
  business,
  onAddPhotos,
  onEditInformation,
  onAddLandmarks,
}: {
  business: MerchantBusinessProfileResponse;
  onAddPhotos: () => void;
  onEditInformation: () => void;
  onAddLandmarks: () => void;
}) {
  const [selectedKind, setSelectedKind] = useState<SuggestionKind>("email");
  const { width, fontScale } = useWindowDimensions();
  const stackIllustration = width < 360 || fontScale >= 1.35;
  const [leave] = useState(() => new Animated.Value(0));
  const [leaving, setLeaving] = useState<LeavingCard | null>(null);
  const reduceMotion = useRef(true);
  const flying = useRef(false);
  const mounted = useRef(true);

  const clearLeaving = useCallback(() => {
    flying.current = false;
    leave.stopAnimation();
    // Keep the copy invisible until React has actually removed it; the value
    // is reset to 0 by the effect below, after it has unmounted.
    leave.setValue(1);
    if (mounted.current) {
      setLeaving(null);
    }
  }, [leave]);

  // Rest state is 0, so the next copy mounts in place and covers the live card.
  useEffect(() => {
    if (leaving === null) {
      leave.setValue(0);
    }
  }, [leaving, leave]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let preferenceChanged = false;

    const applyPreference = (enabled: boolean) => {
      reduceMotion.current = enabled;
      if (enabled) {
        clearLeaving();
      }
    };

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        preferenceChanged = true;
        applyPreference(enabled);
      },
    );

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !preferenceChanged) {
          applyPreference(enabled);
        }
      })
      .catch(() => {
        // Keep transitions off when the system preference cannot be read.
      });

    return () => {
      active = false;
      mounted.current = false;
      flying.current = false;
      subscription.remove();
      leave.stopAnimation();
    };
  }, [clearLeaving, leave]);

  // Start the flip only after the copy has mounted, so the native-driven value
  // is attached to its view. A failsafe timer guarantees the copy is removed.
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const failsafe = setTimeout(clearLeaving, FLIP_FAILSAFE_MS);
    Animated.timing(leave, {
      toValue: 1,
      duration: FLIP_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        clearLeaving();
      }
    });
    return () => clearTimeout(failsafe);
  }, [leaving, leave, clearLeaving]);

  const suggestions: SuggestionItem[] = [];

  if (!business.business_email?.trim()) {
    suggestions.push({
      key: "email",
      title: "Give explorers another way to reach you",
      description:
        "Add a business email for questions about your products or services.",
      action: "Add business email",
      onOpen: onEditInformation,
    });
  }

  if (!business.website?.trim()) {
    suggestions.push({
      key: "website",
      title: "Let explorers discover more about you",
      description:
        "Link your website so explorers can browse your offerings before visiting.",
      action: "Add website",
      onOpen: onEditInformation,
    });
  }

  const hasProductPhotos = business.photos.some(
    (photo) => photo.category === "products" && !!photo.url.trim(),
  );

  if (!hasProductPhotos) {
    suggestions.push({
      key: "products",
      title: "Show explorers what to expect",
      description:
        "Add photos of your products or services to bring your listing to life.",
      action: "Add photos",
      onOpen: onAddPhotos,
    });
  }

  if (business.location.landmarks.length === 0) {
    suggestions.push({
      key: "landmarks",
      title: "Help explorers find your business",
      description:
        "Add nearby landmarks to make your location easier to recognize. Changes require SugboGo approval.",
      action: "Add nearby landmarks",
      onOpen: onAddLandmarks,
    });
  }

  const selectedIndex = suggestions.findIndex(
    (suggestion) => suggestion.key === selectedKind,
  );
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const suggestion = suggestions[activeIndex];

  if (!suggestion) {
    return null;
  }

  const showNextTip = () => {
    if (suggestions.length < 2 || flying.current) {
      return;
    }
    const nextKind = suggestions[(activeIndex + 1) % suggestions.length].key;

    if (reduceMotion.current) {
      setSelectedKind(nextKind);
      return;
    }

    // The live card switches immediately; the old one flies off as a copy.
    flying.current = true;
    setLeaving({ item: suggestion, index: activeIndex });
    setSelectedKind(nextKind);
  };

  return (
    <MerchantContentSection
      title="Improve your listing"
      icon="lightbulb-outline"
      description="Optional tips to help explorers discover and reach your business."
    >
      {/* Warm, fanned layers give the tip deck a clearer silhouette. */}
      <View className={suggestions.length > 1 ? "mx-3 mb-6 mt-3" : ""}>
        {suggestions.length > 2 ? (
          <View
            pointerEvents="none"
            accessible={false}
            className="absolute inset-0 rounded-card border border-brand/50 bg-brand/30"
            style={{
              transform: [
                { translateX: -3 },
                { translateY: 16 },
                { rotate: "-4deg" },
              ],
            }}
          />
        ) : null}
        {suggestions.length > 1 ? (
          <View
            pointerEvents="none"
            accessible={false}
            className="absolute inset-0 rounded-card border border-brand bg-brand/80"
            style={{
              transform: [
                { translateX: 3 },
                { translateY: 8 },
                { rotate: "3deg" },
              ],
            }}
          />
        ) : null}

        <View>
          {/* Live card: static and always interactive. */}
          <View className="overflow-hidden rounded-card border border-brand/20 bg-surface">
            <TipCardBody
              item={suggestion}
              index={activeIndex}
              count={suggestions.length}
              stackIllustration={stackIllustration}
              onNext={showNextTip}
            />
          </View>

          {/* Flipping copy of the previous card: decorative, ignores touches. */}
          {leaving ? (
            <Animated.View
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="absolute inset-0 overflow-hidden rounded-card border border-brand/20 bg-surface"
              style={{
                opacity: leave.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [1, 0.85, 0],
                }),
                transform: [
                  { perspective: 900 },
                  {
                    translateX: leave.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -width * 0.9],
                    }),
                  },
                  {
                    translateY: leave.interpolate({
                      inputRange: [0, 0.4, 1],
                      outputRange: [0, -20, -36],
                    }),
                  },
                  {
                    rotateY: leave.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "-70deg"],
                    }),
                  },
                  {
                    rotateZ: leave.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "-14deg"],
                    }),
                  },
                  {
                    scale: leave.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.86],
                    }),
                  },
                ],
              }}
            >
              <TipCardBody
                item={leaving.item}
                index={leaving.index}
                count={suggestions.length}
                stackIllustration={stackIllustration}
                onNext={showNextTip}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </MerchantContentSection>
  );
}
