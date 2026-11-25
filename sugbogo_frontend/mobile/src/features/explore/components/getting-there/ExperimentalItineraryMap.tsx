import { useRef } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { theme } from "@/constants/theme";
import MapMarker from "@/shared/components/MapMarker";

import type { ItineraryAccess, ItineraryCoordinate, ItineraryDetail } from "../../types/experimentalItinerary.types";

function validCoordinate({ latitude, longitude }: ItineraryCoordinate) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function validItineraryPath(coordinates: ItineraryCoordinate[]) {
  const first = coordinates[0];
  return coordinates.length >= 2
    && coordinates.every(validCoordinate)
    && coordinates.some(({ latitude, longitude }) =>
      latitude !== first.latitude || longitude !== first.longitude,
    );
}

function markerCoordinate(access: ItineraryAccess) {
  return access.access_coordinate ?? access.route_position;
}

/** Draw stored jeepney geometry and approximate boarding and alighting areas. */
export default function ExperimentalItineraryMap({ itinerary }: { itinerary: ItineraryDetail }) {
  const map = useRef<MapView>(null);
  const rides = itinerary.ride_legs
    .map((ride, index) => ({ ride, index }))
    .filter(({ ride }) => validItineraryPath(ride.geometry));
  const markers = itinerary.ride_legs.flatMap((ride) => [
    { key: `${ride.variant_id}-board`, action: "Boarding", access: ride.boarding, reviewed: ride.route_alignment_status === "reviewed" },
    { key: `${ride.variant_id}-alight`, action: "Alighting", access: ride.alighting, reviewed: ride.route_alignment_status === "reviewed" },
  ]).filter(({ access }) =>
    access.coordinate_status !== "invalid" && validCoordinate(markerCoordinate(access)),
  );

  return (
    <MapView
      ref={map}
      testID="experimental-itinerary-map"
      accessibilityLabel="Jeepney route preview map"
      provider={PROVIDER_GOOGLE}
      toolbarEnabled={false}
      style={{ width: "100%", height: 280 }}
      initialRegion={{ ...itinerary.origin, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
      onMapReady={() => map.current?.fitToCoordinates(
        [
          itinerary.origin,
          itinerary.destination,
          ...rides.flatMap(({ ride }) => ride.geometry),
          ...markers.map(({ access }) => markerCoordinate(access)),
        ],
        { edgePadding: { top: 34, bottom: 34, left: 34, right: 34 }, animated: false },
      )}
    >
      {rides.map(({ ride, index }) => (
        <Polyline
          key={ride.variant_id}
          testID={`itinerary-ride-${index}`}
          coordinates={ride.geometry}
          strokeWidth={5}
          strokeColor={theme.extends.colors.brand}
          zIndex={1}
        />
      ))}
      <Marker coordinate={itinerary.origin} title="Starting point">
        <MapMarker variant="origin" />
      </Marker>
      <Marker coordinate={itinerary.destination} title="Destination">
        <MapMarker variant="destination" />
      </Marker>
      {markers.map(({ key, action, access, reviewed }) => {
        const verified = reviewed && access.passenger_location_verified;
        return (
          <Marker
            key={key}
            testID={`itinerary-${key}`}
            coordinate={markerCoordinate(access)}
            title={verified ? `Verified ${action.toLowerCase()} location` : `${action} candidate`}
            description={verified ? undefined : "Experimental location"}
          >
            <MapMarker variant={verified ? (action === "Boarding" ? "boarding" : "alighting") : "pending"} />
          </Marker>
        );
      })}
    </MapView>
  );
}
