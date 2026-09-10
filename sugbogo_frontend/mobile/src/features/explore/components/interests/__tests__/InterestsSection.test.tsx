import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { handleSystemError } from "@/shared/utils/apiErrors";

import InterestsSection from "../InterestsSection";
import useRecommendations from "../../../hooks/useRecommendations";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";

jest.mock("../../../hooks/useRecommendations");
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));
jest.mock("../../new-businesses/BusinessCard", () => ({
  __esModule: true,
  default: ({
    business,
    onPress,
  }: {
    business: ExploreBusiness;
    onPress: () => void;
  }) => {
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
}));
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: ({ onPrimaryAction }: { onPrimaryAction: () => void }) => {
    const { Pressable, Text } = require("react-native");

    return (
      <Pressable testID="recommendations-retry" onPress={onPrimaryAction}>
        <Text>Retry</Text>
      </Pressable>
    );
  },
}));

function createBusiness(id: number, name: string): ExploreBusiness {
  return {
    id,
    business_name: name,
    cover_photo_url: null,
    is_pocketed: false,
    cluster: { id: 1, name: "Culinary", icon: "utensils" },
    category: { id: 8, name: "Cafe" },
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

function createImpressions() {
  return {
    onViewportLayout: jest.fn(),
    onSectionLayout: jest.fn(),
    onListLayout: jest.fn(),
    onVerticalScroll: jest.fn(),
    onHorizontalScroll: jest.fn(),
    onCardLayout: jest.fn(),
    retainBusinesses: jest.fn(),
  };
}

async function renderSection() {
  return render(
    <InterestsSection
      impressions={createImpressions()}
      userLocation={null}
      onBusinessPress={jest.fn()}
    />,
  );
}

describe("Based on Your Interests", () => {
  it("reuses BusinessCard and preserves backend order", async () => {
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [
        createBusiness(22, "Backend First"),
        createBusiness(4, "Backend Second"),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await renderSection();
    const cards = screen.getAllByTestId(/shared-business-card-/);

    expect(screen.getByText("Based on Your Interests")).toBeTruthy();
    expect(screen.getByText("Places matched to what you enjoy.")).toBeTruthy();
    expect(cards.map((card) => card.props.testID)).toEqual([
      "shared-business-card-22",
      "shared-business-card-4",
    ]);
    await screen.unmount();
  });

  it("shows loading and successful-empty states independently", async () => {
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    const loading = await renderSection();
    expect(loading.getByTestId("recommendations-loading")).toBeTruthy();
    await loading.unmount();

    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const empty = await renderSection();
    expect(empty.getByTestId("recommendations-empty")).toBeTruthy();
    expect(empty.getByText("No matching places yet.")).toBeTruthy();
    expect(empty.queryByText("Retry")).toBeNull();
    await empty.unmount();
  });

  it("uses persistent retry and avoids duplicate Toast after global handling", async () => {
    const refetch = jest.fn();
    (handleSystemError as jest.Mock).mockReturnValue(true);
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: {
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      },
      refetch,
    });

    const screen = await renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-error")).toBeTruthy();
    });
    await fireEvent.press(screen.getByTestId("recommendations-retry"));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(handleSystemError).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
