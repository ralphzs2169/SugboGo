import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
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
  afterEach(async () => {
    await cleanup();
  });

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

  it("shows a moved pin and retains full-map navigation", async () => {
    const screen = await render(<LocationChangeDetailScreen requestId={11} />);
    expect(
      screen.getAllByText("Requested business pin").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Business pin at submission")).toBeTruthy();
    expect(
      screen.queryByLabelText("View Business pin at submission"),
    ).toBeNull();
    await fireEvent.press(screen.getByLabelText("Business pin at submission"));
    expect(
      screen.getByLabelText("View Business pin at submission"),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("View Requested business pin"));
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/location-change/review-landmarks",
    );
    expect(
      useLocationChangeReviewStore.getState().businessLocation?.latitude,
    ).toBe(10.32);
  });

  it("shows only the changed address field for an address-only request", async () => {
    mockDetail.mockReturnValue({
      request: {
        ...request,
        proposed: {
          location: {
            ...request.previous.location,
            address: "New",
          },
          landmarks: [],
        },
      },
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<LocationChangeDetailScreen requestId={11} />);
    expect(screen.getByText("Address changes")).toBeTruthy();
    expect(screen.getByText("At submission")).toBeTruthy();
    expect(screen.getByText("Old")).toBeTruthy();
    expect(screen.getByText("Requested")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.queryByText("Requested business pin")).toBeNull();
    expect(screen.queryByText("Business pin at submission")).toBeNull();
    expect(screen.queryByText("View full map")).toBeNull();
    expect(screen.queryByText("View requested landmarks on map")).toBeNull();
  });

  it("shows landmark changes without a pin map when only landmarks changed", async () => {
    mockDetail.mockReturnValue({
      request: {
        ...request,
        proposed: {
          location: request.previous.location,
          landmarks: [
            {
              id: 3,
              name: "Nearby cafe",
              address: "Cebu City",
              latitude: 10.32,
              longitude: 123.89,
              source: "google",
              place_id: null,
            },
          ],
        },
      },
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<LocationChangeDetailScreen requestId={11} />);
    expect(screen.getByText("Landmark changes")).toBeTruthy();
    expect(screen.getByText("Requested to add (1)")).toBeTruthy();
    expect(screen.getByText("Nearby cafe")).toBeTruthy();
    expect(screen.queryByText("Requested business pin")).toBeNull();
    expect(screen.queryByText("View full map")).toBeNull();
    expect(
      screen.getByLabelText("View requested landmarks on map"),
    ).toBeTruthy();
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
  });

  it("confirms pending withdrawal", async () => {
    const screen = await render(<LocationChangeDetailScreen requestId={11} />);
    await fireEvent.press(screen.getByLabelText("Withdraw Request"));
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    await act(async () => {
      await (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    expect(mockWithdraw).toHaveBeenCalledWith(11);
  });
});
