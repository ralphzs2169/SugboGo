export function createVariantSnapshot({
  routeId,
  originId,
  destinationId,
  intermediatePointIds,
  geometry,
}) {
  return JSON.stringify({
    routeId: String(routeId ?? ""),
    originId: String(originId ?? ""),
    destinationId: String(destinationId ?? ""),
    intermediatePointIds: intermediatePointIds.map(String),
    geometry: geometry.map((coordinate) => ({
      latitude: Number(coordinate.latitude),
      longitude: Number(coordinate.longitude),
    })),
  });
}

export function getInitialVariantEditorState(routeId, variant) {
  const orderedPointIds =
    variant?.transit_points?.map((item) => String(item.transit_point.id)) ?? [];

  return {
    routeId: String(routeId),
    originId: variant ? String(variant.origin.id) : "",
    destinationId: variant ? String(variant.destination.id) : "",
    intermediatePointIds: orderedPointIds.slice(1, -1),
    geometry:
      variant?.geometry?.map((coordinate) => ({
        latitude: Number(coordinate.latitude),
        longitude: Number(coordinate.longitude),
      })) ?? [],
  };
}

export function validateVariantEditor(state) {
  const errors = {};
  const orderedPointIds = [
    state.originId,
    ...state.intermediatePointIds,
    state.destinationId,
  ].filter(Boolean);

  if (!state.originId) {
    errors.origin_transit_point_id = "Select an origin Transit Point.";
  }
  if (!state.destinationId) {
    errors.destination_transit_point_id =
      "Select a destination Transit Point.";
  }
  if (
    state.originId &&
    state.destinationId &&
    state.originId === state.destinationId
  ) {
    errors.destination_transit_point_id =
      "The destination must differ from the origin.";
  }
  if (state.geometry.length < 2) {
    errors.geometry = "Draw at least two route geometry vertices.";
  } else if (
    state.geometry.some(
      (coordinate) =>
        !Number.isFinite(Number(coordinate.latitude)) ||
        !Number.isFinite(Number(coordinate.longitude)) ||
        Number(coordinate.latitude) < -90 ||
        Number(coordinate.latitude) > 90 ||
        Number(coordinate.longitude) < -180 ||
        Number(coordinate.longitude) > 180,
    )
  ) {
    errors.geometry = "Every geometry vertex must contain valid coordinates.";
  }
  if (orderedPointIds.length < 2) {
    errors.transit_point_ids = "At least two Transit Points are required.";
  }
  if (new Set(orderedPointIds).size !== orderedPointIds.length) {
    errors.transit_point_ids =
      "Transit Points cannot be duplicated within a route variant.";
  }

  return errors;
}

export function buildVariantPayload(state) {
  return {
    route_id: Number(state.routeId),
    origin_transit_point_id: Number(state.originId),
    destination_transit_point_id: Number(state.destinationId),
    geometry: state.geometry.map((coordinate) => ({
      latitude: Number(coordinate.latitude),
      longitude: Number(coordinate.longitude),
    })),
    transit_point_ids: [
      Number(state.originId),
      ...state.intermediatePointIds.map(Number),
      Number(state.destinationId),
    ],
  };
}

export function moveListItem(items, index, direction) {
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, item);

  return nextItems;
}
