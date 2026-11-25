import type { ReactNode } from "react";
import { Linking, Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";
import { RouteBadge, RIDE_COLORS } from "./ItineraryPresentation";
import { formatJourneyDistance } from "../../utils/directJourney.utils";
import type {
  ItineraryAccess,
  ItineraryDetail,
} from "../../types/experimentalItinerary.types";
import type { JourneyMapStep } from "./ExperimentalItineraryMap";

function near(access: ItineraryAccess, fallback: string) {
  return access.landmark ? `near ${access.landmark.name}` : fallback;
}

/** Group presentation only when the supplied points and landmark context agree. */
export function sharesTransferArea(
  alighting: ItineraryAccess,
  boarding: ItineraryAccess,
  gapMeters: number,
) {
  const from = alighting.access_coordinate ?? alighting.route_position;
  const to = boarding.access_coordinate ?? boarding.route_position;
  return (
    gapMeters < 1 &&
    alighting.coordinate_status !== "invalid" &&
    boarding.coordinate_status !== "invalid" &&
    from.latitude === to.latitude &&
    from.longitude === to.longitude &&
    (!alighting.landmark ||
      !boarding.landmark ||
      alighting.landmark.place_id === boarding.landmark.place_id)
  );
}

/** Keep required source credits with their location instead of repeating a landmark list. */
function LandmarkCredit({ accesses }: { accesses: ItineraryAccess[] }) {
  const landmarks = accesses.flatMap((access) =>
    access.landmark ? [access.landmark] : [],
  );
  if (!landmarks.length) return null;
  return (
    <View className="mt-1">
      <AppText className="text-[10px] text-text-secondary">Google Maps</AppText>
      {landmarks
        .flatMap((landmark) => landmark.attributions)
        .filter(
          (credit, index, all) =>
            all.findIndex(
              (other) => other.name === credit.name && other.url === credit.url,
            ) === index,
        )
        .map((credit, index) => (
          <AppText
            key={index}
            className="text-[10px] text-text-secondary"
            accessibilityRole={
              /^https?:\/\//i.test(credit.url) ? "link" : undefined
            }
            onPress={() => {
              if (/^https?:\/\//i.test(credit.url))
                void Linking.openURL(credit.url).catch(() => {});
            }}
          >
            {credit.name}
          </AppText>
        ))}
    </View>
  );
}

function TimelineRow({
  color,
  solid,
  connector = true,
  testID,
  children,
}: {
  color: string;
  solid?: boolean;
  connector?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-row">
      <View className="w-5 items-center">
        <View
          style={{
            borderColor: color,
            backgroundColor: solid ? color : "white",
          }}
          className="h-3 w-3 rounded-full border-2"
        />
        {connector &&
          (solid ? (
            <View
              testID={testID}
              style={{ backgroundColor: color }}
              className="w-0.5 flex-1"
            />
          ) : (
            <View testID={testID} className="flex-1">
              <DottedTimelineConnector className="w-0.5 flex-1" />
            </View>
          ))}
      </View>
      <View className="min-w-0 flex-1 pb-4 pl-2">{children}</View>
    </View>
  );
}

/** Compact ordered access, ride and transfer rows for every supported journey depth. */
export function JourneyTimeline({
  detail,
  destinationName,
  compact = false,
  onSelectRide,
  onSelectAccess,
  selectedStep,
  renderAccessDetails,
}: {
  detail: ItineraryDetail;
  destinationName: string;
  compact?: boolean;
  onSelectRide?: (index: number) => void;
  onSelectAccess?: (step: JourneyMapStep) => void;
  selectedStep?: JourneyMapStep | null;
  renderAccessDetails?: () => ReactNode;
}) {
  const first = detail.ride_legs[0];
  return (
    <View>
      <TimelineRow color="#9CA3AF">
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectAccess?.({ kind: "access", index: 0 })}
        >
          <AppText weight="bold" className="text-sm">
            Head to boarding area
          </AppText>
          <AppText className="mt-1 text-xs leading-5 text-text-secondary">
            {first.boarding.landmark
              ? `Near ${first.boarding.landmark.name} · `
              : ""}
            ~
            {formatJourneyDistance(
              detail.access_walk.straight_line_distance_meters,
            )}{" "}
            straight-line
          </AppText>
        </Pressable>

        {selectedStep?.kind === "access" && renderAccessDetails?.()}
      </TimelineRow>
      {detail.ride_legs.map((ride, index) => {
        const next = detail.ride_legs[index + 1];
        const transfer = detail.transfers[index];
        const previous = detail.ride_legs[index - 1];
        const grouped = Boolean(
          next &&
          sharesTransferArea(
            ride.alighting,
            next.boarding,
            transfer.walk.straight_line_distance_meters,
          ),
        );
        const previousGrouped = Boolean(
          previous &&
          sharesTransferArea(
            previous.alighting,
            ride.boarding,
            detail.transfers[index - 1].walk.straight_line_distance_meters,
          ),
        );
        const transferArea = ride.alighting.landmark
          ? ride.alighting
          : (next?.boarding ?? ride.alighting);
        return (
          <View key={ride.variant_id}>
            <TimelineRow
              color={RIDE_COLORS[index]}
              solid
              testID={`solid-ride-${index}`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Focus ride ${ride.route_code}`}
                onPress={() => onSelectRide?.(index)}
                className="flex-row items-center gap-2"
              >
                <RouteBadge code={ride.route_code} index={index} compact />
                <AppText weight="bold" className="text-sm">
                  Board and ride
                </AppText>
              </Pressable>
              {previous && !previousGrouped && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    onSelectAccess?.({ kind: "transfer", index: index - 1 })
                  }
                >
                  <AppText className="mt-1 text-xs text-text-secondary">
                    Board {near(ride.boarding, "at the suggested area")}
                  </AppText>
                </Pressable>
              )}
              {!compact &&
                ride.route_alignment_status === "reviewed" &&
                ride.direction.toward.trim() &&
                !/source path endpoint|endpoint-/i.test(
                  ride.direction.toward,
                ) && (
                  <AppText className="mt-1 text-xs text-text-secondary">
                    Toward {ride.direction.toward}
                  </AppText>
                )}
              <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                {formatJourneyDistance(ride.ride_distance_meters)} ride
              </AppText>
              {(ride.boarding.permission === "prohibited" ||
                ride.alighting.permission === "prohibited") && (
                <AppText className="mt-1 text-xs text-error">
                  Passenger access is prohibited here.
                </AppText>
              )}
              {ride.route_alignment_status === "disputed" && (
                <AppText className="mt-1 text-xs text-error">
                  This route direction is disputed.
                </AppText>
              )}
            </TimelineRow>
            <TimelineRow
              color={RIDE_COLORS[index]}
              testID={next ? `dotted-transfer-${index}` : undefined}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onSelectAccess?.({
                    kind: next ? "transfer" : "egress",
                    index: next ? index : 0,
                  })
                }
              >
                <AppText weight="bold" className="text-sm">
                  {grouped
                    ? `Transfer ${near(transferArea, "at the suggested area")}`
                    : `Get off ${near(ride.alighting, "at the suggested area")}`}
                </AppText>
                <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                  {next && transfer
                    ? grouped
                      ? `Get off ${ride.route_code} and locate ${next.route_code} nearby. Same approximate area; check safe access.`
                      : `Transfer to ${next.route_code} · ~${formatJourneyDistance(transfer.walk.straight_line_distance_meters)} straight-line`
                    : `~${formatJourneyDistance(detail.egress_walk.straight_line_distance_meters)} straight-line to destination`}
                </AppText>
              </Pressable>
              {((selectedStep?.kind === "transfer" &&
                selectedStep.index === index) ||
                (!next && selectedStep?.kind === "egress")) &&
                renderAccessDetails?.()}
            </TimelineRow>
          </View>
        );
      })}
      <TimelineRow color="#15803D" solid connector={false}>
        <AppText weight="bold" className="text-sm">
          Arrive at destination
        </AppText>
        <AppText className="mt-1 text-xs leading-5 text-text-secondary">
          {destinationName}
        </AppText>
      </TimelineRow>
      <LandmarkCredit
        accesses={detail.ride_legs.flatMap((ride) => [
          ride.boarding,
          ride.alighting,
        ])}
      />
    </View>
  );
}
