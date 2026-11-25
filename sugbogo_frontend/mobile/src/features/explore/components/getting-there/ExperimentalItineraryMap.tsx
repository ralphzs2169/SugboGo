import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { ANDROID_LIGHT_MAP_STYLE } from "@/shared/constants/androidLightMapStyle";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import { useAuthStore } from "@/features/auth/store/auth.store";
import MapMarker from "@/shared/components/MapMarker";
import AppText from "@/shared/components/AppText";
import SnapshotMapMarker from "@/shared/components/map-related/SnapshotMapMarker";
import { RIDE_COLORS } from "./ItineraryPresentation";
import type {
  ItineraryAccess,
  ItineraryCoordinate,
  ItineraryDetail,
} from "../../types/experimentalItinerary.types";

export type JourneyMapStep = {
  kind: "ride" | "transfer" | "access" | "egress";
  index: number;
};
function validCoordinate(point: ItineraryCoordinate) {
  return (
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}
export function validItineraryPath(path: ItineraryCoordinate[]) {
  return (
    path.length >= 2 &&
    path.every(validCoordinate) &&
    path.some(
      (p) =>
        p.latitude !== path[0].latitude || p.longitude !== path[0].longitude,
    )
  );
}
export function accessPoint(access: ItineraryAccess) {
  return access.access_coordinate ?? access.route_position;
}
/** Keep labels anchored to access coordinates, never to the nearby landmark pin. */
export function journeyLabels(detail: ItineraryDetail) {
  const first = detail.ride_legs[0];
  const last = detail.ride_legs[detail.ride_legs.length - 1];
  return [
    {
      id: "access:0",
      access: first.boarding,
      color: RIDE_COLORS[0],
      text: first.boarding.landmark
        ? `Board near ${first.boarding.landmark.name}`
        : "Suggested boarding area",
      step: { kind: "access", index: 0 } as JourneyMapStep,
    },
    ...detail.transfers.map((_, index) => {
      const access = detail.ride_legs[index].alighting;
      return {
        id: `transfer:${index}`,
        access,
        color: RIDE_COLORS[index],
        text: access.landmark
          ? `Transfer near ${access.landmark.name}`
          : "Suggested transfer area",
        step: { kind: "transfer", index } as JourneyMapStep,
      };
    }),
    {
      id: "egress:0",
      access: last.alighting,
      color: RIDE_COLORS[detail.ride_legs.length - 1],
      text: last.alighting.landmark
        ? `Get off near ${last.alighting.landmark.name}`
        : "Suggested alighting area",
      step: { kind: "egress", index: 0 } as JourneyMapStep,
    },
  ]
    .map((label) =>
      label.access.permission === "prohibited"
        ? { ...label, text: "Passenger access prohibited here" }
        : label,
    )
    .filter(
      (label) =>
        label.access.coordinate_status !== "invalid" &&
        validCoordinate(accessPoint(label.access)),
    );
}
/** Render simultaneous Android bitmap labels with the dot, not the bubble, at the coordinate. */
function LabeledPoint({
  coordinate,
  text,
  color,
  onPress,
  selected,
}: {
  coordinate: ItineraryCoordinate;
  text?: string;
  color: string;
  onPress: () => void;
  selected: boolean;
}) {
  const [height, setHeight] = useState(16);
  return (
    <SnapshotMapMarker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: (height - 8) / height }}
      snapshotKey={`${text}:${selected}:${height}`}
      onPress={onPress}
      zIndex={selected ? 20 : 5}
    >
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        className="items-center"
      >
        {text && (
          <View className="mb-2 max-w-36 rounded-lg border border-border-primary bg-white px-2 py-1">
            <AppText
              weight="semibold"
              className="text-[11px] leading-4 text-text-primary"
              numberOfLines={selected ? 5 : 3}
            >
              {text}
            </AppText>
          </View>
        )}
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: selected ? 4 : 3,
            borderColor: color,
            backgroundColor: "white",
          }}
        />
      </View>
    </SnapshotMapMarker>
  );
}
/** Draw the selected journey with geometric access guides and sheet-aware camera focus. */
export default function ExperimentalItineraryMap({
  itinerary,
  destinationName = "Destination",
  destinationPhotoUrl,
  sheetHeight = 170,
  headerBottom = 150,
  selectedStep = null,
  onSelectStep,
  overviewVersion = 0,
}: {
  itinerary: ItineraryDetail;
  destinationName?: string;
  destinationPhotoUrl?: string | null;
  sheetHeight?: number;
  headerBottom?: number;
  selectedStep?: JourneyMapStep | null;
  onSelectStep?: (step: JourneyMapStep) => void;
  overviewVersion?: number;
}) {
  const avatarUrl = useAuthStore((state) => state.user?.avatar_url ?? null);
  const avatarKey = useAuthStore((state) => state.user?.avatar_key ?? null);
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const projectionVersion = useRef(0);
  const labels = useMemo(() => journeyLabels(itinerary), [itinerary]);
  const [hidden, setHidden] = useState<string[]>([]);
  const padding = useMemo(
    () => ({
      // Android adds fit padding to mapPadding; do not count overlays twice.
      top: Platform.OS === "android" ? 76 : Math.round(headerBottom + 76),
      left: Math.min(88, Math.round(size.width * 0.23)),
      right: Math.min(88, Math.round(size.width * 0.23)),
      bottom: Platform.OS === "android" ? 28 : Math.round(sheetHeight + 28),
    }),
    [sheetHeight, headerBottom, size.width],
  );
  const walks = useMemo(
    () => [
      itinerary.access_walk,
      ...itinerary.transfers.map((t) => t.walk),
      itinerary.egress_walk,
    ],
    [itinerary],
  );
  const overview = useCallback(() => {
    map.current?.fitToCoordinates(
      [
        itinerary.origin,
        itinerary.destination,
        ...itinerary.ride_legs.flatMap((r) => [
          accessPoint(r.boarding),
          ...r.geometry,
          accessPoint(r.alighting),
        ]),
      ],
      { edgePadding: padding, animated: true },
    );
  }, [itinerary, padding]);
  useEffect(() => {
    if (!ready || !size.width || size.height - headerBottom - sheetHeight < 160)
      return;
    let points: ItineraryCoordinate[] | undefined;
    if (selectedStep?.kind === "ride")
      points = itinerary.ride_legs[selectedStep.index]?.geometry;
    else if (selectedStep) {
      const walk =
        selectedStep.kind === "access"
          ? itinerary.access_walk
          : selectedStep.kind === "egress"
            ? itinerary.egress_walk
            : itinerary.transfers[selectedStep.index]?.walk;
      if (walk?.from && walk.to) points = [walk.from, walk.to];
    }
    // Wait until native layout is committed, as in the existing route-map camera.
    const frame = requestAnimationFrame(() => {
      if (points?.length) {
        const focus = validItineraryPath(points)
          ? points
          : [
              {
                latitude: points[0].latitude - 0.0008,
                longitude: points[0].longitude - 0.0008,
              },
              {
                latitude: points[0].latitude + 0.0008,
                longitude: points[0].longitude + 0.0008,
              },
            ];
        map.current?.fitToCoordinates(focus, {
          edgePadding: padding,
          animated: true,
        });
      } else overview();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    ready,
    size,
    selectedStep,
    padding,
    overview,
    overviewVersion,
    headerBottom,
    sheetHeight,
  ]);
  const reduceOverlap = useCallback(async () => {
    if (!map.current?.pointForCoordinate) return;
    const version = ++projectionVersion.current;
    try {
      const projected = await Promise.all(
        labels.map(async (label) => ({
          ...label,
          p: await map.current!.pointForCoordinate(accessPoint(label.access)),
        })),
      );
      projected.sort(
        (a, b) =>
          Number(
            `${b.step.kind}:${b.step.index}` ===
              `${selectedStep?.kind}:${selectedStep?.index}`,
          ) -
          Number(
            `${a.step.kind}:${a.step.index}` ===
              `${selectedStep?.kind}:${selectedStep?.index}`,
          ),
      );
      const kept: typeof projected = [];
      const next: string[] = [];
      for (const label of projected) {
        if (
          kept.some(
            (other) =>
              Math.abs(other.p.x - label.p.x) < 120 &&
              Math.abs(other.p.y - label.p.y) < 65,
          )
        )
          next.push(label.id);
        else kept.push(label);
      }
      if (version === projectionVersion.current) setHidden(next);
    } catch {
      /* Keep labels usable if native projection is not ready. */
    }
  }, [labels, selectedStep]);
  return (
    <MapView
      ref={map}
      testID="experimental-itinerary-map"
      provider={PROVIDER_GOOGLE}
      userInterfaceStyle="light"
      mapType="standard"
      customMapStyle={
        Platform.OS === "android" ? ANDROID_LIGHT_MAP_STYLE : MAP_STYLE
      }
      showsMyLocationButton={false}
      toolbarEnabled={false}
      style={{ flex: 1 }}
      // Fabric can apply props after layout but before GoogleMap exists.
      // This SDK's padding setter has no map-null guard, so omit it until ready.
      mapPadding={
        ready
          ? { top: headerBottom, left: 0, right: 0, bottom: sheetHeight }
          : undefined
      }
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      }}
      initialRegion={{
        ...itinerary.origin,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }}
      onMapReady={() => setReady(true)}
      onMapLoaded={() => setReady(true)}
      onRegionChangeComplete={reduceOverlap}
    >
      {walks.map(
        (walk, index) =>
          walk.from &&
          walk.to &&
          validCoordinate(walk.from) &&
          validCoordinate(walk.to) && (
            <Polyline
              key={`gap:${index}`}
              testID={`geometric-gap-${index}`}
              coordinates={[walk.from, walk.to]}
              strokeColor="#6B7280"
              strokeWidth={3}
              lineDashPattern={[2, 5]}
              zIndex={1}
            />
          ),
      )}
      {itinerary.ride_legs.map(
        (ride, index) =>
          validItineraryPath(ride.geometry) && (
            <Polyline
              key={ride.variant_id}
              testID={`itinerary-ride-${index}`}
              coordinates={ride.geometry}
              strokeColor={RIDE_COLORS[index]}
              strokeWidth={
                selectedStep?.kind === "ride" && selectedStep.index === index
                  ? 10
                  : 7
              }
              lineCap="round"
              lineJoin="round"
              zIndex={
                selectedStep?.kind === "ride" && selectedStep.index === index
                  ? 4
                  : 2
              }
            />
          ),
      )}
      <Marker
        testID="explorer-location-marker"
        coordinate={itinerary.origin}
        anchor={{ x: 0.5, y: 1 }}
        title="Starting point"
      >
        <View collapsable={false}>
          <MapMarker
            variant="explorer"
            imageUrl={avatarUrl}
            avatarKey={avatarKey}
          />
        </View>
      </Marker>
      <Marker
        testID="business-destination-marker"
        coordinate={itinerary.destination}
        anchor={{ x: 0.5, y: 1 }}
        title={destinationName}
      >
        <View collapsable={false}>
          <MapMarker variant="destination" imageUrl={destinationPhotoUrl} />
        </View>
      </Marker>
      {itinerary.ride_legs.map(
        (ride, index) =>
          validItineraryPath(ride.geometry) && (
            <Marker
              key={`chip:${index}`}
              coordinate={ride.geometry[Math.floor(ride.geometry.length / 2)]}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onSelectStep?.({ kind: "ride", index })}
            >
              <View
                className="rounded-full px-2 py-1"
                style={{ backgroundColor: RIDE_COLORS[index] }}
              >
                <AppText weight="bold" className="text-xs text-white">
                  {ride.route_code}
                </AppText>
              </View>
            </Marker>
          ),
      )}
      {itinerary.ride_legs
        .slice(1)
        .map(
          (ride, index) =>
            ride.boarding.coordinate_status !== "invalid" && (
              <LabeledPoint
                key={`next:${index}`}
                coordinate={accessPoint(ride.boarding)}
                color={RIDE_COLORS[index + 1]}
                selected={false}
                onPress={() => onSelectStep?.({ kind: "transfer", index })}
              />
            ),
        )}
      {labels.map((label) => (
        <LabeledPoint
          key={label.id}
          coordinate={accessPoint(label.access)}
          color={label.color}
          text={
            hidden.includes(label.id) &&
            !(
              selectedStep?.kind === label.step.kind &&
              selectedStep.index === label.step.index
            )
              ? undefined
              : label.text
          }
          selected={
            selectedStep?.kind === label.step.kind &&
            selectedStep.index === label.step.index
          }
          onPress={() => onSelectStep?.(label.step)}
        />
      ))}
    </MapView>
  );
}
