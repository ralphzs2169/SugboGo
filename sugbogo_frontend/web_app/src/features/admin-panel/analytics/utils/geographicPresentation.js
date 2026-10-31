/** Builds up to four non-overlapping integer count ranges from observed values. */
export function geographicRanges(cells, metric) {
  const maximum = Math.max(0, ...cells.map((cell) => cell[metric] ?? 0));
  if (maximum === 0) return [];
  const step = Math.ceil(maximum / 4);
  const ranges = [];
  for (let lower = 1; lower <= maximum; lower += step) {
    const upper = Math.min(maximum, lower + step - 1);
    ranges.push({ lower, upper, label: lower === upper ? `${lower}` : `${lower}–${upper}` });
  }
  return ranges.map((range, index) => ({ ...range, opacity: 0.2 + 0.65 * (index + 1) / ranges.length }));
}

/** Uses the same count classes for map intensity and its labelled legend. */
export function geographicOpacity(value, ranges) {
  if (value == null) return 0.3;
  if (value === 0) return 0;
  return ranges.find((range) => value >= range.lower && value <= range.upper)?.opacity ?? 0;
}

/** Names areas consistently in exact data and exports without exposing internal grid keys. */
export function geographicAreaRows(cells) {
  return cells.map((cell, index) => ({
    ...cell,
    area_label: `Area ${index + 1}`,
  }));
}

/** Translates location exclusions into administrator-facing descriptions. */
export function geographicExclusionLabel(reason) {
  return {
    missing_location: "Missing location",
    invalid_coordinates: "Invalid coordinates",
    unsupported_srid: "Unsupported location format",
    outside_scope: "Outside the Cebu City reporting area",
  }[reason] ?? "Location unavailable";
}
