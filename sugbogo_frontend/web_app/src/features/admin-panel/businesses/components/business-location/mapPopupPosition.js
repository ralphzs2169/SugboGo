/** Prefer above the pin, then flip or clamp within the map's control-safe area. */
export function mapPopupPosition({ x, y, width, height, mapWidth, mapHeight }) {
  const margin = 12;
  const top = 64;
  const right = Math.max(margin, mapWidth - 64 - width);
  const bottom = Math.max(top, mapHeight - 32 - height);
  const candidates = [
    { left: x - width / 2, top: y - height - 64 },
    { left: x - width / 2, top: y + 16 },
    { left: x + 24, top: y - height / 2 },
    { left: x - width - 24, top: y - height / 2 },
  ];
  const position =
    candidates.find(
      (item) =>
        item.left >= margin &&
        item.left <= right &&
        item.top >= top &&
        item.top <= bottom,
    ) ?? candidates[0];
  return {
    left: Math.max(margin, Math.min(right, position.left)),
    top: Math.max(top, Math.min(bottom, position.top)),
  };
}
