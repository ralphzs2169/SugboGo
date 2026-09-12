import type { ExploreBusiness } from "../types/exploreBusiness.types";

type SpecialtyTag = ExploreBusiness["specialty_tags"][number];

const TAG_HORIZONTAL_PADDING = 16;
const APPROX_CHARACTER_WIDTH = 5.5;
const TAG_GAP = 4;
const VOUCH_INDICATOR_WIDTH = 20;

/**
 * Estimates the rendered width of a compact specialty tag chip.
 *
 * The estimate accounts for label length, horizontal padding, and the
 * additional visual space used by vouched specialty tags.
 */
function estimateTagWidth(tag: SpecialtyTag) {
  const labelWidth = Math.max(
    28,
    tag.name.trim().length * APPROX_CHARACTER_WIDTH,
  );

  const vouchWidth = tag.is_vouched ? VOUCH_INDICATOR_WIDTH : 0;

  return TAG_HORIZONTAL_PADDING + labelWidth + vouchWidth;
}

/**
 * Produces every possible ordering for a small collection of specialty tags.
 *
 * Businesses expose at most three displayed tags, so evaluating every
 * permutation remains inexpensive.
 */
function getPermutations(tags: SpecialtyTag[]): SpecialtyTag[][] {
  if (tags.length <= 1) {
    return [tags];
  }

  return tags.flatMap((tag, index) => {
    const remainingTags = tags.filter(
      (_, remainingIndex) => remainingIndex !== index,
    );

    return getPermutations(remainingTags).map((permutation) => [
      tag,
      ...permutation,
    ]);
  });
}

/**
 * Simulates how a tag ordering would wrap within the available width.
 */
function simulateRows(tags: SpecialtyTag[], availableWidth: number) {
  const rows: number[][] = [[]];

  let currentRowWidth = 0;

  tags.forEach((tag) => {
    const tagWidth = estimateTagWidth(tag);

    const nextRowWidth =
      currentRowWidth === 0 ? tagWidth : currentRowWidth + TAG_GAP + tagWidth;

    if (currentRowWidth > 0 && nextRowWidth > availableWidth) {
      rows.push([tagWidth]);
      currentRowWidth = tagWidth;
      return;
    }

    rows[rows.length - 1].push(tagWidth);
    currentRowWidth = nextRowWidth;
  });

  return rows;
}

/**
 * Calculates the occupied width of every simulated tag row.
 */
function getRowWidths(rows: number[][]) {
  return rows.map((row) =>
    row.reduce(
      (total, tagWidth, index) => total + tagWidth + (index > 0 ? TAG_GAP : 0),
      0,
    ),
  );
}

/**
 * Scores a possible specialty tag arrangement.
 *
 * Fewer wrapped rows are preferred first. When row counts match, the
 * algorithm favors balanced rows and avoids leaving a very small tag alone.
 */
function scoreArrangement(tags: SpecialtyTag[], availableWidth: number) {
  const rows = simulateRows(tags, availableWidth);
  const rowWidths = getRowWidths(rows);

  const rowCountPenalty = rows.length * 10_000;

  const averageRowWidth =
    rowWidths.reduce((total, width) => total + width, 0) /
    Math.max(rowWidths.length, 1);

  const balancePenalty = rowWidths.reduce(
    (total, width) => total + Math.pow(width - averageRowWidth, 2),
    0,
  );

  const lastRow = rows[rows.length - 1];
  const lastRowWidth = rowWidths[rowWidths.length - 1] ?? 0;

  const orphanPenalty =
    rows.length > 1 &&
    lastRow?.length === 1 &&
    lastRowWidth < availableWidth * 0.35
      ? 2_000
      : 0;

  return rowCountPenalty + balancePenalty + orphanPenalty;
}

/**
 * Arranges specialty tags for visually balanced wrapping.
 *
 * Evaluates every possible ordering of up to three tags and returns the
 * arrangement that best fits the available business-card width.
 */
export function arrangeSpecialtyTags(
  tags: SpecialtyTag[],
  availableWidth: number,
) {
  const displayTags = tags.slice(0, 3);

  if (displayTags.length <= 1 || availableWidth <= 0) {
    return displayTags;
  }

  const permutations = getPermutations(displayTags);

  let bestArrangement = permutations[0];
  let bestScore = scoreArrangement(bestArrangement, availableWidth);

  permutations.slice(1).forEach((candidate) => {
    const candidateScore = scoreArrangement(candidate, availableWidth);

    if (candidateScore < bestScore) {
      bestArrangement = candidate;
      bestScore = candidateScore;
    }
  });

  return bestArrangement;
}
