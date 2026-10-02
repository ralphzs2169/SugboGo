import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import MerchantProfileScreen from "../MerchantProfileScreen";

const mockRefetch = jest.fn();
const mockProfile = jest.fn();
const mockNotify = jest.fn();

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

jest.mock("../../../hooks/business-profile/useUpdateBusinessCoverPhoto", () => ({
  __esModule: true,
  default: () => ({ updateCoverPhoto: jest.fn(), isUploading: false }),
}));

jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: (options: unknown) => mockNotify(options),
}));

jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 80,
}));

jest.mock("@/features/app-mode/store/appMode.store", () => ({
  useAppModeStore: (selector: (state: unknown) => unknown) =>
    selector({ setActiveMode: jest.fn() }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("../../../components/business-profile/MerchantProfileHeader", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockHeader() {
    return <Text>Cover photo header</Text>;
  };
});

jest.mock("../../../components/business-profile/MerchantBusinessOverview", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockOverview() {
    return <Text>Business details</Text>;
  };
});

describe("MerchantProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue({ data: null, error: null });
  });

  it("keeps a persistent error and retries the profile query", async () => {
    const error = new Error("Network unavailable");
    mockProfile.mockReturnValue({
      business: null,
      isLoading: false,
      error,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);

    expect(screen.getByText("Unable to load business profile")).toBeTruthy();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ error }),
    );

    fireEvent.press(screen.getByText("Try Again"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached business content visible after a refetch error", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        status: "suspended",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
      },
      isLoading: false,
      error: new Error("Refetch failed"),
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);

    expect(screen.getByText("Business details")).toBeTruthy();
    expect(screen.getByText("Suspended")).toBeTruthy();
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });
});
