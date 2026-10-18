import apiClient from "@/shared/api/apiClient.service";
import { API_ERROR_CODE } from "@/shared/constants/errorCodes";
import type {
  ApiError,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";

import type { PocketCollectionListResponse } from "../../types/pockets.types";
import { getPocketCollections } from "../pockets.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
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
