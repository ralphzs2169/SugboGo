/** Keep exact full coverage concise while preserving other pie percentages' precision. */
export function formatPiePercentage(value) {
  return `${value === 100 ? "100" : value.toFixed(1)}%`;
}
