import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";

import BusinessNameChangeHistoryScreen from "../BusinessNameChangeHistoryScreen";

const mockProfile = jest.fn();
const mockRequests = jest.fn();
const mockRefetch = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock(
  "../../../hooks/business-name-change/useMerchantBusinessNameChanges",
  () => ({
    useMerchantBusinessNameChangeRequests: () => mockRequests(),
  }),
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const item = {
  id: 7,
  request_type: "business_name",
  previous_business_name: "Sugbo Bistro",
  proposed_business_name: "Sugbo Heritage Bistro",
  status: "pending",
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
};

describe("BusinessNameChangeHistoryScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business: { id: 10, business_name: "Sugbo Bistro", status: "active" },
    });
    mockRequests.mockReturnValue({
      requests: [item],
      pendingRequest: item,
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      error: null,
      refetch: mockRefetch,
    });
  });

  it("shows the pending request separately from the current live name", async () => {
    const screen = await render(<BusinessNameChangeHistoryScreen />);
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(screen.getByText("Sugbo Heritage Bistro")).toBeTruthy();
    expect(screen.getByText("Pending Admin review")).toBeTruthy();
    expect(screen.queryByText("Request name change")).toBeNull();
  });

  it("shows rejection feedback and permits a new request", async () => {
    mockRequests.mockReturnValue({
      ...mockRequests(),
      requests: [
        {
          ...item,
          status: "rejected",
          rejection_reason: "Please clarify the name.",
        },
      ],
      pendingRequest: null,
    });
    const screen = await render(<BusinessNameChangeHistoryScreen />);
    expect(screen.getByText("Reason: Please clarify the name.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Request name change"));
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/business-name-change");
  });

  it("renders a concise empty state", async () => {
    mockRequests.mockReturnValue({
      ...mockRequests(),
      requests: [],
      pendingRequest: null,
    });
    const screen = await render(<BusinessNameChangeHistoryScreen />);
    expect(screen.getByText("No requested changes yet.")).toBeTruthy();
  });

  it("keeps an error state with a query retry", async () => {
    mockRequests.mockReturnValue({
      ...mockRequests(),
      requests: [],
      error: new Error("Offline"),
    });
    const screen = await render(<BusinessNameChangeHistoryScreen />);
    await fireEvent.press(screen.getByText("Retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows loading placeholders before history arrives", async () => {
    mockRequests.mockReturnValue({
      ...mockRequests(),
      requests: [],
      isLoading: true,
    });
    const screen = await render(<BusinessNameChangeHistoryScreen />);
    expect(screen.queryByText("No requested changes yet.")).toBeNull();
  });

  it("loads another page when the history reaches its end", async () => {
    const fetchNextPage = jest.fn();
    mockRequests.mockReturnValue({
      ...mockRequests(),
      hasNextPage: true,
      fetchNextPage,
    });
    const screen = await render(<BusinessNameChangeHistoryScreen />);
    await fireEvent(
      screen.getByTestId("business-name-change-history-list"),
      "endReached",
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
