import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type MapView from "react-native-maps";
import type { LatLng } from "react-native-maps";

import type { BusinessMapMarker } from "../components/BusinessDiscoveryMap";

// Match the shared business marker's fixed 48-point identity box.
const MARKER_SIZE = 48;
type CoordinateRegistration = { coordinate: LatLng };

/** Offers an ID-based choice when mounted ordinary pins cover one another. */
export default function useMapMarkerOverlap({
  businesses,
  selectedBusinessId,
  isScreenFocused,
  onBusinessPress,
  mapRef,
}: {
  businesses: BusinessMapMarker[];
  selectedBusinessId: number | null;
  isScreenFocused?: boolean;
  onBusinessPress?: (businessId: number) => void;
  mapRef: React.RefObject<MapView | null>;
}) {
  const coordinates = useRef(new Map<number, Set<CoordinateRegistration>>());
  const requestVersion = useRef(0);
  const businessPress = useRef(onBusinessPress);
  const [choices, setChoices] = useState({ ids: [] as number[], version: 0 });
  const sheetRef = useRef<BottomSheetModal | null>(null);

  const reset = useCallback(() => {
    requestVersion.current += 1;
    sheetRef.current?.dismiss();
    setChoices((previous) => {
      if (previous.ids.length === 0) {
        return previous;
      }

      return { ids: [], version: previous.version };
    });
  }, []);

  useLayoutEffect(() => {
    businessPress.current =
      isScreenFocused === false ? undefined : onBusinessPress;
  }, [isScreenFocused, onBusinessPress]);

  // Revoke pending projection and open actions when eligibility/selection changes,
  // focus is lost, or the component unmounts. No input snapshots are retained.
  useLayoutEffect(
    () => reset,
    [businesses, selectedBusinessId, isScreenFocused, reset],
  );

  useEffect(() => {
    if (choices.ids.length > 1) {
      sheetRef.current?.present();
    }
  }, [choices]);

  const registerCoordinate = useCallback(
    (
      businessId: number,
      coordinate: LatLng,
    ) => {
      requestVersion.current += 1;
      const registration = { coordinate };
      const registrations =
        coordinates.current.get(businessId) ??
        new Set<CoordinateRegistration>();
      registrations.add(registration);
      coordinates.current.set(businessId, registrations);

      // Old spiral leaves can unmount after a replacement pin with the same ID
      // mounts. Each cleanup removes only its own registration.
      return () => {
        requestVersion.current += 1;
        registrations.delete(registration);

        if (registrations.size === 0) {
          coordinates.current.delete(businessId);
        }
      };
    },
    [],
  );

  const pressBusiness = useCallback(
    async (businessId: number) => {
      if (!businessPress.current) {
        return;
      }

      reset();
      const version = requestVersion.current;
      const visible = [...coordinates.current.entries()].map(
        ([id, entries]) => ({
          id,
          coordinate: [...entries].at(-1)!.coordinate,
        }),
      );
      const tapped = visible.find((marker) => marker.id === businessId);

      if (
        !tapped ||
        "centerPoint" in tapped.coordinate ||
        visible.length === 1
      ) {
        businessPress.current(businessId);
        return;
      }

      let ids = [businessId];

      try {
        const map = mapRef.current;
        if (!map) {
          throw new Error("Map projection unavailable.");
        }

        const points = await Promise.all(
          visible.map(async ({ id, coordinate }) => ({
            id,
            point: await map.pointForCoordinate(coordinate),
          })),
        );
        const origin = points.find((marker) => marker.id === businessId)!.point;
        ids = points
          .filter(
            ({ point }) =>
              Math.abs(point.x - origin.x) < MARKER_SIZE &&
              Math.abs(point.y - origin.y) < MARKER_SIZE,
          )
          .map(({ id }) => id);
      } catch {
        // A later tap can retry projection; this tap keeps its original identity.
      }

      if (version !== requestVersion.current) {
        return;
      }

      if (ids.length > 1) {
        setChoices({ ids, version });
      } else {
        businessPress.current?.(businessId);
      }
    },
    [mapRef, reset],
  );

  const selectBusiness = (value: string) => {
    const id = Number(value);

    if (
      choices.version !== requestVersion.current ||
      !choices.ids.includes(id) ||
      !coordinates.current.has(id)
    ) {
      return;
    }

    reset();
    businessPress.current?.(id);
  };

  const options = choices.ids.flatMap((id) => {
    const business = businesses.find((item) => item.id === id);

    if (!business) {
      return [];
    }

    return [
      {
        value: String(id),
        label: business.business_name ?? `Business ${id}`,
        icon: business.is_hidden_gem ? "diamond-stone" : "store-outline",
      },
    ];
  });

  return {
    registerCoordinate,
    pressBusiness,
    reset,
    sheetRef,
    options,
    selectBusiness,
  };
}
