import type {
  ExploreBusiness,
  ExploreBusinessListResponse,
} from "@/features/explore/types/exploreBusiness.types";
import apiClient from "@/shared/api/apiClient.service";
import { API_ERROR_CODE } from "@/shared/constants/errorCodes";
import type {
  ApiError,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";

import type {
  PocketCollection,
  PocketCollectionListResponse,
} from "../../types/pockets.types";
import {
  getBusinessPocketMemberships,
  getPocketCollection,
  getPocketCollectionBusinesses,
  getPocketCollections,
  replaceBusinessPocketMemberships,
  createPocketCollection,
  renamePocketCollection,
  deletePocketCollection,
  removePocketCollectionBusiness,
} from "../pockets.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const emptyResponse: ApiSuccessWithData<PocketCollectionListResponse> = {
  success: true,
  message: "Success.",
  data: {
    items: [],
    pagination: {
      page: 1,
      page_size: 10,
      total_items: 0,
      total_pages: 0,
      has_next: false,
      has_previous: false,
    },
  },
};

describe("Pocket collection management transport", () => {
  const collection: PocketCollection = {
    id: 30,
    name: "Coffee",
    is_default: false,
    business_count: 0,
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
  };
  const calls = [
    {
      method: "post" as const,
      path: "/explorer/explore/pockets/",
      args: [{ name: " Coffee " }],
      run: () => createPocketCollection(" Coffee "),
      data: collection,
    },
    {
      method: "patch" as const,
      path: "/explorer/explore/pockets/30/",
      args: [{ name: "Coffee" }],
      run: () => renamePocketCollection(30, "Coffee"),
      data: collection,
    },
    {
      method: "delete" as const,
      path: "/explorer/explore/pockets/30/",
      args: [],
      run: () => deletePocketCollection(30),
      data: { id: 30 },
    },
    {
      method: "delete" as const,
      path: "/explorer/explore/pockets/30/businesses/42/",
      args: [],
      run: () => removePocketCollectionBusiness(30, 42),
      data: { business_id: 42, pocket_ids: [20], is_pocketed: true },
    },
  ];
  beforeEach(() => {
    jest.mocked(apiClient.post).mockReset();
    jest.mocked(apiClient.patch).mockReset();
    jest.mocked(apiClient.delete).mockReset();
  });
  it.each(calls)(
    "uses $method $path and preserves the response",
    async ({ method, path, args, run, data }) => {
      const response = { success: true, message: "Success.", data };
      jest.mocked(apiClient[method]).mockResolvedValue({ data: response });
      await expect(run()).resolves.toEqual(response);
      expect(apiClient[method]).toHaveBeenCalledWith(path, ...args);
    },
  );
  it.each([400, 401, 403, 404, 429])(
    "preserves structured HTTP %s errors for every management action",
    async (status) => {
      const response = {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid Pocket.",
        errors: { name: ["You already have a Pocket with this name."] },
      };
      for (const { method, run } of calls) {
        jest.mocked(apiClient[method]).mockRejectedValue({
          isAxiosError: true,
          response: { status, data: response },
        });
        await expect(run()).resolves.toEqual(response);
      }
    },
  );
  it("normalizes transport failures without adding fallback metadata", async () => {
    const error = new Error("Offline");
    error.name = API_ERROR_CODE.NETWORK_ERROR;
    for (const { method, run } of calls) {
      jest.mocked(apiClient[method]).mockRejectedValue(error);
      await expect(run()).resolves.toMatchObject({
        success: false,
        code: API_ERROR_CODE.NETWORK_ERROR,
      });
    }
  });
});

