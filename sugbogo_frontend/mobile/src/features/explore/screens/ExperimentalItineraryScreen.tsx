import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import useUserLocation from "@/shared/hooks/useUserLocation";
import type { ApiError } from "@/shared/types/apiResponse.types";

import ExperimentalItineraryDetails, { providerUnavailable } from "../components/getting-there/ExperimentalItineraryDetails";
import useExperimentalItinerary from "../hooks/useExperimentalItinerary";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import type { ItineraryOption, ItinerarySearchResult, TransferLimit } from "../types/experimentalItinerary.types";
import { formatJourneyDistance } from "../utils/directJourney.utils";

const transferLimits: TransferLimit[] = [0, 1, 2];

function isStaleSelection(error: unknown) {
  const code = (error as Partial<ApiError> | null)?.code;
  return code === "STALE_ITINERARY" || code === "EXPIRED_ITINERARY" || code === "NOT_FOUND";
}

function optionStatus(option: ItineraryOption) {
  if (option.route_alignment_status === "reviewed" && option.passenger_ready) return "Passenger access verified";
  if (option.has_blocking_evidence) return "Part of this route needs review";
  if (option.walking_statuses.some(providerUnavailable)) return "Walking check unavailable";
  if (option.passenger_access_verified) return "Passenger access checked";
  return "Boarding locations unconfirmed";
}

function emptySearchMessage(result: ItinerarySearchResult) {
  switch (result.reason) {
    case "no_route_near_origin":
      return "No jeepney route was found near your starting point.";
    case "no_route_near_destination":
      return "No jeepney route was found near this destination.";
    case "no_forward_journey":
      return "Nearby jeepney routes could not connect these locations in the direction of travel with this transfer limit.";
    case "candidate_excluded_by_validation":
      return result.validation_stage === "minimum_ride_distance"
        ? "The jeepney rides found were too short to offer as an itinerary."
        : "Nearby route data did not pass the preview’s route checks.";
    case "no_geometric_journey":
      return "No route candidate found for this starting point and transfer limit.";
    default:
      return null;
  }
}

