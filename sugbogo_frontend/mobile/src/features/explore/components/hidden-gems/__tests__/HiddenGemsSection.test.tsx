import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import HiddenGemsSection from "../HiddenGemsSection";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";

const mockBusinessCard = jest.fn(
  ({
    business,
    onPress,
  }: {
    business: ExploreBusiness;
    onPress: () => void;
  }) => (
    <Pressable testID={`shared-business-card-${business.id}`} onPress={onPress}>
      <Text>{business.business_name}</Text>
    </Pressable>
  ),
);

jest.mock("../../new-businesses/BusinessCard", () => ({
  __esModule: true,
  getBusinessCardWidth: () => 240,
  default: (props: unknown) => mockBusinessCard(props as never),
}));

jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: ({ onPrimaryAction }: { onPrimaryAction: () => void }) => {
    const { Pressable, Text } = require("react-native");

    return (
      <Pressable testID="discovery-retry" onPress={onPrimaryAction}>
        <Text>Retry</Text>
      </Pressable>
    );
  },
}));

function createBusiness(
  id: number,
  name: string,
  latitude: number,
): ExploreBusiness {
  return {
    id,
    business_name: name,
    cover_photo_url: null,
    is_pocketed: false,
    cluster: {
      id: 1,
      name: "Culinary",
      icon: "utensils",
    },
    category: {
      id: 1,
      name: "Cafe",
    },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude,
      longitude: 123.9,
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

describe("HiddenGemsSection", () => {
  beforeEach(() => {
    mockBusinessCard.mockClear();
  });

  it("renders the heading and preserves backend order without distance sorting", async () => {
    const businesses = [
      createBusiness(2, "Backend First But Farther", 12),
      createBusiness(1, "Backend Second But Nearer", 10.31),
    ];
    const onBusinessPress = jest.fn();

    const screen = await render(
      <HiddenGemsSection
        businesses={businesses}
        isLoading={false}
        error={null}
        refetch={jest.fn()}
        impressions={createImpressions()}
        userLocation={{
          coords: {
            latitude: 10.3157,
            longitude: 123.8854,
            altitude: null,
            accuracy: 10,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: 1,
        }}
        onBusinessPress={onBusinessPress}
      />,
    );

    expect(screen.getByText("Hidden Gems")).toBeTruthy();
    expect(
      screen.getByText("Great local places that deserve more discovery."),
    ).toBeTruthy();
    expect(
      mockBusinessCard.mock.calls.map(([props]) => props.business.id),
    ).toEqual([2, 1]);
    expect(mockBusinessCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        business: businesses[0],
        variant: "featured",
      }),
    );

    fireEvent.press(screen.getByTestId("shared-business-card-2"));

    expect(onBusinessPress).toHaveBeenCalledWith(2, expect.any(Number), 10);
  });

  it("shows a section loading state without rendering fetched cards", async () => {
    const screen = await render(
      <HiddenGemsSection
        businesses={[]}
        isLoading
        error={null}
        refetch={jest.fn()}
        impressions={createImpressions()}
        userLocation={null}
        onBusinessPress={jest.fn()}
      />,
    );

    expect(screen.getByText("Hidden Gems")).toBeTruthy();
    expect(screen.queryByTestId("hidden-gems-scroll")).toBeNull();
  });

  it("renders a persistent error with a query retry action", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <HiddenGemsSection
        businesses={[]}
        isLoading={false}
        error={new Error("Unavailable")}
        refetch={refetch}
        impressions={createImpressions()}
        userLocation={null}
        onBusinessPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId("hidden-gems-error")).toBeTruthy();
    fireEvent.press(screen.getByTestId("discovery-retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a compact non-error state after a successful empty response", async () => {
    const screen = await render(
      <HiddenGemsSection
        businesses={[]}
        isLoading={false}
        error={null}
        refetch={jest.fn()}
        impressions={createImpressions()}
        userLocation={null}
        onBusinessPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId("hidden-gems-empty")).toBeTruthy();
    expect(screen.getByText("Hidden Gems")).toBeTruthy();
    expect(
      screen.getByText("Great local places that deserve more discovery."),
    ).toBeTruthy();
    expect(screen.getByText("No places to show yet")).toBeTruthy();
    expect(
      screen.getByText("Check back as more local businesses join SugboGo."),
    ).toBeTruthy();
    expect(screen.queryByTestId("discovery-retry")).toBeNull();
    expect(screen.queryByTestId("hidden-gems-scroll")).toBeNull();
  });
});
