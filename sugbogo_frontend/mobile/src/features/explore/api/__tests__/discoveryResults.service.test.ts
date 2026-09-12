import apiClient from "@/shared/api/apiClient.service";

import {
  getDiscoveryResults,
  getExploreCollection,
  getExploreFilterOptions,
} from "../exploreBusiness.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("Explore discovery results transport", () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {},
      },
    });
  });

  it("sends repeated authoritative category IDs with all active filters", async () => {
    await getDiscoveryResults(
      {
        search: "  coffee  ",
        clusterId: 3,
        categoryIds: [7, 4],
        specialtyTagId: 12,
      },
      2,
    );

    const [, config] = (apiClient.get as jest.Mock).mock.calls[0];
    const params = config.params as URLSearchParams;

    expect(params.get("search")).toBe("coffee");
    expect(params.get("cluster")).toBe("3");
    expect(params.getAll("category")).toEqual(["7", "4"]);
    expect(params.get("specialty_tag")).toBe("12");
    expect(params.get("page")).toBe("2");
  });

  it("omits whitespace search and absent taxonomy filters", async () => {
    await getDiscoveryResults(
      {
        search: "   ",
        clusterId: null,
        categoryIds: [],
        specialtyTagId: null,
      },
      1,
    );

    const [, config] = (apiClient.get as jest.Mock).mock.calls[0];
    const params = config.params as URLSearchParams;

    expect(params.has("search")).toBe(false);
    expect(params.has("cluster")).toBe(false);
    expect(params.has("category")).toBe(false);
    expect(params.has("specialty_tag")).toBe(false);
  });

  it("loads shared taxonomy from the Explorer read-only endpoint", async () => {
    await getExploreFilterOptions();

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/filter-options/",
    );
  });

  it("sends taxonomy-only collection filters and pagination", async () => {
    await getExploreCollection(
      "interests",
      {
        clusterId: 3,
        categoryIds: [7, 4],
        specialtyTagId: 12,
      },
      2,
    );

    const [url, config] = (apiClient.get as jest.Mock).mock.calls[0];
    const params = config.params as URLSearchParams;

    expect(url).toBe("/explorer/explore/collections/interests/");
    expect(params.get("cluster")).toBe("3");
    expect(params.getAll("category")).toEqual(["7", "4"]);
    expect(params.get("specialty_tag")).toBe("12");
    expect(params.get("page")).toBe("2");
    expect(params.has("search")).toBe(false);
  });
});
