import test from "node:test";
import assert from "node:assert/strict";

import {
  getLandmarkDiff,
  getLocationFieldChanges,
  locationBaselineMatches,
} from "./locationDiff.js";

const location = {
  id: 4,
  latitude: 10.3157,
  longitude: 123.8854,
  address: "Cebu City",
  city: "Cebu City",
  province: "Cebu",
  postal_code: "6000",
};

function landmark(id, name) {
  return {
    id,
    name,
    address: `${name} address`,
    latitude: 10.31,
    longitude: 123.88,
    source: "google",
    place_id: `${name}-place`,
  };
}

test("baseline comparison ignores order but detects identity and every stored field", () => {
  const previous = {
    location,
    landmarks: [landmark(1, "A"), landmark(2, "B")],
  };
  const reordered = {
    location: { ...location },
    landmarks: [landmark(2, "B"), landmark(1, "A")],
  };
  assert.equal(locationBaselineMatches(reordered, previous), true);

  for (const field of [
    "id",
    "latitude",
    "longitude",
    "address",
    "city",
    "province",
    "postal_code",
  ]) {
    const changed = {
      ...reordered,
      location: { ...location, [field]: field === "id" ? 5 : "changed" },
    };
    assert.equal(locationBaselineMatches(changed, previous), false, field);
  }
  assert.equal(
    locationBaselineMatches(
      { ...reordered, landmarks: [landmark(2, "B"), landmark(1, "Renamed")] },
      previous,
    ),
    false,
  );
  assert.equal(
    locationBaselineMatches(
      { ...reordered, landmarks: [landmark(2, "B"), landmark(3, "A")] },
      previous,
    ),
    false,
  );
  assert.equal(
    locationBaselineMatches(
      { ...reordered, location: { ...location, postal_code: null } },
      previous,
    ),
    false,
  );
});

test("landmark diff is unordered and groups removed, added, and retained", () => {
  const previous = [landmark(1, "A"), landmark(2, "B")];
  const proposed = [landmark(null, "B"), landmark(null, "C")];
  const diff = getLandmarkDiff(previous, proposed);
  assert.deepEqual(
    diff.removed.map((item) => item.name),
    ["A"],
  );
  assert.deepEqual(
    diff.added.map((item) => item.name),
    ["C"],
  );
  assert.deepEqual(
    diff.retained.map((item) => item.name),
    ["B"],
  );
  assert.equal(
    getLandmarkDiff(previous, [...previous].reverse()).added.length,
    0,
  );
});

test("location diff shows only changed fields", () => {
  assert.deepEqual(
    getLocationFieldChanges(location, {
      ...location,
      address: "New address",
    }).map((change) => change.field),
    ["address"],
  );
});
