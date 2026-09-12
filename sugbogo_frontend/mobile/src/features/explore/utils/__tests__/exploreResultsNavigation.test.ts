import { router } from "expo-router";

import { navigateToExploreResults } from "../exploreResultsNavigation";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

describe("Explore results navigation", () => {
  it("uses taxonomy IDs without converting display labels into search", () => {
    navigateToExploreResults({
      clusterId: 4,
      specialtyTagId: 12,
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/explore-results",
      params: {
        search: "",
        clusterId: "4",
        categoryIds: "",
        specialtyTagId: "12",
        openFilters: "",
        focusSearch: "",
      },
    });
  });

  it("marks the shared results route to open filters", () => {
    navigateToExploreResults({}, true);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          openFilters: "1",
        }),
      }),
    );
  });

  it("marks search entry without changing taxonomy criteria", () => {
    navigateToExploreResults({}, false, true);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          focusSearch: "1",
          clusterId: "",
          specialtyTagId: "",
        }),
      }),
    );
  });
});
