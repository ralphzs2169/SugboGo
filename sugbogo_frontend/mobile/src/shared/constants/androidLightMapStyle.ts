import type { MapStyleElement } from "react-native-maps";

/**
 * Android translation of SugboGo's light Cloud style with white roads,
 * soft green parks, and light-blue water.
 * Google POI labels/icons are hidden because the app renders its own markers.
 *
 * Leave landscape geometry to the SDK. Recoloring it can trigger a gray mask
 * at some zoom levels, and hiding it exposes the beige base.
 * https://issuetracker.google.com/issues/489369076
 */
export const ANDROID_LIGHT_MAP_STYLE: MapStyleElement[] = [
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#5f6b73" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f3f3f3" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#bdd9ec" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5f8aa3" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#bdd9ec" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e4e4e4" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#dcdcdc" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a858c" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry.fill",
    stylers: [{ color: "#d3e8d0" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#606c74" }],
  },
  {
    featureType: "administrative.neighborhood",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6e7981" }],
  },
];
