import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { handleSystemError } from "@/shared/utils/apiErrors";

import useSimilarBusinesses from "../../../hooks/useSimilarBusinesses";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import SimilarPlacesSection from "../SimilarPlacesSection";

const mockBusinessCard = jest.fn(
  ({ business, onPress }: { business: ExploreBusiness; onPress: () => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text } = require("react-native");

    return (
      <Pressable
        testID={`shared-business-card-${business.id}`}
        onPress={onPress}
      >
        <Text>{business.business_name}</Text>
      </Pressable>
    );
  },
);

jest.mock("../../../hooks/useSimilarBusinesses");
jest.mock("@/shared/hooks/useUserLocation", () => ({
  __esModule: true,
  default: () => ({
    location: null,
  }),
}));
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));
jest.mock("../../new-businesses/BusinessCard", () => ({
  __esModule: true,
  default: (props: unknown) => mockBusinessCard(props as never),
}));
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: ({ onPrimaryAction }: { onPrimaryAction: () => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text } = require("react-native");

    return (
      <Pressable testID="similar-places-retry" onPress={onPrimaryAction}>
        <Text>Retry</Text>
      </Pressable>
    );
  },
}));

function createBusiness(id: number): ExploreBusiness {
  return {
    id,
    business_name: `Similar Business ${id}`,
    cover_photo_url: null,
    is_pocketed: id === 1,
    cluster: {
      id: 1,
      name: "Culinary",
      icon: "utensils",
    },
    category: {
      id: 8,
      name: "Cafe",
    },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.89,
    },
  };
}

describe("Similar Places", () => {
  beforeEach(() => {
    mockBusinessCard.mockClear();
    (router.push as jest.Mock).mockClear();
  });

  it("renders four results with the shared compact BusinessCard", async () => {
    (useSimilarBusinesses as jest.Mock).mockReturnValue({
      businesses: [1, 2, 3, 4].map(createBusiness),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<SimilarPlacesSection businessId={20} />);

    expect(screen.getByText("Similar Places")).toBeTruthy();
    expect(screen.getAllByTestId(/shared-business-card-/)).toHaveLength(4);
    expect(mockBusinessCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        business: expect.objectContaining({ id: 1, is_pocketed: true }),
        variant: "compact",
      }),
    );
    await screen.unmount();
  });

  it("uses the existing business profile route when a card is pressed", async () => {
    (useSimilarBusinesses as jest.Mock).mockReturnValue({
      businesses: [createBusiness(42)],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<SimilarPlacesSection businessId={20} />);
    await fireEvent.press(screen.getByTestId("shared-business-card-42"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: {
        businessId: "42",
        distance: "",
        distanceAccuracy: "",
      },
    });
    await screen.unmount();
  });

  it("shows a small loading state and hides a successful empty result", async () => {
    (useSimilarBusinesses as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    const loading = await render(<SimilarPlacesSection businessId={20} />);
    expect(loading.getByTestId("similar-places-loading")).toBeTruthy();
    await loading.unmount();

    (useSimilarBusinesses as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const empty = await render(<SimilarPlacesSection businessId={20} />);
    expect(empty.queryByText("Similar Places")).toBeNull();
    expect(empty.toJSON()).toBeNull();
    await empty.unmount();
  });

  it("keeps a section error with Retry and uses standard API error handling", async () => {
    const refetch = jest.fn();
    const failure = {
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    };
    (handleSystemError as jest.Mock).mockReturnValue(true);
    (useSimilarBusinesses as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: failure,
      refetch,
    });

    const screen = await render(<SimilarPlacesSection businessId={20} />);

    await waitFor(() => {
      expect(handleSystemError).toHaveBeenCalledWith(failure);
    });
    await fireEvent.press(screen.getByTestId("similar-places-retry"));

    expect(screen.getByTestId("similar-places-error")).toBeTruthy();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(Toast.show).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
