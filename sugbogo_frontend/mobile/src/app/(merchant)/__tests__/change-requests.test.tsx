import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";

import ChangeRequestsRoute from "../change-requests";

const mockPush = jest.fn();
const mockName = jest.fn();
const mockClassification = jest.fn();
const mockLocation = jest.fn();
const mockNameRefetch = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock(
  "@/features/merchant/hooks/business-name-change/useMerchantBusinessNameChanges",
  () => ({
    useMerchantBusinessNameChangeRequests: () => mockName(),
  }),
);
jest.mock(
  "@/features/merchant/hooks/classification-change/useMerchantClassificationChanges",
  () => ({
    useMerchantClassificationChangeRequests: () => mockClassification(),
  }),
);
jest.mock(
  "@/features/merchant/hooks/location-change/useMerchantLocationChanges",
  () => ({
    useMerchantLocationChangeRequests: () => mockLocation(),
  }),
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("ChangeRequestsRoute", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockName.mockReturnValue({
      totalRequests: 5,
      pendingRequest: { id: 1 },
      error: null,
      refetch: mockNameRefetch,
    });
    mockClassification.mockReturnValue({
      totalRequests: 3,
      pendingRequest: null,
      error: null,
      refetch: jest.fn(),
    });
    mockLocation.mockReturnValue({
      totalRequests: 0,
      pendingRequest: null,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("opens each existing history route and shows confirmed summaries", async () => {
    const screen = await render(<ChangeRequestsRoute />);
    expect(screen.getByText("(5)")).toBeTruthy();
    expect(screen.getByText("(3)")).toBeTruthy();
    expect(screen.queryByText("(0)")).toBeNull();
    expect(screen.getAllByText("Pending")).toHaveLength(1);

    await fireEvent.press(screen.getByLabelText(/View business name requests/));
    await fireEvent.press(
      screen.getByLabelText(/View classification requests/),
    );
    await fireEvent.press(
      screen.getByLabelText(/View location & landmarks requests/),
    );
    expect(mockPush.mock.calls.map(([route]) => route)).toEqual([
      "/(merchant)/business-update-requests",
      "/(merchant)/business-update-requests/classification",
      "/(merchant)/business-update-requests/location",
    ]);
  });

  it("keeps navigation available while summaries are unknown", async () => {
    mockName.mockReturnValue({
      totalRequests: undefined,
      pendingRequest: null,
      error: null,
      refetch: mockNameRefetch,
    });
    const screen = await render(<ChangeRequestsRoute />);
    expect(screen.queryByText("(5)")).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(screen.getByLabelText(/View business name requests/)).toBeTruthy();
  });

  it("shows a targeted Retry without blocking the failed row", async () => {
    mockName.mockReturnValue({
      totalRequests: undefined,
      pendingRequest: null,
      error: new Error("Offline"),
      refetch: mockNameRefetch,
    });
    const screen = await render(<ChangeRequestsRoute />);
    expect(
      screen.getByText("Unable to load business name status"),
    ).toBeTruthy();
    expect(screen.getByLabelText(/View business name requests/)).toBeTruthy();
    await fireEvent.press(
      screen.getByText("Unable to load business name status"),
    );
    expect(mockNameRefetch).toHaveBeenCalledTimes(1);
  });
});