describe("Pocket collection list transport", () => {
  beforeEach(() => {
    jest.mocked(apiClient.get).mockReset();
    jest.mocked(apiClient.get).mockResolvedValue({ data: emptyResponse });
  });

  it("defaults to the first page without overriding the server page size", async () => {
    await getPocketCollections();

    expect(apiClient.get).toHaveBeenCalledWith("/explorer/explore/pockets/", {
      params: { page: 1 },
    });
  });

  it("requests the supplied page without sending unsupported filters", async () => {
    await getPocketCollections(3);

    expect(apiClient.get).toHaveBeenCalledWith("/explorer/explore/pockets/", {
      params: { page: 3 },
    });
  });

  it("sends an optional page size using the backend parameter name", async () => {
    await getPocketCollections(2, 25);

    expect(apiClient.get).toHaveBeenCalledWith("/explorer/explore/pockets/", {
      params: { page: 2, page_size: 25 },
    });
  });

  it("preserves collection metadata, backend order, and the pagination envelope", async () => {
    const response: ApiSuccessWithData<PocketCollectionListResponse> = {
      success: true,
      message: "Success.",
      data: {
        items: [
          {
            id: 20,
            name: "Favorites",
            is_default: true,
            business_count: 3,
            created_at: "2026-10-19T02:00:00Z",
            updated_at: "2026-10-19T03:00:00Z",
          },
          {
            id: 8,
            name: "Weekend",
            is_default: false,
            business_count: 0,
            created_at: "2026-10-19T02:30:00Z",
            updated_at: "2026-10-19T02:30:00Z",
          },
        ],
        pagination: {
          page: 1,
          page_size: 2,
          total_items: 12,
          total_pages: 6,
          has_next: true,
          has_previous: false,
        },
      },
    };
    jest.mocked(apiClient.get).mockResolvedValue({ data: response });

    await expect(getPocketCollections(1, 2)).resolves.toEqual(response);
  });

  it("preserves a successful empty list without inserting local collections", async () => {
    await expect(getPocketCollections()).resolves.toEqual(emptyResponse);
  });

  it.each([
    {
      status: 401,
      code: "NOT_AUTHENTICATED",
      message: "Authentication credentials were not provided.",
    },
    {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "You do not have permission to perform this action.",
    },
    { status: 404, code: "NOT_FOUND", message: "Invalid page." },
  ])(
    "preserves a structured HTTP $status API error",
    async ({ status, code, message }) => {
      const response: ApiError = { success: false, code, message };
      jest.mocked(apiClient.get).mockRejectedValue({
        isAxiosError: true,
        response: { status, data: response },
      });

      await expect(getPocketCollections(500)).resolves.toEqual(response);
    },
  );

  it("normalizes a network failure through the existing request wrapper", async () => {
    const error = new Error("Offline");
    error.name = API_ERROR_CODE.NETWORK_ERROR;
    jest.mocked(apiClient.get).mockRejectedValue(error);

    await expect(getPocketCollections()).resolves.toMatchObject({
      success: false,
      code: API_ERROR_CODE.NETWORK_ERROR,
    });
  });

  it("returns the existing unknown-error response for an unexpected failure", async () => {
    jest
      .mocked(apiClient.get)
      .mockRejectedValue(new Error("Unexpected failure"));

    await expect(getPocketCollections()).resolves.toMatchObject({
      success: false,
      code: API_ERROR_CODE.UNKNOWN_ERROR,
    });
  });
});

