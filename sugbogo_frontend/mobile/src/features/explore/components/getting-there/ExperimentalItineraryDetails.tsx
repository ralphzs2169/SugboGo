import { Fragment } from "react";
import { Linking, View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { ItineraryAccess, ItineraryDetail, ItineraryWalk, WalkStatus } from "../../types/experimentalItinerary.types";
import { formatJourneyDistance } from "../../utils/directJourney.utils";
import { formatRoadRouteDuration } from "../../utils/roadRoute.utils";
import ExperimentalItineraryMap, { mappedWalkingPath, validItineraryPath } from "./ExperimentalItineraryMap";
import JourneyStep from "./jeepney-guidance/JourneyStep";

const googleWalkingWarning = "Google walking routes are in beta and may omit sidewalks or pedestrian paths.";

export function providerUnavailable(status: WalkStatus) {
  return ["timeout", "quota_or_billing", "provider_error"].includes(status);
}

function walkDescription(walk: ItineraryWalk) {
  if (walk.status === "available" && walk.mapped_distance_meters !== null) {
    if (walk.mapped_distance_meters === 0) return "Same mapped location";
    const distance = formatJourneyDistance(walk.mapped_distance_meters);
    const duration = walk.duration_seconds === null || walk.duration_seconds === 0 ? "" : ` · ${formatRoadRouteDuration(walk.duration_seconds)}`;
    const missingMap = mappedWalkingPath(walk).length === 0 ? " · path unavailable on the map" : "";
    return `${distance} walking${duration}${missingMap}`;
  }
  if (walk.status === "prohibited_access") return "Passenger access is prohibited here";
  if (walk.status === "no_route") return "No mapped walking path found";
  if (walk.status === "distance_limit") {
    if (walk.provider_distance_meters != null && walk.distance_limit_meters != null) {
      return `Mapped walk ${formatJourneyDistance(walk.provider_distance_meters)} · preview limit ${formatJourneyDistance(walk.distance_limit_meters)}`;
    }
    return "The mapped walk is too far for this itinerary";
  }
  if (walk.status === "unsuitable_endpoints" && walk.diagnostic_code === "collapsed_provider_path") {
    return "The walking service could not connect these two locations reliably";
  }
  if (walk.status === "unsuitable_endpoints" || walk.status === "invalid_coordinates") {
    return "A walking path to this location could not be confirmed";
  }
  if (providerUnavailable(walk.status)) return "Walking check unavailable";
  return "Walking path still needs checking";
}

function GoogleAttribution() {
  return <AppText numberOfLines={1} style={{ fontSize: 12, fontWeight: "400", color: "#5E5E5E" }}>Google Maps</AppText>;
}

function WalkingEvidence({ walk }: { walk: ItineraryWalk }) {
  if (!walk.source) return null;
  return (
    <View className="mt-2 gap-1 rounded-lg bg-surface-secondary px-3 py-2">
      {Array.from(new Set(walk.warnings)).map((warning) => (
        <AppText key={warning} className="text-xs text-text-secondary">{warning}</AppText>
      ))}
      <GoogleAttribution />
    </View>
  );
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
          <AppText className="text-xs text-text-secondary">Nearby landmark · {landmark.name}</AppText>
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

/** Show ordered review evidence, distinct ride and walk geometry, and provider attribution. */
export default function ExperimentalItineraryDetails({ itinerary }: { itinerary: ItineraryDetail }) {
  const alignmentReviewed = itinerary.route_alignment_status === "reviewed";
  const hasGoogleWalk = [
    itinerary.access_walk,
    ...itinerary.transfers.map((transfer) => transfer.walk),
    itinerary.egress_walk,
  ].some((walk) => walk.source === "google_routes");

  return (
    <View className="gap-4">
      <View className="gap-1">
        <AppText weight="bold" accessibilityRole="header" className="text-lg text-text-primary">
          {itinerary.ride_legs.map((leg) => leg.route_code).join(" → ")}
        </AppText>
        <AppText className="text-sm text-text-secondary">
          {itinerary.has_blocking_evidence
            ? "Diagnostic preview only. A walking connection failed validation. Do not follow this itinerary."
            : !alignmentReviewed
            ? "Geometry preview only. Jeepney service and direction along this path are unconfirmed. Do not use it for boarding."
            : itinerary.passenger_ready
            ? "Passenger access verified"
            : "Experimental preview. Use only confirmed boarding and alighting locations when you travel."}
        </AppText>
      </View>
      <ExperimentalItineraryMap itinerary={itinerary} />
      {hasGoogleWalk && (
        <AppText className="text-xs text-text-secondary">{googleWalkingWarning}</AppText>
      )}
      <AppText className="text-xs text-text-secondary">
        Orange shows jeepney routes. Dashed blue shows mapped walks. Unconfirmed markers show possible locations.
      </AppText>
      <View>
        <JourneyStep number={1} title="From your starting point to the first ride" detail={walkDescription(itinerary.access_walk)} icon="walk">
          <WalkingEvidence walk={itinerary.access_walk} />
        </JourneyStep>
        {itinerary.ride_legs.map((ride, index) => {
          const transfer = itinerary.transfers[index];
          const routeReviewed = ride.route_alignment_status === "reviewed";
          return (
            <Fragment key={ride.variant_id}>
              <JourneyStep
                number={index * 2 + 2}
                title={routeReviewed ? `${ride.route_code} toward ${ride.direction.toward}` : ride.route_code}
                detail={validItineraryPath(ride.geometry)
                  ? `${formatJourneyDistance(ride.ride_distance_meters)} ride`
                  : "Jeepney path unavailable on the map"}
              >
                <View className="mt-2 gap-2">
                  {!routeReviewed && (
                    <AppText className="text-xs text-text-secondary">
                      {ride.route_alignment_status === "disputed" ? "Disputed direction label" : "Unreviewed direction label"}
                      {ride.direction.toward ? ` · toward ${ride.direction.toward}` : ""}
                    </AppText>
                  )}
                  {ride.route_provenance && (
                    <AppText className="text-xs text-text-secondary">Route source · {ride.route_provenance}</AppText>
                  )}
                  <AccessEvidence label="Boarding" access={ride.boarding} />
                  <AccessEvidence label="Alighting" access={ride.alighting} />
                </View>
              </JourneyStep>
              {transfer && (
                <JourneyStep
                  number={index * 2 + 3}
                  title={`Change to ${itinerary.ride_legs[index + 1].route_code}`}
                  detail={walkDescription(transfer.walk)}
                  icon="walk"
                >
                  <AppText className="mt-1 text-xs text-text-secondary">
                    {alignmentReviewed && transfer.passenger_ready
                      ? "Passenger access verified"
                      : transfer.passenger_access_verified
                        ? "Walking access checked · jeepney route still under review"
                      : transfer.validation_status === "pedestrian_validated"
                        ? "Mapped walk · transfer locations unconfirmed"
                        : "Transfer locations unconfirmed"}
                  </AppText>
                  <WalkingEvidence walk={transfer.walk} />
                </JourneyStep>
              )}
            </Fragment>
          );
        })}
        <JourneyStep
          number={itinerary.ride_legs.length * 2 + 1}
          title="From the last ride to your destination"
          detail={walkDescription(itinerary.egress_walk)}
          icon="walk"
          isLast
        >
          <WalkingEvidence walk={itinerary.egress_walk} />
        </JourneyStep>
      </View>
    </View>
  );
}
