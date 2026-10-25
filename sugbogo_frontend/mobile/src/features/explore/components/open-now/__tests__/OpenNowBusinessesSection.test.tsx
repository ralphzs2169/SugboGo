import { fireEvent, render } from "@testing-library/react-native";
import type { LocationObject } from "expo-location";

import type useOpenNowBusinesses from "../../../hooks/useOpenNowBusinesses";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import OpenNowBusinessesSection from "../OpenNowBusinessesSection";

const mockCarousel = jest.fn();
jest.mock("@/shared/hooks/useApiErrorNotification", () => () => undefined);
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock(
  "@/shared/components/SafePressable",
  () => jest.requireActual("react-native").Pressable,
);
jest.mock("../../ExploreSectionHeader", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockSectionHeader({ title }: { title: string }) {
    return <Text>{title}</Text>;
  };
});
jest.mock("@/shared/components/ErrorState", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockErrorState({
    onPrimaryAction,
  }: {
    onPrimaryAction: () => void;
  }) {
    return <Text onPress={onPrimaryAction}>Retry</Text>;
  };
});
jest.mock("../../business-carousel/ExploreBusinessCarouselSkeleton", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockCarouselSkeleton() {
    return <Text>Loading nearby places</Text>;
  };
});
jest.mock("../../business-carousel/ExploreBusinessCarouselSection", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockCarousel(props: {
    businesses: ExploreBusiness[];
    headerContent: React.ReactNode;
  }) {
    mockCarousel(props);
    return (
      <>
        {props.headerContent}
        <Text>{props.businesses.length} nearby places</Text>
      </>
    );
  };
});

const location = {
  coords: { latitude: 10.33, longitude: 123.9 },
} as LocationObject;
const refetch = jest.fn(async () => undefined);
const feed = {
  businesses: [],
  isLoading: false,
  isFetching: false,
  isPaused: false,
  error: null,
  refetch,
  refreshAtLocation: jest.fn(),
} as unknown as ReturnType<typeof useOpenNowBusinesses>;
const props = {
  feed,
  userLocation: location,
  isLocating: false,
  isUsingLastLocation: false,
  impressions: {} as never,
  onBusinessPress: jest.fn(),
};

it("hides successful empty results and unavailable location", async () => {
  const screen = await render(<OpenNowBusinessesSection {...props} />);
  expect(screen.toJSON()).toBeNull();
  await screen.rerender(
    <OpenNowBusinessesSection {...props} userLocation={null} />,
  );
  expect(screen.toJSON()).toBeNull();
});

it("shows loading while resolving an initial location", async () => {
  const screen = await render(
    <OpenNowBusinessesSection {...props} userLocation={null} isLocating />,
  );
  expect(screen.getByText("Loading nearby places")).toBeTruthy();
});

it.each([{ error: new Error("Offline") }, { isPaused: true }])(
  "offers query recovery instead of hiding a failed request: %s",
  async (failure) => {
    const screen = await render(
      <OpenNowBusinessesSection {...props} feed={{ ...feed, ...failure }} />,
    );
    await fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  },
);

it("shows available places in server order without a See all action", async () => {
  const businesses = [{ id: 42 }, { id: 7 }] as ExploreBusiness[];
  await render(
    <OpenNowBusinessesSection {...props} feed={{ ...feed, businesses }} />,
  );
  const carouselProps = mockCarousel.mock.calls[0][0];

  expect(carouselProps.businesses).toBe(businesses);
  expect(carouselProps.availabilityLabel).toBe("Open now");
  expect(carouselProps.onSeeAll).toBeUndefined();
  expect(carouselProps.onBusinessPress).toBe(props.onBusinessPress);
});

it("labels retained location and removes the open claim after an availability failure", async () => {
  const screen = await render(
    <OpenNowBusinessesSection
      {...props}
      isUsingLastLocation
      feed={{
        ...feed,
        businesses: [{ id: 42 }] as ExploreBusiness[],
        error: new Error("Network"),
      }}
    />,
  );
  expect(
    screen.getByText(/Showing places near your last location/),
  ).toBeTruthy();
  expect(screen.getByText(/Availability may have changed/)).toBeTruthy();
  expect(mockCarousel.mock.calls[0][0].availabilityLabel).toBeUndefined();
  await fireEvent.press(screen.getByLabelText("Retry nearby open places"));
  expect(refetch).toHaveBeenCalledTimes(1);
});
