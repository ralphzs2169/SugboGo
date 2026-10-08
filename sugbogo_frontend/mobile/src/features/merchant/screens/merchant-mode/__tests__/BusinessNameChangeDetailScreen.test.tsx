import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

import BusinessNameChangeDetailScreen from "../BusinessNameChangeDetailScreen";

const mockDetail = jest.fn();
const mockWithdraw = jest.fn();

jest.mock(
  "../../../hooks/business-name-change/useMerchantBusinessNameChanges",
  () => ({
    useMerchantBusinessNameChangeRequest: () => mockDetail(),
    useWithdrawMerchantBusinessNameChange: () => ({
      mutateAsync: mockWithdraw,
      isPending: false,
    }),
  }),
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function MockConfirmModal({ visible, title, onConfirm }: any) {
    return visible ? (
      <Pressable onPress={onConfirm}>
        <Text>{title}</Text>
      </Pressable>
    ) : null;
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const request = {
  id: 7,
  request_type: "business_name",
  previous_business_name: "Sugbo Bistro",
  proposed_business_name: "Sugbo Heritage Bistro",
  status: "pending",
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
};

describe("BusinessNameChangeDetailScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDetail.mockReturnValue({
      request,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockWithdraw.mockResolvedValue({ ...request, status: "withdrawn" });
  });

  it("shows the saved before-and-after names and confirms withdrawal", async () => {
    const screen = await render(
      <BusinessNameChangeDetailScreen requestId={7} />,
    );
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(screen.getByText("Sugbo Heritage Bistro")).toBeTruthy();
    expect(screen.getByText("At submission")).toBeTruthy();
    expect(screen.getByText("Requested")).toBeTruthy();
    expect(screen.getByText("Under Review")).toBeTruthy();
    await fireEvent.press(screen.getByText("Withdraw Request"));
    await waitFor(() =>
      expect(
        screen.getByText("Withdraw this name change request?"),
      ).toBeTruthy(),
    );
    expect(mockWithdraw).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByText("Withdraw this name change request?"),
    );
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith(7));
  });

  it("shows rejection reason without a withdrawal action", async () => {
    mockDetail.mockReturnValue({
      request: {
        ...request,
        status: "rejected",
        rejection_reason: "Name unclear.",
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const screen = await render(
      <BusinessNameChangeDetailScreen requestId={7} />,
    );
    expect(screen.getByText("Name unclear.")).toBeTruthy();
    expect(screen.getByText("Request Rejected")).toBeTruthy();
    expect(screen.getByText("Administrator notes")).toBeTruthy();
    expect(screen.queryByText("Withdraw Request")).toBeNull();
  });

  it("shows approved status without a withdrawal action", async () => {
    mockDetail.mockReturnValue({
      request: { ...request, status: "approved" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const screen = await render(
      <BusinessNameChangeDetailScreen requestId={7} />,
    );
    expect(screen.getByText("Name Approved")).toBeTruthy();
    expect(screen.getByText("At submission")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.queryByText("Withdraw Request")).toBeNull();
  });

  it("keeps withdrawn requests read-only", async () => {
    mockDetail.mockReturnValue({
      request: { ...request, status: "withdrawn" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const screen = await render(
      <BusinessNameChangeDetailScreen requestId={7} />,
    );
    expect(screen.getByText("Withdrawn")).toBeTruthy();
    expect(screen.queryByText("Withdraw Request")).toBeNull();
  });

  it("keeps a persistent error with Retry when detail cannot load", async () => {
    const refetch = jest.fn();
    mockDetail.mockReturnValue({
      request: null,
      isLoading: false,
      error: new Error("Offline"),
      refetch,
    });
    const screen = await render(
      <BusinessNameChangeDetailScreen requestId={7} />,
    );
    expect(screen.getByText("Unable to load request")).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
