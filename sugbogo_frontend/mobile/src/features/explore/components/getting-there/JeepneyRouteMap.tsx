import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { theme } from "@/constants/theme";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";

import type {
  DirectJourneyMapCoordinate,
  DirectJourneyMapGuidance,
} from "../../types/directJourney.types";
import MapMarkerCallout from "@/shared/components/MapMarkerCallout";
import Avatar from "@/shared/components/Avatar";
import { useAuthStore } from "@/features/auth/store/auth.store";

type Props = {
  journey: DirectJourneyMapGuidance;
  originLocation: DirectJourneyMapCoordinate;
  originMarkerLabel: "Current location" | "Starting point";
  originMarkerTitle: string;
  businessName: string;
};

const INITIAL_DELTA = 0.04;

const JOURNEY_EDGE_PADDING = {
  top: 150,
  right: 48,
  bottom: 220,
  left: 48,
};

const FULL_VARIANT_COLOR = "#B8BDC7";
const PROXIMITY_CONNECTOR_COLOR = "#4B5563";
const EXPLORER_MARKER_COLOR = "#2563EB";
const BOARDING_MARKER_COLOR = "#16A34A";

const PROXIMITY_CONNECTOR_WIDTH = 3;
const PROXIMITY_CONNECTOR_DASH = [5, 5];

/**
 * Displays a selected jeepney journey on an interactive full-screen map.
 *
 * Shows approximate access and egress connections while emphasizing the
 * backend-provided boarding-to-alighting jeepney segment.
 */
export default function JeepneyRouteMap({
  journey,
  originLocation,
  originMarkerLabel,
  originMarkerTitle,
  businessName,
}: Props) {
  const avatarUrl = useAuthStore((state) => state.user?.avatar_url ?? null);

  const avatarKey = useAuthStore((state) => state.user?.avatar_key ?? null);

  const mapRef = useRef<MapView>(null);
  const fittedJourneyRef = useRef<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const journeyKey = [
    journey.route_variant.id,
    journey.boarding_transit_point.id,
    journey.alighting_transit_point.id,
  ].join("-");

  const fitJourneyOnce = useCallback(() => {
    if (
      !isMapReady ||
      !mapRef.current ||
      journey.ride.selected_segment_geometry.length === 0 ||
      fittedJourneyRef.current === journeyKey
    ) {
      return;
    }

    fittedJourneyRef.current = journeyKey;

    mapRef.current.fitToCoordinates(
      [
        originLocation,
        journey.boarding_transit_point,
        ...journey.ride.selected_segment_geometry,
        journey.alighting_transit_point,
        journey.business_location,
      ],
      {
        edgePadding: JOURNEY_EDGE_PADDING,
        animated: false,
      },
    );
  }, [originLocation, isMapReady, journey, journeyKey]);

  useEffect(() => {
    fitJourneyOnce();
  }, [fitJourneyOnce]);

  return (
    <View className="flex-1">
      {/* Full-screen journey map */}
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
        onMapReady={() => setIsMapReady(true)}
        onMapLoaded={fitJourneyOnce}
        {...(Platform.OS === "android" && {
          mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
        })}
      >
        {/* Full jeepney route context */}
        <Polyline
          testID="full-route-variant"
          coordinates={journey.ride.full_variant_geometry}
          strokeColor={FULL_VARIANT_COLOR}
          strokeWidth={3}
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

        {/* Selected jeepney ride segment */}
        <Polyline
          testID="selected-ride-segment"
          coordinates={journey.ride.selected_segment_geometry}
          strokeColor={theme.extends.colors.brand}
          strokeWidth={7}
          lineCap="round"
          lineJoin="round"
          zIndex={3}
        />

        {/* Journey markers */}
        <Marker
          testID="explorer-location-marker"
          coordinate={originLocation}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          {/* Explorer avatar */}
          <View
            collapsable={false}
            className="rounded-full border-2 border-white"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.22,
              shadowRadius: 5,
              shadowOffset: {
                width: 0,
                height: 2,
              },
              elevation: 6,
            }}
          >
            <Avatar imageUrl={avatarUrl} avatarKey={avatarKey} size={40} />
          </View>

          <MapMarkerCallout
            label={originMarkerLabel}
            title={originMarkerTitle}
            labelColor={EXPLORER_MARKER_COLOR}
          />
        </Marker>

        <Marker
          testID="boarding-transit-point-marker"
          coordinate={journey.boarding_transit_point}
          pinColor={BOARDING_MARKER_COLOR}
        >
          <View collapsable={false}>
            <MapMarker variant="boarding" />
          </View>

          <MapMarkerCallout
            label="Board here"
            title={journey.boarding_transit_point.name}
            description="Approximate connection from your location"
            labelColor={BOARDING_MARKER_COLOR}
          />
        </Marker>

        <Marker
          testID="alighting-transit-point-marker"
          coordinate={journey.alighting_transit_point}
          pinColor={theme.extends.colors.brand}
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
            labelColor={theme.extends.colors.brand}
          />
        </Marker>

        <Marker
          testID="business-destination-marker"
          coordinate={journey.business_location}
        >
          <View collapsable={false}>
            <MapMarker variant="business" />
          </View>

          <MapMarkerCallout
            label="Destination"
            title={businessName}
            labelColor={theme.extends.colors.brand}
          />
        </Marker>
      </MapView>
    </View>
  );
}
