import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import ExperimentalItineraryMap, {
  type JourneyMapStep,
} from "./ExperimentalItineraryMap";
import { JourneyTimeline } from "./JourneyTimeline";
import { RouteBadge, ItineraryCoverageNotice } from "./ItineraryPresentation";
import JeepneyRouteContextCard from "./jeepney-guidance/jeep-guide-map/JeepneyRouteContextCard";
import { openGoogleMapsWalkingDirections } from "../../services/googleMapsHandoff.service";
import { formatJourneyDistance } from "../../utils/directJourney.utils";
import type {
  ItineraryDetail,
  ItinerarySearchResult,
} from "../../types/experimentalItinerary.types";

/** Pair a persistent, initially collapsed sheet with the selected geographic journey. */
export default function JourneyMapExperience({
  detail,
  search,
  destinationName,
  destinationPhotoUrl,
}: {
  detail: ItineraryDetail;
  search: ItinerarySearchResult;
  destinationName: string;
  destinationPhotoUrl?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const sheet = useRef<BottomSheet>(null);
  const [headerHeight, setHeaderHeight] = useState(112);
  const headerBottom = insets.top + 12 + headerHeight;
  const snaps = useMemo(
    () => [
      Math.min(184 + insets.bottom, (height - headerBottom) * 0.45),
      (height - headerBottom) * 0.65,
      height - headerBottom - 8,
    ],
    [height, headerBottom, insets.bottom],
  );
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<JourneyMapStep | null>(null);
  const [overview, setOverview] = useState(0);
  const [opening, setOpening] = useState(false);
  const [handoffError, setHandoffError] = useState(false);
  const changeSheet = useCallback((next: number) => {
    setIndex(next);
    if (next === 0) {
      setStep(null);
      setOverview((v) => v + 1);
    }
  }, []);
  const select = useCallback(
    (value: JourneyMapStep) => {
      setStep(value);
      const next = Math.max(index, 1);
      sheet.current?.snapToIndex(next);
      setIndex(next);
      setHandoffError(false);
    },
    [index],
  );
  useEffect(() => {
    if (!focused) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step) {
          setStep(null);
          return true;
        }
        if (index > 0) {
          sheet.current?.snapToIndex(0);
          changeSheet(0);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [focused, step, index, changeSheet]);
  const walk =
    step?.kind === "access"
      ? detail.access_walk
      : step?.kind === "egress"
        ? detail.egress_walk
        : step?.kind === "transfer"
          ? detail.transfers[step.index]?.walk
          : null;
  return (
    <View className="flex-1 bg-white">
      <ExperimentalItineraryMap
        itinerary={detail}
        destinationName={destinationName}
        destinationPhotoUrl={destinationPhotoUrl}
        sheetHeight={snaps[index]}
        headerBottom={headerBottom}
        selectedStep={step}
        onSelectStep={select}
        overviewVersion={overview}
      />
      {/* Reuse the working guide's destination context, with one back action. */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 px-screen-x"
        style={{ top: insets.top + 12 }}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <JeepneyRouteContextCard
          businessName={destinationName}
          businessCoverPhotoUrl={destinationPhotoUrl}
          backLabel="Back to journeys"
          onBack={() => router.back()}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show whole journey"
        onPress={() => {
          setStep(null);
          setOverview((v) => v + 1);
        }}
        className="absolute right-4 h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-white"
        style={{ top: headerBottom + 12 }}
      >
        <MaterialCommunityIcons
          name="navigation-variant-outline"
          size={22}
          color="#6B7280"
        />
      </Pressable>
      <BottomSheet
        ref={sheet}
        index={0}
        snapPoints={snaps}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        topInset={headerBottom + 8}
        onChange={changeSheet}
        handleIndicatorStyle={{ width: 40, backgroundColor: "#D1D5DB" }}
        backgroundStyle={{ backgroundColor: "white", borderRadius: 24 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          testID="journey-sheet"
        >
          <View className="flex-row items-center gap-3 border-b border-border-primary pb-3">
            <View className="flex-row items-center gap-1">
              {detail.ride_legs.map((ride, i) => (
                <View
                  key={ride.variant_id}
                  className="flex-row items-center gap-1"
                >
                  {i > 0 && (
                    <AppText className="text-xs text-text-secondary">→</AppText>
                  )}
                  <RouteBadge code={ride.route_code} index={i} compact />
                </View>
              ))}
            </View>
            <View className="min-w-0 flex-1">
              <AppText weight="bold" className="text-xs">
                {detail.transfer_count
                  ? detail.transfer_count +
                    " " +
                    (detail.transfer_count === 1 ? "transfer" : "transfers")
                  : "Direct"}
                {" · "}
                {formatJourneyDistance(detail.totals.ride_distance_meters)} ride
              </AppText>
              <AppText className="mt-1 text-xs text-text-secondary">
                Suggested jeepney journey
              </AppText>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              index === 0
                ? "Show journey steps"
                : index === 1
                  ? "Show full instructions"
                  : "Collapse journey steps"
            }
            onPress={() => {
              const next = (index + 1) % 3;
              sheet.current?.snapToIndex(next);
              changeSheet(next);
            }}
            className="min-h-10 cursor-pointer justify-center"
          >
            <AppText weight="semibold" className="text-xs text-brand">
              {index === 0
                ? "Show steps"
                : index === 1
                  ? "Full instructions"
                  : "Collapse"}
            </AppText>
          </Pressable>
          <ItineraryCoverageNotice result={search} compact />
          {index > 0 && (
            <View className="mt-3">
              <JourneyTimeline
                detail={detail}
                destinationName={destinationName}
                compact={index === 1}
                onSelectRide={(i) => select({ kind: "ride", index: i })}
                onSelectAccess={select}
                selectedStep={step}
                renderAccessDetails={() =>
                  index === 2
                    ? walk && (
                        <View className="gap-2 rounded-xl bg-surface-muted p-3">
                          {walk.status === "prohibited_access" ? (
                            <AppText className="text-xs text-error">
                              Passenger access is prohibited here.
                            </AppText>
                          ) : (
                            walk.from &&
                            walk.to &&
                            walk.straight_line_distance_meters >= 1 && (
                              <Button
                                title="Walking directions in Google Maps"
                                variant="outline"
                                loading={opening}
                                disabled={opening}
                                onPress={async () => {
                                  if (!walk.from || !walk.to) return;
                                  setOpening(true);
                                  try {
                                    setHandoffError(
                                      (await openGoogleMapsWalkingDirections(
                                        walk.from,
                                        walk.to,
                                      )) !== "opened",
                                    );
                                  } finally {
                                    setOpening(false);
                                  }
                                }}
                              />
                            )
                          )}
                          {handoffError && (
                            <AppText
                              accessibilityLiveRegion="polite"
                              className="text-xs"
                            >
                              Could not open Google Maps. Try again.
                            </AppText>
                          )}
                        </View>
                      )
                    : null
                }
              />
              <AppText className="mt-2 border-t border-border-primary pt-3 text-xs leading-5 text-text-secondary">
                Boarding and alighting areas are approximate. Confirm safe
                passenger access. Actual walking routes may differ.
              </AppText>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
