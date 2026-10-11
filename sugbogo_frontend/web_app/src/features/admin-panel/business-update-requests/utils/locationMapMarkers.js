/** Parses only valid submitted coordinates without changing their values. */
export function validLocationPosition(location) {
  if (
    location?.latitude == null ||
    location?.longitude == null ||
    String(location.latitude).trim() === "" ||
    String(location.longitude).trim() === ""
  ) {
    return null;
  }

  const lat = Number(location.latitude);
  const lng = Number(location.longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }

  return { lat, lng };
}

/** Keeps coincident request states on one marker at their exact position. */
export function groupLocationMapStates(states) {
  const groups = [];
  const byPosition = new Map();

  for (const state of states) {
    const position = validLocationPosition(state.location);
    if (!position) {
      continue;
    }

    const key = `${position.lat},${position.lng}`;
    const existing = byPosition.get(key);

    if (existing) {
      existing.states.push(state);
      continue;
    }

    const group = { key, position, states: [state] };
    groups.push(group);
    byPosition.set(key, group);
  }

  return groups;
}
