import { useCallback, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";
import MapMarkerCallout from "@/shared/components/MapMarkerCallout";

import useJeepneyRouteMapCamera from "../../hooks/useJeepneyRouteMapCamera";
import type {
  DirectJourneyMapCoordinate,
  DirectJourneyMapGuidance,
} from "../../types/directJourney.types";

type Props = {
  journey: DirectJourneyMapGuidance;
  originLocation: DirectJourneyMapCoordinate;
  originMarkerLabel: "Current location" | "Starting point";
  originMarkerTitle: string;
  businessName: string;
  businessCoverPhotoUrl: string | null;
};

const INITIAL_DELTA = 0.04;

const FULL_VARIANT_COLOR = "#B8BDC7";
const PROXIMITY_CONNECTOR_COLOR = "#4B5563";

const EXPLORER_MARKER_COLOR = theme.extends.colors.brand;
const BOARDING_MARKER_COLOR = "#3B82F6";
const ALIGHTING_MARKER_COLOR = "#22C55E";

const PROXIMITY_CONNECTOR_WIDTH = 3;
const PROXIMITY_CONNECTOR_DASH = [5, 5];

const MARKER_COLLISION_DISTANCE = 10;

const SELECTED_ROUTE_COLOR = theme.extends.colors.brand;

/**
 * Displays a selected Jeepney journey on an interactive full-screen map.
 *
 * Renders journey geometry and map markers while delegating camera fitting
 * and marker focus behavior to the dedicated journey-map camera hook.
 */
export default function JeepneyRouteMap({
  journey,
  originLocation,
  originMarkerLabel,
  originMarkerTitle,
  businessName,
  businessCoverPhotoUrl,
}: Props) {
  const avatarUrl = useAuthStore((state) => state.user?.avatar_url ?? null);
  const avatarKey = useAuthStore((state) => state.user?.avatar_key ?? null);

  const {
    mapRef,
    handleMapLayout,
    handleMapReady,
    focusMarker,
    fitJourneyOnce,
  } = useJeepneyRouteMapCamera({
    journey,
    originLocation,
  });

  const [showExplorerMarker, setShowExplorerMarker] = useState(true);
  const [showBusinessMarker, setShowBusinessMarker] = useState(true);

  const updateMarkerVisibility = useCallback(async () => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    try {
      const [explorerPoint, boardingPoint, alightingPoint, businessPoint] =
        await Promise.all([
          map.pointForCoordinate(originLocation),
          map.pointForCoordinate(journey.boarding_transit_point),
          map.pointForCoordinate(journey.alighting_transit_point),
          map.pointForCoordinate(journey.business_location),
        ]);

      const explorerToBoardingDistance = Math.hypot(
        explorerPoint.x - boardingPoint.x,
        explorerPoint.y - boardingPoint.y,
      );

      const alightingToBusinessDistance = Math.hypot(
        alightingPoint.x - businessPoint.x,
        alightingPoint.y - businessPoint.y,
      );

      setShowExplorerMarker(
        explorerToBoardingDistance >= MARKER_COLLISION_DISTANCE,
      );

      setShowBusinessMarker(
        alightingToBusinessDistance >= MARKER_COLLISION_DISTANCE,
      );
    } catch {
      setShowExplorerMarker(true);
      setShowBusinessMarker(true);
    }
  }, [
    journey.alighting_transit_point,
    journey.boarding_transit_point,
    journey.business_location,
    mapRef,
    originLocation,
  ]);

  return (
    <View className="flex-1" onLayout={handleMapLayout}>
      {/* Journey map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        style={{
          width: "100%",
          height: "100%",
        }}
        initialRegion={{
          latitude: journey.boarding_transit_point.latitude,
          longitude: journey.boarding_transit_point.longitude,
          latitudeDelta: INITIAL_DELTA,
          longitudeDelta: INITIAL_DELTA,
        }}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={handleMapReady}
        onMapLoaded={fitJourneyOnce}
        onRegionChangeComplete={() => {
          void updateMarkerVisibility();
        }}
        {...(Platform.OS === "android" && {
          mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
        })}
      >
        {/* Full Jeepney route context */}
        <Polyline
          testID="full-route-variant"
          coordinates={journey.ride.full_variant_geometry}
          strokeColor={FULL_VARIANT_COLOR}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
          zIndex={1}
        />

        {/* Approximate access and egress connections */}
        <Polyline
          testID="explorer-to-boarding-connector"
          coordinates={[originLocation, journey.boarding_transit_point]}
          strokeColor={PROXIMITY_CONNECTOR_COLOR}
          strokeWidth={PROXIMITY_CONNECTOR_WIDTH}
          lineDashPattern={PROXIMITY_CONNECTOR_DASH}
          lineCap="round"
          zIndex={2}
        />

        <Polyline
          testID="alighting-to-business-connector"
          coordinates={[
            journey.alighting_transit_point,
            journey.business_location,
          ]}
          strokeColor={PROXIMITY_CONNECTOR_COLOR}
          strokeWidth={PROXIMITY_CONNECTOR_WIDTH}
          lineDashPattern={PROXIMITY_CONNECTOR_DASH}
          lineCap="round"
          zIndex={2}
        />

        {/* Selected Jeepney ride */}

        <Polyline
          testID="selected-ride-segment"
          coordinates={journey.ride.selected_segment_geometry}
          strokeColor={SELECTED_ROUTE_COLOR}
          strokeWidth={7}
          lineCap="round"
          lineJoin="round"
          zIndex={3}
        />

        {/* Explorer origin */}
        {showExplorerMarker && (
          <Marker
            testID="explorer-location-marker"
            coordinate={originLocation}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              void focusMarker(originLocation);
            }}
          >
            <View collapsable={false}>
              <MapMarker
                variant="explorer"
                imageUrl={avatarUrl}
                avatarKey={avatarKey}
              />
            </View>

            <MapMarkerCallout
              label={originMarkerLabel}
              title={originMarkerTitle}
              labelColor={EXPLORER_MARKER_COLOR}
            />
          </Marker>
        )}

        {/* Boarding point */}
        <Marker
          testID="boarding-transit-point-marker"
          coordinate={journey.boarding_transit_point}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => {
            void focusMarker(journey.boarding_transit_point);
          }}
        >
          <View collapsable={false}>
            <MapMarker variant="boarding" />
          </View>

          <MapMarkerCallout
            label="Board here"
            title={journey.boarding_transit_point.name}
            description="Approximate connection from your starting point"
            labelColor={BOARDING_MARKER_COLOR}
          />
        </Marker>

        {/* Alighting point */}
        <Marker
          testID="alighting-transit-point-marker"
          coordinate={journey.alighting_transit_point}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => {
            void focusMarker(journey.alighting_transit_point);
          }}
        >
          <View collapsable={false}>
            <MapMarker variant="alighting" />
          </View>

          <MapMarkerCallout
            label="Get off here"
            title={journey.alighting_transit_point.name}
            description={
              journey.landmark_context
                ? `Near ${journey.landmark_context.name}`
                : "Approximate connection to your destination"
            }
            labelColor={ALIGHTING_MARKER_COLOR}
          />
        </Marker>

        {/* Business destination */}
        {showBusinessMarker && (
          <Marker
            testID="business-destination-marker"
            coordinate={journey.business_location}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              void focusMarker(journey.business_location);
            }}
          >
            <View collapsable={false}>
              <MapMarker
                variant="destination"
                imageUrl={businessCoverPhotoUrl}
              />
            </View>

            <MapMarkerCallout
              label="Destination"
              title={businessName}
              labelColor={theme.extends.colors.brand}
            />
          </Marker>
        )}
      </MapView>
    </View>
  );
}
