import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import type MapView from "react-native-maps";

import type {
  DirectJourneyMapCoordinate,
  DirectJourneyMapGuidance,
} from "../types/directJourney.types";

type Params = {
  journey: DirectJourneyMapGuidance;
  originLocation: DirectJourneyMapCoordinate;
};

const JOURNEY_EDGE_PADDING = {
  top: 150,
  right: 40,
  bottom: 40,
  left: 40,
};

const MARKER_FOCUS_Y_RATIO = 0.62;
const CAMERA_FOCUS_DURATION = 300;

/**
 * Returns the coordinates that define the Explorer's active journey.
 *
 * Camera fitting focuses on the selected trip rather than the entire Jeepney
 * route variant so the relevant journey remains readable.
 */
function getJourneyFitCoordinates(
  journey: DirectJourneyMapGuidance,
  originLocation: DirectJourneyMapCoordinate,
): DirectJourneyMapCoordinate[] {
  return [
    originLocation,
    journey.boarding_transit_point,
    ...journey.ride.selected_segment_geometry,
    journey.alighting_transit_point,
    journey.business_location,
  ];
}

/**
 * Manages camera behavior for a Jeepney journey map.
 *
 * Fits the selected journey when the map becomes ready and repositions tapped
 * markers lower in the viewport to leave room for their callouts.
 */
export default function useJeepneyRouteMapCamera({
  journey,
  originLocation,
}: Params) {
  const mapRef = useRef<MapView>(null);
  const fittedJourneyRef = useRef<string | null>(null);

  const mapSizeRef = useRef({
    width: 0,
    height: 0,
  });

  const [isMapReady, setIsMapReady] = useState(false);

  const journeyKey = [
    journey.route_variant.id,
    journey.boarding_transit_point.id,
    journey.alighting_transit_point.id,
    originLocation.latitude.toFixed(5),
    originLocation.longitude.toFixed(5),
  ].join("-");

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    mapSizeRef.current = {
      width,
      height,
    };
  }, []);

  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);

  const focusMarker = useCallback(
    async (coordinate: DirectJourneyMapCoordinate) => {
      const map = mapRef.current;
      const { width, height } = mapSizeRef.current;

      if (!map || width <= 0 || height <= 0) {
        return;
      }

      try {
        const markerPoint = await map.pointForCoordinate(coordinate);

        const screenCenter = {
          x: width / 2,
          y: height / 2,
        };

        const targetMarkerPoint = {
          x: width / 2,
          y: height * MARKER_FOCUS_Y_RATIO,
        };

        const cameraCenterPoint = {
          x: screenCenter.x + (markerPoint.x - targetMarkerPoint.x),
          y: screenCenter.y + (markerPoint.y - targetMarkerPoint.y),
        };

        const cameraCenter = await map.coordinateForPoint(cameraCenterPoint);

        map.animateCamera(
          {
            center: cameraCenter,
          },
          {
            duration: CAMERA_FOCUS_DURATION,
          },
        );
      } catch {
        map.animateCamera(
          {
            center: coordinate,
          },
          {
            duration: CAMERA_FOCUS_DURATION,
          },
        );
      }
    },
    [],
  );

  const fitJourneyOnce = useCallback(() => {
    const map = mapRef.current;

    if (!isMapReady || !map || fittedJourneyRef.current === journeyKey) {
      return;
    }

    const coordinates = getJourneyFitCoordinates(journey, originLocation);

    if (coordinates.length === 0) {
      return;
    }

    fittedJourneyRef.current = journeyKey;

    requestAnimationFrame(() => {
      setTimeout(() => {
        map.fitToCoordinates(coordinates, {
          edgePadding: JOURNEY_EDGE_PADDING,
          animated: true,
        });
      }, 150);
    });
  }, [isMapReady, journey, journeyKey, originLocation]);

  useEffect(() => {
    fitJourneyOnce();
  }, [fitJourneyOnce]);

  return {
    mapRef,
    handleMapLayout,
    handleMapReady,
    focusMarker,
    fitJourneyOnce,
  };
}
