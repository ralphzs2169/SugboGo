import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

import ClassificationChangeDetailScreen from "../ClassificationChangeDetailScreen";

const mockDetail = jest.fn();
const mockWithdraw = jest.fn();
const mockRefetch = jest.fn();

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock(
  "../../../hooks/classification-change/useMerchantClassificationChanges",
  () => ({
    useMerchantClassificationChangeRequest: () => mockDetail(),
    useWithdrawMerchantClassificationChange: () => ({
      mutateAsync: mockWithdraw,
      isPending: false,
    }),
  }),
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const request = {
  id: 7,
  request_type: "classification",
  status: "pending",
  previous: {
    cluster: { id: 1, name: "Food" },
    category: { id: 2, name: "Restaurants" },
    specialty_tags: [{ id: 1, name: "Lechon" }],
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

describe("ClassificationChangeDetailScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDetail.mockReturnValue({
      request,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: mockRefetch,
    });
    mockWithdraw.mockResolvedValue({ ...request, status: "withdrawn" });
  });

  it("shows submitted snapshots and confirms pending withdrawal", async () => {
    const screen = await render(
      <ClassificationChangeDetailScreen requestId={7} />,
    );
    expect(screen.getByText("Current at Submission")).toBeTruthy();
    expect(screen.getByText("Restaurants")).toBeTruthy();
    expect(screen.getByText("Creative Arts")).toBeTruthy();
    expect(screen.getByText("Handmade Crafts")).toBeTruthy();
    expect(screen.getByText("Pending Admin review")).toBeTruthy();
    await fireEvent.press(screen.getByText("Withdraw Request"));
    expect(mockWithdraw).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Withdraw"));
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith(7));
  });

  it("renders rejection feedback and hides terminal withdrawal", async () => {
    mockDetail.mockReturnValue({
      request: {
        ...request,
        status: "rejected",
        rejection_reason: "The name does not match the category.",
      },
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: mockRefetch,
    });
    const screen = await render(
      <ClassificationChangeDetailScreen requestId={7} />,
    );
    expect(
      screen.getByText("The name does not match the category."),
    ).toBeTruthy();
    expect(screen.queryByText("Withdraw Request")).toBeNull();
  });

  it.each(["approved", "withdrawn"])(
    "keeps %s requests read-only",
    async (status) => {
      mockDetail.mockReturnValue({
        request: { ...request, status },
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      });
      const screen = await render(
        <ClassificationChangeDetailScreen requestId={7} />,
      );
      expect(screen.queryByText("Withdraw Request")).toBeNull();
    },
  );

  it("keeps a persistent Retry action when the detail fails", async () => {
    mockDetail.mockReturnValue({
      request: null,
      isLoading: false,
      isRefetching: false,
      error: new Error("Network unavailable"),
      refetch: mockRefetch,
    });
    const screen = await render(
      <ClassificationChangeDetailScreen requestId={7} />,
    );
    await fireEvent.press(screen.getByText("Retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
