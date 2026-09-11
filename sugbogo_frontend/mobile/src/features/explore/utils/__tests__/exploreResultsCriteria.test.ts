import {
  applyClusterSelection,
  getTaxonomyFilterCount,
  toggleCategorySelection,
  toggleSpecialtySelection,
} from "../exploreResultsCriteria";

const criteria = {
  search: "coffee",
  clusterId: 1,
  categoryIds: [4, 7],
  specialtyTagId: 12,
};

const categories = [
  { id: 4, name: "Cafés", cluster_id: 1 },
  { id: 7, name: "Bakeries", cluster_id: 2 },
];

describe("Explore results criteria", () => {
  it("keeps only categories compatible with a newly selected cluster", () => {
    expect(applyClusterSelection(criteria, 2, categories)).toEqual({
      ...criteria,
      clusterId: 2,
      categoryIds: [7],
    });
  });

  it("selecting All clears cluster categories but preserves search and specialty", () => {
    expect(applyClusterSelection(criteria, null, categories)).toEqual({
      ...criteria,
      clusterId: null,
      categoryIds: [],
    });
  });

  it("supports independent category multi-selection", () => {
    expect(toggleCategorySelection(criteria, 4).categoryIds).toEqual([7]);
    expect(toggleCategorySelection(criteria, 9).categoryIds).toEqual([
      4,
      7,
      9,
    ]);
  });

  it("replaces or clears the single specialty", () => {
    expect(toggleSpecialtySelection(criteria, 8).specialtyTagId).toBe(8);
    expect(toggleSpecialtySelection(criteria, 12).specialtyTagId).toBeNull();
  });

  it("counts categories and specialty without counting cluster", () => {
    expect(getTaxonomyFilterCount(criteria)).toBe(3);
    expect(
      getTaxonomyFilterCount({
        ...criteria,
        categoryIds: [],
        specialtyTagId: null,
      }),
    ).toBe(0);
  });
});
