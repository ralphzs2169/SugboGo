/** Format score values only for display, preserving missing measurements. */
export function formatScore(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(3);
}

/** Require explicit verification and percent semantics before displaying coverage. */
export function telemetryPresentation(coverage) {
  if (coverage?.value == null && coverage?.reason === "coverage_unverified") {
    return {
      value: "Unverified",
      description: "Tracking completeness cannot currently be confirmed.",
    };
  }
  if (
    coverage?.coverage_verified === true &&
    coverage.unit === "percent" &&
    typeof coverage.value === "number" &&
    Number.isFinite(coverage.value) &&
    coverage.value >= 0 &&
    coverage.value <= 100
  ) {
    return {
      value: `${coverage.value}%`,
      description: "Verified visibility-tracking coverage",
    };
  }
  return { value: "Unavailable", description: "Telemetry coverage is currently unavailable." };
}
