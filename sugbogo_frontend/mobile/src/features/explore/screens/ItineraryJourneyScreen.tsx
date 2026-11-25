import { JourneyMapSkeleton } from "../components/getting-there/JourneySkeletons";
import { useEffect } from "react";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getExperimentalItinerary } from "../api/experimentalItinerary.service";
import { useItinerarySelectionStore } from "../stores/itinerarySelection.store";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import useBusinessDetailSource from "../hooks/useBusinessDetailSource";
import JourneyMapExperience from "../components/getting-there/JourneyMapExperience";
import { JourneyTimeline } from "../components/getting-there/JourneyTimeline";
import {
  JourneyHeader,
  RouteBadge,
  ItineraryCoverageNotice,
} from "../components/getting-there/ItineraryPresentation";
import { formatJourneyDistance } from "../utils/directJourney.utils";
import type { ItineraryDetail } from "../types/experimentalItinerary.types";

/** Load signed detail once and retain it when moving between details and the existing map. */
export default function ItineraryJourneyScreen({
  businessId,
  map = false,
}: {
  businessId: number;
  map?: boolean;
}) {
  const businessSource = useBusinessDetailSource(businessId);
  const business = businessSource.business ?? businessSource.snapshot?.business;
  const stored = useItinerarySelectionStore((s) => s.selected);
  const origin = useJourneyOriginStore((s) =>
    s.businessId === businessId ? s.confirmedOrigin : null,
  );
  const selected =
    stored?.businessId === businessId &&
    stored.generation === getAuthSessionGeneration() &&
    (origin?.type !== "selected" ||
      (origin.latitude === stored.search.origin.latitude &&
        origin.longitude === stored.search.origin.longitude))
      ? stored
      : null;
  const request = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: (token: string) =>
      getExperimentalItinerary(businessId, token).then(throwOnApiError),
    onSuccess: (detail, token) =>
      useItinerarySelectionStore.getState().hydrate(token, detail),
  });
  useEffect(() => {
    if (selected && !selected.detail && !request.isPending && !request.error)
      request.mutate(selected.token);
  }, [selected?.token]);
  const code = (request.error as { code?: string } | null)?.code;
  const stale = ["EXPIRED_ITINERARY", "STALE_ITINERARY", "NOT_FOUND"].includes(
    code ?? "",
  );
  const detail = selected?.detail;
  if (map && selected && !detail && !request.error)
    return <JourneyMapSkeleton />;
  return (
    <SafeAreaView
      edges={map && detail ? [] : undefined}
      className="flex-1 bg-white"
    >
      {(!map || !detail) && (
        <JourneyHeader title={map ? "Jeepney Guide" : "Journey details"} />
      )}
      {selected && !detail && (
        <ItineraryCoverageNotice result={selected.search} />
      )}
      {!selected || request.error ? (
        <ErrorState
          description="Return to your journeys for a fresh selection, or retry the request."
          size="section"
          title={
            stale || !selected
              ? "Search again for current journeys"
              : "Could not open this journey"
          }
          primaryActionTitle={
            stale ? "Search again" : !selected ? "Back to journeys" : "Retry"
          }
          onPrimaryAction={() => {
            if (stale) useItinerarySelectionStore.getState().restart();
            if (stale || !selected) router.back();
            else request.mutate(selected.token);
          }}
        />
      ) : !detail ? (
        <AppText accessibilityLiveRegion="polite" className="p-5">
          Loading journey…
        </AppText>
      ) : map ? (
        <JourneyMapExperience
          detail={detail}
          search={selected.search}
          destinationName={business?.business_name ?? selected.destinationName}
          destinationPhotoUrl={business?.display_cover_photo_url}
        />
      ) : (
        <>
          <ScrollView contentContainerClassName="pb-8">
            <View className="border-b border-border-primary px-5 pb-5 pt-3">
              <AppText weight="extrabold" className="text-3xl">
                {formatJourneyDistance(detail.totals.ride_distance_meters)}{" "}
                <AppText className="text-base">ride</AppText>
              </AppText>
              <AppText className="mt-2 text-sm text-text-secondary">
                {detail.transfer_count === 0
                  ? "Direct"
                  : `${detail.transfer_count} ${detail.transfer_count === 1 ? "transfer" : "transfers"}`}{" "}
                · to {selected.destinationName}
              </AppText>
              <AppText className="mt-1 text-xs text-text-secondary">
                ~
                {formatJourneyDistance(
                  detail.totals.straight_line_walking_distance_meters,
                )}{" "}
                total geometric access
              </AppText>
            </View>
            <View className="px-4 pt-6">
              <JourneyTimeline
                detail={detail}
                destinationName={selected.destinationName}
              />
            </View>
            <View className="gap-3 px-5 pt-6">
              {!detail.passenger_ready && (
                <AppText className="text-xs leading-5 text-text-secondary">
                  Suggested areas are approximate. Route direction, boarding
                  permission and pedestrian access require confirmation.
                </AppText>
              )}
              <ItineraryCoverageNotice result={selected.search} />
            </View>
          </ScrollView>
          <View className="px-5 pb-3 pt-2">
            <Button
              title="View on map"
              onPress={() =>
                router.push({
                  pathname: "/(explorer)/business/[businessId]/journey-map",
                  params: { businessId },
                })
              }
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
