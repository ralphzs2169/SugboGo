import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";

import ClassificationChangeHistoryScreen from "../ClassificationChangeHistoryScreen";

const mockHistory = jest.fn();
const mockProfile = jest.fn();
const mockRefetch = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock(
  "../../../hooks/classification-change/useMerchantClassificationChanges",
  () => ({
    useMerchantClassificationChangeRequests: () => mockHistory(),
  }),
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const request = {
  id: 7,
  request_type: "classification",
  status: "pending",
  previous: {
    cluster: { id: 1, name: "Food" },
    category: { id: 2, name: "Restaurants" },
    specialty_tags: [],
  },
  proposed: {
    cluster: { id: 5, name: "Culture" },
    category: { id: 4, name: "Creative Arts" },
    specialty_tags: [{ id: 4, name: "Handmade Crafts" }],
  },
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
};

describe("ClassificationChangeHistoryScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business: { status: "active", category: { name: "Restaurants" } },
    });
    mockHistory.mockReturnValue({
      requests: [request],
      pendingRequest: request,
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      error: null,
      refetch: mockRefetch,
    });
  });

  it("shows request snapshots in newest-first order and opens detail", async () => {
    const screen = await render(<ClassificationChangeHistoryScreen />);
    expect(screen.getByText("Current live category")).toBeTruthy();
    expect(screen.getByText("Creative Arts")).toBeTruthy();
    expect(screen.getByText("Handmade Crafts")).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText("View classification request for Creative Arts"),
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/classification/7",
    );
    expect(screen.queryByText("Request classification change")).toBeNull();
  });

  it("shows rejection feedback and permits a new classification request", async () => {
    mockHistory.mockReturnValue({
      ...mockHistory(),
      requests: [
        {
          ...request,
          status: "rejected",
          rejection_reason: "Please choose a more accurate category.",
        },
      ],
      pendingRequest: null,
    });
    const screen = await render(<ClassificationChangeHistoryScreen />);
    expect(
      screen.getByText(/Please choose a more accurate category/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Request classification change"));
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/classification-change");
  });

  it("shows loading placeholders before history arrives", async () => {
    mockHistory.mockReturnValue({
      ...mockHistory(),
      requests: [],
      pendingRequest: null,
      isLoading: true,
    });
    const loading = await render(<ClassificationChangeHistoryScreen />);
    expect(
      loading.queryByText("No classification change requests yet."),
    ).toBeNull();
  });

  it("shows an empty state", async () => {
    mockHistory.mockReturnValue({
      requests: [],
      pendingRequest: null,
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      error: null,
      refetch: mockRefetch,
    });
    const empty = await render(<ClassificationChangeHistoryScreen />);
    expect(
      empty.getByText("No classification change requests yet."),
    ).toBeTruthy();
  });

  it("keeps a persistent Retry action on a page-level error", async () => {
    mockHistory.mockReturnValue({
      requests: [],
      pendingRequest: null,
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      error: new Error("Network unavailable"),
      refetch: mockRefetch,
    });
    const error = await render(<ClassificationChangeHistoryScreen />);
    await fireEvent.press(error.getByText("Retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("loads the next page when the list reaches its end", async () => {
    const fetchNextPage = jest.fn();
    mockHistory.mockReturnValue({
      ...mockHistory(),
      hasNextPage: true,
      fetchNextPage,
    });
    const screen = await render(<ClassificationChangeHistoryScreen />);
    await fireEvent(
      screen.getByTestId("classification-change-history-list"),
      "endReached",
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
