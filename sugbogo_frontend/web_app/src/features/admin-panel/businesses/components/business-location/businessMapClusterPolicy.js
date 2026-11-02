/** Matches Mobile's count progression without hiding the exact accessible count. */
export function clusterSize(count) {
  if (count >= 100) return 58;
  if (count >= 30) return 52;
  if (count >= 10) return 46;
  return 40;
}
