import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Image } from "expo-image";
import SafePressable from "@/shared/components/SafePressable";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import JourneyStep from "@/features/explore/components/getting-there/jeepney-guidance/JourneyStep";
import MerchantAccessDirections from "@/features/explore/components/getting-there/MerchantAccessDirections";
import InfoBanner from "@/shared/components/InfoBanner";
import { formatJourneyDistance } from "@/features/explore/utils/directJourney.utils";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import useSavedJourneys from "../hooks/useSavedJourneys";
import { deleteSavedJourney } from "../services/savedJourneys.service";
import {
  needsJourneyReview,
  type SavedJourneyListItem,
} from "../utils/savedJourney.utils";

/** Provides local-only saved guidance without depending on maps, GPS, or authenticated APIs. */
export default function OfflineRoutesScreen({
  journeyKey,
}: {
  journeyKey?: string;
}) {
  const saved = useSavedJourneys();
  const [toDelete, setToDelete] = useState<{
    ownerId: number;
    generation: number;
    item: SavedJourneyListItem;
  } | null>(null);
  const [isDeleting, setDeleting] = useState(false);
  const deletionPending = useRef(false);
  const selected = saved.items.find((item) => item.key === journeyKey);
  const snapshot = selected?.snapshot;

  function requestDeletion(item: SavedJourneyListItem) {
    if (saved.ownerId)
      setToDelete({
        ownerId: saved.ownerId,
        generation: getAuthSessionGeneration(),
        item,
      });
  }

  async function handleDelete() {
    if (!toDelete || !saved.ownerId || deletionPending.current) return;
    if (
      toDelete.ownerId !== saved.ownerId ||
      !isAuthSessionGenerationCurrent(toDelete.generation)
    ) {
      setToDelete(null);
      return;
    }
    deletionPending.current = true;
    setDeleting(true);
    try {
      await deleteSavedJourney(toDelete.ownerId, toDelete.item.key);
      if (!isAuthSessionGenerationCurrent(toDelete.generation)) return;
      setToDelete(null);
      await saved.reload();
      if (journeyKey) router.replace("/offline-routes");
    } catch {
      if (!isAuthSessionGenerationCurrent(toDelete.generation)) return;
      Toast.show({
        type: "error",
        text1: "Unable to remove saved guidance",
        text2: "Please try again.",
      });
    } finally {
      deletionPending.current = false;
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-surface"
    >
      <Stack.Screen
        options={{ title: journeyKey ? "Saved journey" : "Saved journeys" }}
      />
      <View className="flex-row items-center justify-between gap-3 px-4 py-4">
        <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
          Guidance saved for offline use.
        </AppText>
        {!journeyKey && !saved.isLoading && !saved.error && (
          <AppText weight="semibold" className="text-xs text-text-secondary">
            {saved.items.length} saved
          </AppText>
        )}
      </View>
      {/* Local loading, failure, and access states */}
      {!saved.ownerId ? (
        <View className="px-screen-x py-6">
          <AppText className="text-text-secondary">
            Sign in and save a journey before using offline guidance.
          </AppText>
        </View>
      ) : Platform.OS === "web" ? (
        <View className="px-screen-x py-6">
          <AppText className="text-text-secondary">
            Saved offline guidance is available in the Android and iOS app.
          </AppText>
        </View>
      ) : saved.error ? (
        <ErrorState
          title="Unable to read saved guidance"
          description={saved.error.message}
          primaryActionTitle="Retry"
          onPrimaryAction={() => void saved.reload()}
        />
      ) : saved.isLoading ? (
        <View className="gap-4 px-screen-x">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </View>
      ) : journeyKey ? (
        snapshot ? (
          <ScrollView contentContainerClassName="gap-5 px-screen-x pb-6">
            {/* Snapshot identity and freshness */}
            <View className="gap-2">
              <AppText weight="bold" className="text-lg text-text-primary">
                {snapshot.business.name}
              </AppText>
              <View className="flex-row items-center gap-2 self-start rounded-lg bg-brand px-2.5 py-2">
                <MaterialCommunityIcons
                  name="bus"
                  size={15}
                  color="#FFFFFF"
                  accessible={false}
                />
                <AppText weight="superbold" className="text-base text-white">
                  {snapshot.journey.jeepney_route_code}
                </AppText>
              </View>
              <AppText
                weight="semibold"
                className="text-sm leading-5 text-text-primary"
              >
                {snapshot.journey.route_variant.origin.name} →{" "}
                {snapshot.journey.route_variant.destination.name}
              </AppText>
            </View>
            <View className="flex-row items-start gap-3 rounded-xl bg-surface-muted p-4">
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
              <View className="min-w-0 flex-1">
                <AppText
                  weight="semibold"
                  className="text-xs text-text-secondary"
                >
                  Saved starting point
                </AppText>
                <AppText className="mt-1 text-sm leading-5 text-text-primary">
                  {["Current location", "Selected map location"].includes(
                    snapshot.origin.label.trim(),
                  )
                    ? `${snapshot.origin.latitude.toFixed(5)}, ${snapshot.origin.longitude.toFixed(5)}`
                    : snapshot.origin.label}
                </AppText>
              </View>
            </View>
            {/* Text guidance remains usable without map tiles or GPS */}
            <View>
              <AppText
                weight="bold"
                className="mb-4 text-base text-text-primary"
              >
                How to get there
              </AppText>
              <JourneyStep
                number={1}
                variant="origin"
                title={`Board at ${snapshot.journey.boarding_transit_point.name}`}
                detail={`${formatJourneyDistance(
                  calculateDistanceInKm(
                    snapshot.origin.latitude,
                    snapshot.origin.longitude,
                    snapshot.journey.boarding_transit_point.latitude,
                    snapshot.journey.boarding_transit_point.longitude,
                  ) * 1000,
                )} from saved starting point`}
              />
              <JourneyStep
                number={2}
                icon="bus"
                title={`Take ${snapshot.journey.jeepney_route_code}`}
                detail={`Toward ${snapshot.journey.route_variant.destination.name} · ${formatJourneyDistance(snapshot.journey.ride.approximate_distance_meters)} ride`}
              />
              <JourneyStep
                number={3}
                variant="destination"
                title={`Get off at ${snapshot.journey.alighting_transit_point.name}`}
                detail={`${formatJourneyDistance(
                  calculateDistanceInKm(
                    snapshot.journey.alighting_transit_point.latitude,
                    snapshot.journey.alighting_transit_point.longitude,
                    snapshot.journey.business_location.latitude,
                    snapshot.journey.business_location.longitude,
                  ) * 1000,
                )} from ${snapshot.business.name}`}
                supportingLabel="Nearby landmark"
                supportingText={snapshot.journey.landmark_context?.name}
                isLast
              />
              <AppText className="mt-4 border-t border-border-primary/60 pt-3 text-xs leading-5 text-text-tertiary">
                Access distances are straight-line estimates from your saved
                starting point.
              </AppText>
            </View>
            <MerchantAccessDirections
              directions={snapshot.business.access_directions}
            />
            <InfoBanner
              title={
                needsJourneyReview(snapshot.savedAt)
                  ? "Review before your next trip"
                  : "Saved device guidance"
              }
              variant={
                needsJourneyReview(snapshot.savedAt) ? "warning" : "info"
              }
            >
              <AppText className="text-xs leading-5 text-text-secondary">
                {needsJourneyReview(snapshot.savedAt)
                  ? "Saved over a week ago. Check this journey and any merchant directions online before your next trip."
                  : "Stops, service and merchant directions may change. Confirm current guidance when online."}
              </AppText>
              <AppText className="text-xs text-text-tertiary">
                Saved {new Date(snapshot.savedAt).toLocaleString()}
              </AppText>
            </InfoBanner>
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="Remove saved journey"
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-full active:bg-surface-muted"
              onPress={() => requestDeletion(selected!)}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={18}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
              <AppText weight="medium" className="text-sm text-text-secondary">
                Remove saved journey
              </AppText>
            </SafePressable>
          </ScrollView>
        ) : (
          <View className="gap-4 px-screen-x py-6">
            <AppText className="text-text-secondary">
              {selected
                ? "This saved journey is damaged or uses an unsupported format. Save it again while online."
                : "This journey is no longer saved on this device."}
            </AppText>
            {selected && (
              <Button
                title="Remove saved journey"
                variant="outline"
                onPress={() => requestDeletion(selected)}
              />
            )}
          </View>
        )
      ) : (
        <FlatList
          data={saved.items}
          keyExtractor={(item) => item.key}
          contentContainerClassName="px-screen-x pb-6"
          ListEmptyComponent={
            <View className="items-center px-4 py-12">
              <Image
                source={require("@/shared/assets/mascot/mascot-no-jeeps.webp")}
                style={{ width: 120, height: 120 }}
                contentFit="contain"
                accessible={false}
              />
              <AppText
                weight="bold"
                className="mt-2 text-center text-md text-text-primary"
              >
                No saved journeys
              </AppText>
              <AppText className="mt-2 text-center text-sm leading-6 text-text-secondary">
                Open jeepney guidance while online and choose Save offline to
                keep it for your next trip.
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-3 overflow-hidden rounded-card border border-border-primary bg-surface">
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel={`View saved guidance for ${item.snapshot?.business.name ?? "unreadable journey"}`}
                className="gap-3 p-4 active:bg-surface-muted"
                onPress={() =>
                  router.push({
                    pathname: "/offline-routes",
                    params: { journeyKey: item.key },
                  })
                }
              >
                {/* Saved destination and actions */}
                <AppText
                  weight="semibold"
                  className="text-base text-text-primary"
                >
                  {item.snapshot?.business.name ?? "Unreadable saved journey"}
                </AppText>
                {item.snapshot ? (
                  <View className="flex-row items-center gap-3">
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-brand px-2.5 py-2">
                      <MaterialCommunityIcons
                        name="bus"
                        size={15}
                        color="#FFFFFF"
                        accessible={false}
                      />
                      <AppText
                        weight="superbold"
                        className="text-base text-white"
                      >
                        {item.snapshot.journey.jeepney_route_code}
                      </AppText>
                    </View>
                    <View className="min-w-0 flex-1">
                      <AppText
                        weight="semibold"
                        className="text-sm leading-5 text-text-primary"
                        numberOfLines={2}
                      >
                        {item.snapshot.journey.route_variant.origin.name} →{" "}
                        {item.snapshot.journey.route_variant.destination.name}
                      </AppText>
                      <AppText className="mt-0.5 text-xs text-text-secondary">
                        {formatJourneyDistance(
                          item.snapshot.journey.ride
                            .approximate_distance_meters,
                        )}{" "}
                        ride
                      </AppText>
                    </View>
                  </View>
                ) : (
                  <AppText className="text-sm text-text-secondary">
                    Save this journey again online.
                  </AppText>
                )}
              </SafePressable>
              <View className="flex-row items-center justify-between border-t border-border-primary/60 px-4 py-1">
                <AppText className="min-w-0 flex-1 text-xs text-text-tertiary">
                  {item.snapshot
                    ? `Saved ${new Date(item.snapshot.savedAt).toLocaleDateString()}`
                    : "Device copy unavailable"}
                </AppText>
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove saved journey to ${item.snapshot?.business.name ?? "unavailable destination"}`}
                  className="h-12 w-12 items-center justify-center rounded-full active:bg-surface-muted"
                  onPress={() => requestDeletion(item)}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={19}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </SafePressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Confirm local deletion */}
      <ConfirmModal
        visible={
          !!toDelete &&
          toDelete.ownerId === saved.ownerId &&
          isAuthSessionGenerationCurrent(toDelete.generation)
        }
        title="Remove saved journey?"
        message="This removes guidance from this device. You can save it again while online."
        confirmText="Remove"
        destructive
        isLoading={isDeleting}
        onCancel={() => {
          if (!deletionPending.current) setToDelete(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </SafeAreaView>
  );
}
