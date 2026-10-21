import { router } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import JeepneyStopGuidanceCard from "@/features/explore/components/getting-there/jeepney-guidance/jeep-guide-map/JeepneyStopGuidanceCard";
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [toDelete, setToDelete] = useState<{
    ownerId: number;
    item: SavedJourneyListItem;
  } | null>(null);
  const [isDeleting, setDeleting] = useState(false);
  const deletionPending = useRef(false);
  const selected = saved.items.find((item) => item.key === journeyKey);
  const snapshot = selected?.snapshot;

  function requestDeletion(item: SavedJourneyListItem) {
    if (saved.ownerId) setToDelete({ ownerId: saved.ownerId, item });
  }

  async function handleDelete() {
    if (!toDelete || !saved.ownerId || deletionPending.current) return;
    if (toDelete.ownerId !== saved.ownerId) {
      setToDelete(null);
      return;
    }
    deletionPending.current = true;
    setDeleting(true);
    try {
      await deleteSavedJourney(toDelete.ownerId, toDelete.item.key);
      setToDelete(null);
      await saved.reload();
      if (journeyKey) router.replace("/offline-routes");
    } catch {
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

  function handleBack() {
    if (journeyKey) router.replace("/offline-routes");
    else if (isAuthenticated && router.canGoBack()) router.back();
    else router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Local guidance header */}
      <View className="gap-3 px-screen-x pb-3 pt-3">
        <View className="flex-row items-center justify-between gap-3">
          <AppText weight="bold" className="flex-1 text-xl text-text-primary">
            Offline Data
          </AppText>
          <Button
            title={journeyKey || isAuthenticated ? "Back" : "Sign in"}
            size="sm"
            variant="outline"
            onPress={handleBack}
          />
        </View>
        <AppText className="text-sm text-text-secondary">
          {journeyKey
            ? "Saved jeepney guidance. No live routing or service updates."
            : "Business information and jeepney guidance saved on this device."}
        </AppText>
        {!journeyKey && saved.ownerId && (
          <View className="gap-4 pt-2">
            <Button
              title="Browse saved businesses"
              variant="outline"
              onPress={() => router.push("/offline-pockets")}
            />
            <AppText weight="bold" className="text-base text-text-primary">
              Saved journeys
            </AppText>
          </View>
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
              <AppText weight="semibold" className="text-brand">
                {snapshot.journey.jeepney_route_code} ·{" "}
                {snapshot.journey.route_variant.origin.name} →{" "}
                {snapshot.journey.route_variant.destination.name}
              </AppText>
              <AppText className="text-sm text-text-secondary">
                Saved {new Date(snapshot.savedAt).toLocaleString()}
              </AppText>
              <AppText className="text-sm text-text-secondary">
                Saved starting point: {snapshot.origin.label}
              </AppText>
              <AppText className="text-sm text-text-secondary">
                {needsJourneyReview(snapshot.savedAt)
                  ? "Saved over a week ago. Check this journey online before your next trip."
                  : "This is a saved snapshot. Confirm current stops and service when online."}
              </AppText>
            </View>
            {/* Text guidance remains usable without map tiles or GPS */}
            <JeepneyStopGuidanceCard
              boardingPointName={snapshot.journey.boarding_transit_point.name}
              boardingDistance={formatJourneyDistance(
                calculateDistanceInKm(
                  snapshot.origin.latitude,
                  snapshot.origin.longitude,
                  snapshot.journey.boarding_transit_point.latitude,
                  snapshot.journey.boarding_transit_point.longitude,
                ) * 1000,
              )}
              alightingPointName={snapshot.journey.alighting_transit_point.name}
              destinationDistance={formatJourneyDistance(
                calculateDistanceInKm(
                  snapshot.journey.alighting_transit_point.latitude,
                  snapshot.journey.alighting_transit_point.longitude,
                  snapshot.journey.business_location.latitude,
                  snapshot.journey.business_location.longitude,
                ) * 1000,
              )}
              landmarkName={snapshot.journey.landmark_context?.name}
            />
            <AppText className="text-sm text-text-secondary">
              Approximate ride distance:{" "}
              {formatJourneyDistance(
                snapshot.journey.ride.approximate_distance_meters,
              )}
              . Access distances are straight-line estimates from the saved
              starting point.
            </AppText>
            <Button
              title="Remove saved journey"
              variant="outline"
              onPress={() => requestDeletion(selected!)}
            />
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
            <AppText className="py-6 text-text-secondary">
              No saved journeys yet. Open a jeepney journey while online and
              choose Save offline.
            </AppText>
          }
          renderItem={({ item }) => (
            <View className="gap-3 border-b border-border-primary py-4">
              {/* Saved destination and actions */}
              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                {item.snapshot?.business.name ?? "Unreadable saved journey"}
              </AppText>
              <AppText className="text-sm text-text-secondary">
                {item.snapshot
                  ? `${item.snapshot.journey.jeepney_route_code} · Saved ${new Date(item.snapshot.savedAt).toLocaleDateString()}`
                  : "Remove this entry or save it again online."}
              </AppText>
              <View className="flex-row gap-3">
                <Button
                  title="View guidance"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onPress={() =>
                    router.push({
                      pathname: "/offline-routes",
                      params: { journeyKey: item.key },
                    })
                  }
                />
                <Button
                  title="Remove"
                  size="sm"
                  variant="outline"
                  onPress={() => requestDeletion(item)}
                />
              </View>
            </View>
          )}
        />
      )}

      {/* Confirm local deletion */}
      <ConfirmModal
        visible={!!toDelete && toDelete.ownerId === saved.ownerId}
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
