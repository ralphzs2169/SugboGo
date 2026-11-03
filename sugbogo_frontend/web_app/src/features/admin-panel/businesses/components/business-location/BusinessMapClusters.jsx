import { useCallback, useEffect, useMemo, useState } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import {
  MarkerClusterer,
  SuperClusterAlgorithm,
} from "@googlemaps/markerclusterer";
import BusinessMapMarker from "@/shared/components/maps/BusinessMapMarker";

import { clusterSize } from "./businessMapClusterPolicy";

/** Restore an explicitly selected native marker outside the clustering overlay. */
function attachSelectedMarker(marker, map) {
  if (marker) marker.map = map;
}

/** Shares Google's spatial index across marker updates and disposes native listeners. */
export default function BusinessMapClusters({
  businesses,
  selectedId,
  onSelect,
  onOverlap,
}) {
  const map = useMap();
  const [markers, setMarkers] = useState({});
  const register = useCallback((id, marker) => {
    setMarkers((current) => {
      if (current[id] === marker) return current;
      const next = { ...current };
      if (marker) next[id] = marker;
      else delete next[id];
      return next;
    });
  }, []);
  const clusterer = useMemo(
    () =>
      map
        ? new MarkerClusterer({
            algorithm: new SuperClusterAlgorithm({
              radius: 56,
              minPoints: 3,
              maxZoom: 20,
            }),
            renderer: {
              render: ({ count, position }) => {
                const element = document.createElement("div");
                const size = clusterSize(count);
                element.className =
                  "flex cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-md ring-8 ring-primary/20";
                element.style.width = `${size}px`;
                element.style.height = `${size}px`;
                element.textContent = count > 99 ? "99+" : String(count);
                return new globalThis.google.maps.marker.AdvancedMarkerElement({
                  position,
                  gmpClickable: true,
                  content: element,
                  title: `${count} businesses. Zoom to expand.`,
                  zIndex: 1000 + count,
                });
              },
            },
            onClusterClick: (_event, cluster) => {
              const members = businesses.filter((business) =>
                cluster.markers?.includes(markers[business.id]),
              );
              const sameLocation =
                members.length > 1 &&
                members.every(
                  (business) =>
                    Math.abs(
                      Number(business.latitude) - Number(members[0].latitude),
                    ) < 0.00005 &&
                    Math.abs(
                      Number(business.longitude) - Number(members[0].longitude),
                    ) < 0.00005,
                );
              if (sameLocation || map.getZoom() >= 20) onOverlap(members);
              else if (cluster.bounds) map.fitBounds(cluster.bounds, 80);
            },
          })
        : null,
    [map, businesses, markers, onOverlap],
  );
  useEffect(() => {
    if (!clusterer) return;
    const validIds = new Set(businesses.map((business) => String(business.id)));
    clusterer.addMarkers(
      Object.entries(markers)
        .filter(([id]) => validIds.has(id) && String(selectedId) !== id)
        .map(([, marker]) => marker),
      true,
    );
    clusterer.setMap(map);
    attachSelectedMarker(markers[selectedId], map);
    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
    };
  }, [clusterer, map, markers, businesses, selectedId]);
  return businesses.map((business) => (
    <BusinessMarker
      key={business.id}
      business={business}
      register={register}
      selected={business.id === selectedId}
      onSelect={onSelect}
      onOverlap={onOverlap}
      businesses={businesses}
    />
  ));
}

/** Keeps callback refs stable so unrelated renders do not rebuild the marker registry. */
function BusinessMarker({
  business,
  register,
  selected,
  onSelect,
  businesses,
  onOverlap,
}) {
  const ref = useCallback(
    (marker) => register(business.id, marker),
    [register, business.id],
  );
  return (
    <AdvancedMarker
      ref={ref}
      position={{
        lat: Number(business.latitude),
        lng: Number(business.longitude),
      }}
      title={`${business.business_name} — ${business.status}`}
      zIndex={selected ? 10000 : 1}
      onClick={() => {
        const overlapping = businesses.filter(
          (item) =>
            Math.abs(Number(item.latitude) - Number(business.latitude)) <
              0.00005 &&
            Math.abs(Number(item.longitude) - Number(business.longitude)) <
              0.00005,
        );
        if (overlapping.length > 1) onOverlap(overlapping);
        else onSelect(business);
      }}
    >
      <BusinessMapMarker
        variant="business"
        clusterIcon={business.cluster_icon}
        suspended={business.status === "suspended"}
        selected={selected}
      />
    </AdvancedMarker>
  );
}
