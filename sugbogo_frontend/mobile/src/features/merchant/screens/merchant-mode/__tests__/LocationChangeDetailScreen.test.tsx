import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import LocationChangeDetailScreen from "../LocationChangeDetailScreen";
import { useLocationChangeReviewStore } from "../../../stores/locationChangeReviewStore";

const mockDetail = jest.fn();
const mockWithdraw = jest.fn();
const mockConfirmModal = jest.fn((_props: unknown) => null);

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock("../../../hooks/location-change/useMerchantLocationChanges", () => ({
  useMerchantLocationChangeRequest: () => mockDetail(),
  useWithdrawMerchantLocationChange: () => ({
    mutateAsync: mockWithdraw,
    isPending: false,
  }),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock(
  "../../../components/location-change/LocationChangeComparison",
  () => ({
    __esModule: true,
    default: ({ title, onView }: { title: string; onView: () => void }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable onPress={onView} accessibilityLabel={`View ${title}`}>
          <Text>{title}</Text>
        </Pressable>
      );
    },
  }),
);
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: (props: unknown) => mockConfirmModal(props),
}));

const request = {
  id: 11,
  request_type: "location",
  status: "pending",
  previous: {
    location: { address: "Old", latitude: 10.31, longitude: 123.88 },
    landmarks: [],
  },
  proposed: {
    location: { address: "New", latitude: 10.32, longitude: 123.89 },
    landmarks: [],
  },
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
};

describe("Location change detail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationChangeReviewStore.getState().clearPreview();
    mockDetail.mockReturnValue({
      request,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
    });
    mockWithdraw.mockResolvedValue({ ...request, status: "withdrawn" });
  });

  it("keeps the historical location expandable and confirms pending withdrawal", async () => {
    const screen = await render(<LocationChangeDetailScreen requestId={11} />);
    expect(screen.getByText("Requested location")).toBeTruthy();
    expect(screen.getByText("Location when submitted")).toBeTruthy();
    expect(screen.queryByLabelText("View Location when submitted")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText("Location when submitted"));
    });
    expect(screen.getByLabelText("View Location when submitted")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("View Requested location"));
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/location-change/review-landmarks",
    );
    expect(
      useLocationChangeReviewStore.getState().businessLocation?.latitude,
    ).toBe(10.32);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Withdraw Request"));
    });
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    expect(mockWithdraw).toHaveBeenCalledWith(11);
    await screen.unmount();
  });

  it("retains rejected history and explains the decision", async () => {
    mockDetail.mockReturnValue({
      request: {
        ...request,
        status: "rejected",
        resolved_at: "2026-10-04T10:00:00Z",
        rejection_reason: "Outside the current service area.",
      },
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
    });
    const screen = await render(<LocationChangeDetailScreen requestId={11} />);

    await waitFor(() =>
      expect(
        screen.getByText("Outside the current service area."),
      ).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Withdraw Request")).toBeNull();
    await screen.unmount();
  });
});