describe("complete Pocket membership transport", () => {
  beforeEach(() => {
    jest.mocked(apiClient.get).mockReset();
    jest.mocked(apiClient.put).mockReset();
  });
  it("reads all membership IDs without collection pagination", async () => {
    const response = {
      success: true,
      message: "Pocket memberships retrieved successfully.",
      data: { business_id: 42, pocket_ids: [20, 999], is_pocketed: true },
    };
    jest.mocked(apiClient.get).mockResolvedValue({ data: response });
    await expect(getBusinessPocketMemberships(42)).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/businesses/42/pockets/",
    );
  });
  it.each([[20, 999], []].map((ids) => ({ ids })))(
    "replaces the complete selection $ids",
    async ({ ids }) => {
      const response = {
        success: true,
        message: "Pocket memberships updated successfully.",
        data: { business_id: 42, pocket_ids: ids, is_pocketed: ids.length > 0 },
      };
      jest.mocked(apiClient.put).mockResolvedValue({ data: response });
      await expect(replaceBusinessPocketMemberships(42, ids)).resolves.toEqual(
        response,
      );
      expect(apiClient.put).toHaveBeenCalledWith(
        "/explorer/explore/businesses/42/pockets/",
        { pocket_ids: ids },
      );
    },
  );
  it.each([400, 401, 403, 404, 429])(
    "preserves HTTP %s failures from both membership methods",
    async (status) => {
      const response = {
        success: false,
        code: "API_ERROR",
        message: "Request failed.",
      };
      const failure = {
        isAxiosError: true,
        response: { status, data: response },
      };
      jest.mocked(apiClient.get).mockRejectedValue(failure);
      jest.mocked(apiClient.put).mockRejectedValue(failure);
      await expect(getBusinessPocketMemberships(42)).resolves.toEqual(response);
      await expect(replaceBusinessPocketMemberships(42, [])).resolves.toEqual(
        response,
      );
    },
  );
  it("normalizes transport failures for replacement", async () => {
    const error = new Error("Offline");
    error.name = API_ERROR_CODE.NETWORK_ERROR;
    jest.mocked(apiClient.put).mockRejectedValue(error);
    await expect(
      replaceBusinessPocketMemberships(42, [20]),
    ).resolves.toMatchObject({
      success: false,
      code: API_ERROR_CODE.NETWORK_ERROR,
    });
  });
});

