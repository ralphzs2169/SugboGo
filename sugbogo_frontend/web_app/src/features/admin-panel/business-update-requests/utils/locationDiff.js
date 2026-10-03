const LOCATION_FIELDS = [
  "latitude",
  "longitude",
  "address",
  "city",
  "province",
  "postal_code",
];

function locationValue(location, field) {
  const value = location?.[field];
  if (field === "latitude" || field === "longitude") {
    return value == null ? null : Number(value);
  }
  return value ?? null;
}

function landmarkValues(landmark) {
  return [
    landmark.name ?? null,
    landmark.address ?? null,
    Number(landmark.latitude),
    Number(landmark.longitude),
    landmark.source ?? null,
    landmark.place_id ?? null,
  ];
}

function landmarkValueKey(landmark) {
  return JSON.stringify(landmarkValues(landmark));
}

function landmarkBaselineKey(landmark) {
  return JSON.stringify([landmark.id ?? null, ...landmarkValues(landmark)]);
}

function sameUnorderedValues(first, second, keyFor) {
  if (first.length !== second.length) {
    return false;
  }
  const counts = new Map();
  for (const item of first) {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const item of second) {
    const key = keyFor(item);
    const count = counts.get(key) ?? 0;
    if (!count) {
      return false;
    }
    counts.set(key, count - 1);
  }
  return true;
}

/** Compares current live state with the frozen submission baseline, regardless of landmark order. */
export function locationBaselineMatches(current, previous) {
  if (!current?.location || !previous?.location) {
    return false;
  }
  if (String(current.location.id) !== String(previous.location.id)) {
    return false;
  }
  if (
    LOCATION_FIELDS.some(
      (field) =>
        locationValue(current.location, field) !==
        locationValue(previous.location, field),
    )
  ) {
    return false;
  }
  return sameUnorderedValues(
    current.landmarks ?? [],
    previous.landmarks ?? [],
    landmarkBaselineKey,
  );
}

/** Identifies meaningful address and coordinate changes in the frozen proposal. */
export function getLocationFieldChanges(previous, proposed) {
  return LOCATION_FIELDS.filter(
    (field) =>
      locationValue(previous, field) !== locationValue(proposed, field),
  ).map((field) => ({
    field,
    previous: previous?.[field],
    proposed: proposed?.[field],
  }));
}

/** Groups landmarks by stored values so proposal order and absent proposed IDs do not affect the diff. */
export function getLandmarkDiff(previous = [], proposed = []) {
  const unmatchedPrevious = [...previous];
  const added = [];
  const retained = [];

  for (const landmark of proposed) {
    const key = landmarkValueKey(landmark);
    const matchIndex = unmatchedPrevious.findIndex(
      (candidate) => landmarkValueKey(candidate) === key,
    );
    if (matchIndex === -1) {
      added.push(landmark);
    } else {
      retained.push(landmark);
      unmatchedPrevious.splice(matchIndex, 1);
    }
  }
  return { added, removed: unmatchedPrevious, retained };
}
