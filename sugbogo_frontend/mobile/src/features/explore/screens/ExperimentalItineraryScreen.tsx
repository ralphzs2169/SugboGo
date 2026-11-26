import { JourneyCardsSkeleton } from "../components/getting-there/JourneySkeletons";
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import GettingThereEmptyState from "../components/getting-there/GettingThereEmptyState";
import ErrorState from "@/shared/components/ErrorState";
import useUserLocation from "@/shared/hooks/useUserLocation";
import useBusinessDetailSource from "../hooks/useBusinessDetailSource";
import useExperimentalItinerary from "../hooks/useExperimentalItinerary";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import { useItinerarySelectionStore } from "../stores/itinerarySelection.store";
import {
  JourneyHeader,
  RouteBadge,
  ItineraryCoverageNotice,
} from "../components/getting-there/ItineraryPresentation";
import { getBusinessAddressDisplay } from "../utils/businessLocation.utils";
import { formatJourneyDistance } from "../utils/directJourney.utils";
import type { ItinerarySearchResult } from "../types/experimentalItinerary.types";

function emptySearchContent(result: ItinerarySearchResult) {
  const incomplete =
    result.coverage.alternatives_unchecked ||
    result.coverage.incomplete_reason ||
    (result.max_transfers > 0 &&
      (result.coverage.variants_outside_graph?.length ?? 0) > 0);
  return {
    title: "No journey suggestion yet",
    description: incomplete
      ? "We couldn't suggest a journey from the routes checked so far. Other routes may still be available or not yet added to SugboGo. Try another starting point or check again."
      : "We couldn't suggest a journey using the routes currently available in SugboGo. Some jeepney routes may not be added yet. Try another starting point or check again.",
  };
}

/** Search once per confirmed origin and keep backend-ranked options compact. */
export default function ExperimentalItineraryScreen({
  businessId,
}: {
  businessId: number;
}) {
  const choice = useJourneyOriginStore((s) =>
    s.businessId === businessId ? s.confirmedOrigin : null,
  );
  const location = useUserLocation({ enabled: choice?.type !== "selected" });
  const origin =
    choice?.type === "selected"
      ? choice
      : location.latitude !== null && location.longitude !== null
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            label: "Current location",
          }
        : null;
  const businessSource = useBusinessDetailSource(businessId);
  const business = businessSource.business ?? businessSource.snapshot?.business;
  const name = business?.business_name ?? "Destination";
  const { search } = useExperimentalItinerary(businessId);
  const refresh = useItinerarySelectionStore((s) => s.refresh);
  const started = useRef<string | null>(null);
  const key =
    choice?.type === "selected"
      ? `${businessId}:selected:${choice.latitude}:${choice.longitude}:${refresh}`
      : `${businessId}:current:${refresh}`;
  function runSearch() {
    if (!origin || search.isPending) return;
    started.current = key;
    search.mutate({
      origin,
      maxTransfers: 2,
      originType: choice?.type === "selected" ? "selected" : "current",
    });
  }
  useEffect(() => {
    if (origin && started.current !== key) runSearch();
  }, [key, origin?.latitude, origin?.longitude]);
  const result =
    search.data &&
    search.data.business_id === businessId &&
    started.current === key &&
    (choice?.type !== "selected" ||
      (search.variables?.origin.latitude === choice.latitude &&
        search.variables?.origin.longitude === choice.longitude))
      ? search.data
      : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <JourneyHeader title="Jeepney Guide" />
      <ScrollView contentContainerClassName="px-4 pb-8">
        {/* Confirmed origin and authoritative business context */}
        <View className="mb-6 rounded-3xl bg-surface-muted px-4 py-4">
          <View className="flex-row items-center gap-3 border-b border-border-primary pb-4">
            <View
              className="h-4 w-4 rounded-full border-2"
              style={{ borderColor: "#2693FF" }}
            />
            <AppText className="flex-1 text-sm" numberOfLines={2}>
              {origin?.label ?? "Choose a starting point"}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change starting point"
              onPress={() =>
                router.push({
                  pathname:
                    "/(explorer)/business/[businessId]/jeepney-starting-point",
                  params: { businessId },
                })
              }
              className="min-h-12 cursor-pointer justify-center"
            >
              <AppText weight="bold" className="text-sm text-brand">
                Change
              </AppText>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-3 pt-3">
            <View className="h-3 w-3 rounded-full bg-brand" />
            <View className="flex-1">
              <AppText weight="semibold" className="text-sm">
                {name}
              </AppText>
              {business && (
                <AppText className="mt-1 text-xs text-text-secondary">
                  {getBusinessAddressDisplay(business.location).fullAddress}
                </AppText>
              )}
            </View>
            {business?.display_cover_photo_url && (
              <Image
                source={{ uri: business.display_cover_photo_url }}
                style={{ width: 44, height: 44, borderRadius: 12 }}
                contentFit="cover"
              />
            )}
          </View>
        </View>
        <View className="mb-3 flex-row items-center justify-between">
          <AppText weight="bold" className="text-base">
            Suggested journeys
          </AppText>
          {result && (
            <AppText className="text-xs text-text-secondary">
              {result.options.length} found
            </AppText>
          )}
        </View>
        {search.isPending && <JourneyCardsSkeleton />}
        {search.error && (
          <ErrorState
            size="section"
            title="Could not search journeys"
            description="The journey request failed. Check your connection and try again."
            primaryActionTitle="Retry"
            onPrimaryAction={runSearch}
          />
        )}
        {result?.options.map((option) => (
          <Pressable
            key={option.selection}
            accessibilityRole="button"
            accessibilityLabel={`Open ${option.route_sequence.join(" then ")} itinerary`}
            onPress={() => {
              useItinerarySelectionStore.getState().select({
                businessId,
                search: result,
                token: option.selection,
                destinationName: name,
              });
              router.push({
                pathname: "/(explorer)/business/[businessId]/journey-map",
                params: { businessId },
              });
            }}
            className="mb-3 cursor-pointer rounded-3xl border border-border-primary bg-white p-4 active:bg-surface-secondary"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View />
              <AppText className="text-xs text-text-secondary">
                {option.transfer_count === 0
                  ? "Direct"
                  : `${option.transfer_count} ${option.transfer_count === 1 ? "transfer" : "transfers"}`}
              </AppText>
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              {option.route_sequence.map((code, leg) => (
                <View
                  key={`${leg}:${code}`}
                  className="flex-row items-center gap-2"
                >
                  {leg > 0 && (
                    <AppText className="text-text-secondary">›</AppText>
                  )}
                  <RouteBadge code={code} index={leg} />
                </View>
              ))}
              <AppText weight="bold" className="ml-auto text-base">
                {formatJourneyDistance(option.ride_distance_meters)} ride
              </AppText>
            </View>
            <AppText className="mt-3 text-xs text-text-secondary">
              ~
              {formatJourneyDistance(
                option.straight_line_walking_distance_meters,
              )}{" "}
              walking estimate
            </AppText>
            {option.has_blocking_evidence && (
              <AppText className="mt-2 text-xs text-error">
                Suggested access needs review
              </AppText>
            )}
          </Pressable>
        ))}
        {result && result.options.length === 0 && (
          <GettingThereEmptyState
            reason={null}
            content={emptySearchContent(result)}
            onRetry={runSearch}
            isLoading={search.isPending}
          />
        )}
        {result && <ItineraryCoverageNotice result={result} />}
      </ScrollView>
    </SafeAreaView>
  );
}
