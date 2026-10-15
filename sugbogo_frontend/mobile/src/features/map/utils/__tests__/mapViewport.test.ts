import {
  hasViewportChanged,
  isSearchableBounds,
  normalizeBounds,
  regionToBounds,
} from "../mapViewport";

const bounds = { north: 10.4, south: 10.3, east: 123.95, west: 123.85 };

it.each([
  { ...bounds, north: NaN },
  { ...bounds, north: Infinity },
  { ...bounds, north: 91 },
  { ...bounds, south: -91 },
  { ...bounds, east: 181 },
  { ...bounds, west: -181 },
  { ...bounds, north: bounds.south },
  { ...bounds, east: bounds.west },
  { ...bounds, east: -179, west: 179 },
  { ...bounds, north: 11 },
  { ...bounds, east: 125 },
])("rejects invalid bounds %o", (invalid) => {
  expect(isSearchableBounds(invalid)).toBe(false);
});

it("accepts the maximum viewport span and derives region edges", () => {
  expect(
    isSearchableBounds({ north: 10.5, south: 10, east: 124, west: 123.5 }),
  ).toBe(true);
  expect(
    regionToBounds({
      latitude: 10,
      longitude: 124,
      latitudeDelta: 0.2,
      longitudeDelta: 0.4,
    }),
  ).toEqual({
    north: 10.1,
    south: 9.9,
    east: 124.2,
    west: 123.8,
  });
});

it("ignores jitter but recognizes meaningful pans and zooms", () => {
  expect(hasViewportChanged({ ...bounds, north: 10.40001 }, bounds)).toBe(
    false,
  );
  expect(hasViewportChanged({ ...bounds, north: 10.42 }, bounds)).toBe(true);
  expect(hasViewportChanged({ ...bounds, east: 123.94 }, bounds)).toBe(true);
  expect(normalizeBounds({ ...bounds, north: 10.400001 }).north).toBe(10.40001);
});
