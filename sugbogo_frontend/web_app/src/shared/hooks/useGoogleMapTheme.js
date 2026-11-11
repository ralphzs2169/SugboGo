import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMap } from "@vis.gl/react-google-maps";

const subscribers = new Set();
let themeObserver = null;

// ThemeToggle owns persistence; observe its applied theme once for all maps.
function subscribeToTheme(onChange) {
  subscribers.add(onChange);

  if (!themeObserver) {
    themeObserver = new MutationObserver(() => {
      subscribers.forEach((notify) => notify());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return () => {
    subscribers.delete(onChange);

    if (subscribers.size === 0) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  };
}

function getColorScheme() {
  return document.documentElement.classList.contains("dark") ? "DARK" : "LIGHT";
}

/**
 * Supplies native map appearance and camera props without replacing the loader.
 * vis.gl recreates Maps for colorScheme changes, so retain the camera and any
 * active Street View panorama while leaving markers and selection to callers.
 */
export default function useGoogleMapTheme({
  center,
  zoom,
  id = null,
}) {
  const map = useMap(id);
  const colorScheme = useSyncExternalStore(
    subscribeToTheme,
    getColorScheme,
    () => "LIGHT",
  );
  // Coordinates may arrive after a loading/empty state, before a map exists.
  const [camera, setCamera] = useState(null);
  const [mapTypeId, setMapTypeId] = useState();
  const streetViewState = useRef(null);
  const onCameraChanged = useCallback(({ detail }) => {
    const { center, zoom, heading, tilt } = detail;

    setCamera({ center, zoom, heading, tilt });
  }, []);
  const onMapTypeIdChanged = useCallback(({ map }) => {
    setMapTypeId(map.getMapTypeId());
  }, []);

  useEffect(() => {
    const panorama = map?.getStreetView?.();

    if (!panorama) {
      return;
    }

    const saved = streetViewState.current;

    if (saved?.visible) {
      if (saved.pano) {
        panorama.setPano(saved.pano);
      } else if (saved.position) {
        panorama.setPosition(saved.position);
      }

      panorama.setPov(saved.pov);
      panorama.setZoom(saved.zoom);
      panorama.setVisible(true);
    }

    return () => {
      streetViewState.current = {
        visible: panorama.getVisible(),
        pano: panorama.getPano(),
        position: panorama.getPosition()?.toJSON(),
        pov: panorama.getPov(),
        zoom: panorama.getZoom(),
      };
    };
  }, [map]);

  return {
    center: camera?.center ?? center,
    zoom: camera?.zoom ?? zoom,
    heading: camera?.heading ?? 0,
    tilt: camera?.tilt ?? 0,
    colorScheme,
    mapTypeId,
    onCameraChanged,
    onMapTypeIdChanged,
  };
}