/** Provide a separate, explicitly triggered itinerary preview for approved testers. */
export default function ExperimentalItineraryScreen({ businessId }: { businessId: number }) {
  const [maxTransfers, setMaxTransfers] = useState<TransferLimit>(2);
  const [selection, setSelection] = useState<string | null>(null);
  const originChoice = useJourneyOriginStore((state) =>
    state.businessId === businessId ? state.confirmedOrigin : null,
  );
  const location = useUserLocation({ enabled: originChoice?.type !== "selected" });
  const { search, detail } = useExperimentalItinerary(businessId);
  const origin = originChoice?.type === "selected"
    ? originChoice
    : location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude, label: "Current location" }
      : null;
  const result = search.data;
  const submitted = search.variables;
  const sameOrigin = originChoice?.type === "selected"
    ? submitted?.originType === "selected"
      && submitted.origin.latitude === originChoice.latitude
      && submitted.origin.longitude === originChoice.longitude
    : submitted?.originType === "current";
  const currentResult = result &&
    submitted &&
    sameOrigin &&
    result.business_id === businessId &&
    result.origin.latitude === submitted.origin.latitude &&
    result.origin.longitude === submitted.origin.longitude &&
    submitted.maxTransfers === maxTransfers &&
    result.max_transfers === maxTransfers
    ? result
    : null;

  function startSearch() {
    if (!origin || search.isPending || detail.isPending) return;
    setSelection(null);
    detail.reset();
    search.mutate({
      origin: { latitude: origin.latitude, longitude: origin.longitude },
      maxTransfers,
      originType: originChoice?.type === "selected" ? "selected" : "current",
    });
  }

  function openItinerary(option: ItineraryOption) {
    if (detail.isPending) return;
    setSelection(option.selection);
    detail.mutate(option.selection);
  }

  function closeItinerary() {
    setSelection(null);
    detail.reset();
  }

  const busy = search.isPending || detail.isPending;
  const stale = isStaleSelection(detail.error);
  const emptyMessage = currentResult ? emptySearchMessage(currentResult) : null;
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 px-screen-x py-4">
        {selection ? (
          <>
            <Button title="Back to results" variant="outline" onPress={closeItinerary} />
            {detail.isPending && <AppText accessibilityLiveRegion="polite">Checking selected itinerary…</AppText>}
            {detail.error && (
              <ErrorState
                size="section"
                title={stale ? "This preview needs a new search" : "Could not open the itinerary"}
                description={stale ? "Search again for current routes." : "The itinerary request failed. Try again."}
                primaryActionTitle={stale ? "Search again" : "Retry"}
                onPrimaryAction={stale ? startSearch : () => detail.mutate(selection)}
              />
            )}
            {detail.data && !detail.error && <ExperimentalItineraryDetails itinerary={detail.data} />}
          </>
        ) : (
          <>
            <AppText className="text-sm text-text-secondary">
              Preview jeepney routes to this destination. Use confirmed boarding locations when you travel.
            </AppText>
            <View className="gap-2">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {origin?.label ?? (location.status === "loading" ? "Finding your location…" : "Choose a starting point")}
              </AppText>
              <Button
                title="Change starting point"
                variant="outline"
                disabled={busy}
                onPress={() => router.push({
                  pathname: "/(explorer)/business/[businessId]/jeepney-starting-point",
                  params: { businessId },
                })}
              />
            </View>
            <View className="gap-2">
              <AppText weight="semibold" className="text-sm text-text-primary">Maximum transfers</AppText>
              <View className="flex-row gap-2">
                {transferLimits.map((limit) => (
                  <Pressable
                    key={limit}
                    accessibilityRole="radio"
                    accessibilityLabel={`${limit} maximum transfers`}
                    accessibilityState={{ checked: maxTransfers === limit, disabled: busy }}
                    disabled={busy}
                    className={`min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border ${maxTransfers === limit ? "border-brand bg-brand/10" : "border-border-primary bg-surface"}`}
                    onPress={() => { setMaxTransfers(limit); search.reset(); }}
                  >
                    <AppText weight="semibold" className="text-text-primary">{limit}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <Button title="Search itineraries" disabled={!origin || busy} loading={search.isPending} onPress={startSearch} />
            {search.error && (
              <ErrorState
                size="section"
                title="Could not search itineraries"
                description={(search.error as Partial<ApiError>).message ?? "Try again in a moment."}
                primaryActionTitle="Retry"
                onPrimaryAction={startSearch}
              />
            )}
            {currentResult?.coverage.incomplete_reason && (
              <AppText accessibilityLiveRegion="polite" className="text-sm text-text-secondary">
                {currentResult.reason === "search_incomplete"
                  ? "The search ended before it could check every route. Try fewer transfers or a different starting point."
                  : "These routes are from an incomplete search. More options may be available."}
              </AppText>
            )}
            {currentResult?.coverage.alternatives_unchecked && !currentResult.coverage.incomplete_reason && (
              <AppText className="text-sm text-text-secondary">
                Some alternatives were outside this walking check. The preview may miss a walkable option.
              </AppText>
            )}
            {currentResult?.coverage.walking_checks_deferred && (
              <AppText className="text-sm text-text-secondary">
                Some walking paths still need checking.
              </AppText>
            )}
            {currentResult?.coverage.walking_provider_unavailable && (
              <AppText accessibilityLiveRegion="polite" className="text-sm text-text-secondary">
                Some walking checks are temporarily unavailable. You can still preview the routes.
              </AppText>
            )}
            {emptyMessage && (
              <AppText accessibilityLiveRegion="polite" className="text-sm text-text-secondary">
                {emptyMessage}
              </AppText>
            )}
            {currentResult?.options.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${option.route_sequence.join(" then ")} itinerary`}
                key={option.selection}
                disabled={busy}
                onPress={() => openItinerary(option)}
                className="min-h-12 cursor-pointer gap-1 rounded-card border border-border-primary bg-surface px-4 py-3 active:bg-surface-secondary"
              >
                {option.has_blocking_evidence && (
                  <AppText weight="semibold" className="text-sm text-text-secondary">
                    Diagnostic preview · walking connection needs review
                  </AppText>
                )}
                <AppText weight="bold" className="text-base text-text-primary">{option.route_sequence.join(" → ")}</AppText>
                <AppText className="text-sm text-text-secondary">
                  {option.transfer_count} {option.transfer_count === 1 ? "transfer" : "transfers"} · {formatJourneyDistance(option.ride_distance_meters)} ride
                </AppText>
                {option.route_alignment_status !== "reviewed" && (
                  <AppText className="text-xs text-text-secondary">
                    {option.route_alignment_status === "disputed"
                      ? "Geometry preview only · recorded route is disputed"
                      : "Geometry preview only · route unreviewed"}
                  </AppText>
                )}
                <AppText className="text-xs text-text-secondary">{optionStatus(option)}</AppText>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