describe("Pocket collection metadata transport", () => {
  beforeEach(() => {
    jest.mocked(apiClient.get).mockReset();
  });

  it.each([
    { id: 20, name: "Favorites", is_default: true, business_count: 0 },
    { id: 7, name: "Weekend", is_default: false, business_count: 4 },
  ])(
    "requests collection $id and preserves its metadata",
    async (collection) => {
      const response: ApiSuccessWithData<PocketCollection> = {
        success: true,
        message: "Pocket retrieved successfully.",
        data: {
          ...collection,
          created_at: "2026-10-19T02:00:00Z",
          updated_at: "2026-10-19T03:00:00Z",
        },
      };
      jest.mocked(apiClient.get).mockResolvedValue({ data: response });

      await expect(getPocketCollection(collection.id)).resolves.toEqual(
        response,
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/explorer/explore/pockets/${collection.id}/`,
      );
    },
  );
});

describe("Pocket collection business transport", () => {
  const emptyBusinessesResponse: ApiSuccessWithData<ExploreBusinessListResponse> =
    {
      success: true,
      message: "Success.",
      data: { items: [], pagination: emptyResponse.data.pagination },
    };

  beforeEach(() => {
    jest.mocked(apiClient.get).mockReset();
    jest
      .mocked(apiClient.get)
      .mockResolvedValue({ data: emptyBusinessesResponse });
  });

  it("requests the collection's businesses on page one without overriding page size", async () => {
    await getPocketCollectionBusinesses(7);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/pockets/7/businesses/",
      { params: { page: 1 } },
    );
  });

  it("requests an explicit page without adding filters or a page size", async () => {
    await getPocketCollectionBusinesses(20, 3);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/pockets/20/businesses/",
      { params: { page: 3 } },
    );
  });

  it("sends the optional page size using the backend parameter name", async () => {
    await getPocketCollectionBusinesses(20, 2, 25);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/pockets/20/businesses/",
      { params: { page: 2, page_size: 25 } },
    );
  });

  it("preserves a successful empty business list and its pagination", async () => {
    await expect(getPocketCollectionBusinesses(20)).resolves.toEqual(
      emptyBusinessesResponse,
    );
  });

  it("preserves business data, nullable images, backend order, and pagination", async () => {
    const business: ExploreBusiness = {
      id: 81,
      business_name: "Neighborhood Cafe",
      cover_photo_url: null,
      display_cover_photo_url: "https://example.com/storefront.jpg",
      review_count: 3,
      overall_vibe: null,
      is_pocketed: true,
      cluster: { id: 1, name: "Food and Drink", icon: "food" },
      category: { id: 2, name: "Cafe" },
      specialty_tags: [
        {
          id: 5,
          name: "Local coffee",
          color: "green",
          icon: null,
          vouch_count: 4,
          is_vouched: true,
        },
      ],
      location: {
        address: "Sample Street",
        city: "Cebu City",
        province: "Cebu",
        latitude: 10.3157,
        longitude: 123.8854,
      },
    };
    const response: ApiSuccessWithData<ExploreBusinessListResponse> = {
      success: true,
      message: "Success.",
      data: {
        items: [
          business,
          {
            ...business,
            id: 7,
            business_name: "Corner Cafe",
            display_cover_photo_url: null,
            specialty_tags: [],
          },
        ],
        pagination: {
          page: 2,
          page_size: 2,
          total_items: 5,
          total_pages: 3,
          has_next: true,
          has_previous: true,
        },
      },
    };
    jest.mocked(apiClient.get).mockResolvedValue({ data: response });

    await expect(getPocketCollectionBusinesses(20, 2, 2)).resolves.toEqual(
      response,
    );
  });

  it("preserves an invalid-page error without converting it to an empty list", async () => {
    const response: ApiError = {
      success: false,
      code: "NOT_FOUND",
      message: "Invalid page.",
    };
    jest.mocked(apiClient.get).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: response },
    });

    await expect(getPocketCollectionBusinesses(20, 500)).resolves.toEqual(
      response,
    );
  });
});

describe.each([
  { name: "collection metadata", load: () => getPocketCollection(20) },
  {
    name: "collection businesses",
    load: () => getPocketCollectionBusinesses(20),
  },
])("$name error handling", ({ load }) => {
  beforeEach(() => {
    jest.mocked(apiClient.get).mockReset();
  });

  it.each([
    {
      status: 401,
      data: {
        success: false,
        code: "NOT_AUTHENTICATED",
        message: "Authentication credentials were not provided.",
      },
    },
    {
      status: 403,
      data: {
        success: false,
        code: "PERMISSION_DENIED",
        message: "You do not have permission to perform this action.",
      },
    },
    {
      status: 404,
      data: {
        success: false,
        code: "NOT_FOUND",
        message: "The Pocket could not be found.",
      },
    },
    {
      status: 429,
      data: {
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests.",
        errors: {
          detail: "Please wait before trying again.",
          retry_after: 30,
        },
      },
    },
  ])(
    "preserves the structured HTTP $status response",
    async ({ status, data }) => {
      jest.mocked(apiClient.get).mockRejectedValue({
        isAxiosError: true,
        response: { status, data },
      });

      await expect(load()).resolves.toEqual(data);
    },
  );

  it.each([
    { name: API_ERROR_CODE.NETWORK_ERROR, code: API_ERROR_CODE.NETWORK_ERROR },
    {
      name: API_ERROR_CODE.REQUEST_TIMEOUT,
      code: API_ERROR_CODE.REQUEST_TIMEOUT,
    },
    { name: API_ERROR_CODE.AUTH_ERROR, code: "SESSION_EXPIRED" },
  ])("normalizes $name through the request wrapper", async ({ name, code }) => {
    const error = new Error("Request failed");
    error.name = name;
    jest.mocked(apiClient.get).mockRejectedValue(error);

    await expect(load()).resolves.toMatchObject({ success: false, code });
  });

  it("uses the existing unknown-error response for unexpected failures", async () => {
    jest
      .mocked(apiClient.get)
      .mockRejectedValue(new Error("Unexpected failure"));

    await expect(load()).resolves.toMatchObject({
      success: false,
      code: API_ERROR_CODE.UNKNOWN_ERROR,
    });
  });
});
