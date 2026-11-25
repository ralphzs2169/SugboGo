import { Fragment, useState } from "react";
import { Linking, View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import { openGoogleMapsWalkingDirections } from "../../services/googleMapsHandoff.service";
import type { ItineraryAccess, ItineraryDetail, ItineraryRide, ItineraryWalk } from "../../types/experimentalItinerary.types";
import { formatJourneyDistance } from "../../utils/directJourney.utils";
import ExperimentalItineraryMap, { validItineraryPath } from "./ExperimentalItineraryMap";
import JourneyStep from "./jeepney-guidance/JourneyStep";

/** Display a direction only when reviewed and free of source-endpoint identifiers. */
function rideInstruction(ride: ItineraryRide) {
  const direction = ride.direction.toward.trim();
  const technical = /source path endpoint|\[endpoint-[^\]]+\]|^endpoint-[\w-]+$/i.test(direction);
  if (ride.route_alignment_status === "reviewed" && direction && !technical) {
    return `Ride ${ride.route_code} toward ${direction}`;
  }
  return `Ride ${ride.route_code}`;
}

function AreaConnection({ walk }: { walk: ItineraryWalk }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const available = walk.from !== null && walk.to !== null && walk.status !== "prohibited_access";

  async function openDirections() {
    if (!walk.from || !walk.to || pending) return;
    setPending(true);
    setFailed(false);
    const result = await openGoogleMapsWalkingDirections(walk.from, walk.to);
    setFailed(result !== "opened");
    setPending(false);
  }

  return (
    <View className="mt-2 gap-2">
      <AppText className="text-xs text-text-secondary">
        {formatJourneyDistance(walk.straight_line_distance_meters)} estimated straight-line distance
      </AppText>
      <AppText className="text-xs text-text-secondary">
        {walk.status === "prohibited_access"
          ? "Passenger access is prohibited here."
          : "Pedestrian access is unverified."}
      </AppText>
      {available && (
        <Button title="Walking directions" variant="outline" loading={pending} disabled={pending} onPress={openDirections} />
      )}
      {failed && <AppText accessibilityLiveRegion="polite">Could not open Google Maps. Try again.</AppText>}
    </View>
  );
}

function GoogleAttribution() {
  return <AppText numberOfLines={1} style={{ fontSize: 12, fontWeight: "400", color: "#5E5E5E" }}>Google Maps</AppText>;
}

function AccessEvidence({ label, access }: { label: string; access: ItineraryAccess }) {
  let status = "location unconfirmed";
  if (access.passenger_location_verified) status = "access checked";
  else if (access.permission === "prohibited") status = "is prohibited here";
  else if (access.coordinate_status === "verified") status = "permission unconfirmed";

  const landmark = access.landmark;
  return (
    <View className="gap-1">
      <AppText className="text-xs text-text-secondary">{label} {status}</AppText>
      {landmark && (
        <View className="gap-1 rounded-lg bg-surface-secondary px-3 py-2">
          <AppText className="text-xs text-text-secondary">Nearby landmark Â· {landmark.name}</AppText>
          <GoogleAttribution />
          {landmark.attributions.map(({ name, url }) => (
            <AppText
              key={`${name}-${url}`}
              className="text-xs text-text-secondary"
              accessibilityRole={/^https?:\/\//i.test(url) ? "link" : undefined}
              onPress={/^https?:\/\//i.test(url) ? () => void Linking.openURL(url).catch(() => {}) : undefined}
            >
              {name}
            </AppText>
          ))}
        </View>
      )}
    </View>
  );
}

/** Shows geometric jeepney guidance and optional external walking directions. */
export default function ExperimentalItineraryDetails({ itinerary }: { itinerary: ItineraryDetail }) {
  const alignmentReviewed = itinerary.route_alignment_status === "reviewed";

  return (
    <View className="gap-4">
      <View className="gap-1">
        <AppText weight="bold" accessibilityRole="header" className="text-lg text-text-primary">
          {itinerary.ride_legs.map((leg) => leg.route_code).join(" → ")}
        </AppText>
        <AppText className="text-sm text-text-secondary">
          {alignmentReviewed
            ? "Suggested areas are approximate. Check pedestrian access and permitted loading locations before travelling."
            : "Geometry preview only. Route alignment and recorded direction are unreviewed. Suggested areas are approximate."}
        </AppText>
      </View>
      <ExperimentalItineraryMap itinerary={itinerary} />
      <AppText className="text-xs text-text-secondary">
        Orange shows stored jeepney geometry. Markers show suggested areas. Pedestrian connectivity and legal boarding permission require independent checks.
      </AppText>
      {/* Access, ordered rides, transfers and destination */}
      <View>
        <JourneyStep number={1} title="Starting point to suggested boarding area" icon="walk">
          <AreaConnection walk={itinerary.access_walk} />
        </JourneyStep>
        {itinerary.ride_legs.map((ride, index) => {
          const transfer = itinerary.transfers[index];
          return (
            <Fragment key={ride.variant_id}>
              <JourneyStep
                number={index * 2 + 2}
                title={rideInstruction(ride)}
                detail={validItineraryPath(ride.geometry)
                  ? `Approximately ${formatJourneyDistance(ride.ride_distance_meters)} along the stored route`
                  : "Jeepney geometry unavailable"}
              >
                <View className="mt-2 gap-2">
                  {ride.route_alignment_status !== "reviewed" && (
                    <AppText className="text-xs text-text-secondary">
                      {ride.route_alignment_status === "disputed" ? "Disputed direction label" : "Unreviewed direction label"}
                    </AppText>
                  )}
                  {ride.route_provenance && (
                    <AppText className="text-xs text-text-secondary">Route source · {ride.route_provenance}</AppText>
                  )}
                  <AccessEvidence label="Suggested boarding area" access={ride.boarding} />
                  <AccessEvidence label="Suggested alighting area" access={ride.alighting} />
                </View>
              </JourneyStep>
              {transfer && (
                <JourneyStep number={index * 2 + 3} title={`Transfer to ${itinerary.ride_legs[index + 1].route_code}`} icon="walk">
                  <AreaConnection walk={transfer.walk} />
                </JourneyStep>
              )}
            </Fragment>
          );
        })}
        <JourneyStep number={itinerary.ride_legs.length * 2 + 1} title="Suggested alighting area to destination" icon="walk" isLast>
          <AreaConnection walk={itinerary.egress_walk} />
        </JourneyStep>
      </View>
    </View>
  );
}
