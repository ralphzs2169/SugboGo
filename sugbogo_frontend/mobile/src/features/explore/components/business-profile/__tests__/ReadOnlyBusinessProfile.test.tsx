import { act, fireEvent, render } from "@testing-library/react-native";
import { snapshotFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import ReadOnlyBusinessProfile from "../ReadOnlyBusinessProfile";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock(
  "@/shared/components/SafePressable",
  () => jest.requireActual("react-native").Pressable,
);
jest.mock("@/shared/components/SpecialtyTagChip", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockTag({ tag }: { tag: { name: string } }) {
    return <Text>{tag.name}</Text>;
  };
});
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return {
    MaterialCommunityIcons: function MockIcon() {
      return <View testID="profile-placeholder-icon" />;
    },
  };
});
jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  return {
    Image: function MockImage({
      source,
      onError,
    }: {
      source: { uri: string };
      onError: () => void;
    }) {
      return (
        <View
          testID="profile-cover"
          accessibilityLabel={source.uri}
          onError={onError}
        />
      );
    },
  };
});

it("renders long names, descriptions, specialties, contacts and the weekly schedule without live status", async () => {
  const snapshot = snapshotFixture();
  snapshot.business.business_name =
    "A long local business name that should remain readable across multiple lines";
  snapshot.business.description = "Long description. ".repeat(150);
  snapshot.business.specialty_tags = Array.from({ length: 12 }, (_, index) => ({
    ...snapshot.business.specialty_tags[0],
    id: index + 1,
    name: `Specialty ${index + 1}`,
  }));
  const screen = await render(
    <ReadOnlyBusinessProfile
      source="recent"
      snapshot={snapshot}
      refreshing={false}
      onRefresh={jest.fn()}
    />,
  );
  for (const text of [
    snapshot.business.business_name,
    snapshot.business.description,
    "Specialty 12",
    "Operating hours",
    "monday",
    "sunday",
    snapshot.business.contact_number,
  ]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(
    screen.getByText(/Showing previously loaded information/),
  ).toBeTruthy();
  expect(
    screen.getByText(
      new RegExp(
        new Date(snapshot.fetchedAt)
          .toLocaleString()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Open now/i)).toBeNull();
  expect(screen.queryByText("Device copy")).toBeNull();
  expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
  await fireEvent(screen.getByTestId("profile-cover"), "error");
  expect(screen.queryByTestId("profile-cover")).toBeNull();
  expect(
    screen.getAllByTestId("profile-placeholder-icon").length,
  ).toBeGreaterThan(0);
  expect(screen.getByText(snapshot.business.business_name)).toBeTruthy();
});

it("keeps Pocket wording and managed local cover behavior distinct from recent detail", async () => {
  const screen = await render(
    <ReadOnlyBusinessProfile
      source="offline-pocket"
      snapshot={snapshotFixture()}
      localCoverUri="file:///managed-cover.jpg"
      refreshing={false}
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.getByText(/Device copy/)).toBeTruthy();
  expect(
    screen.queryByText(/Showing previously loaded information/),
  ).toBeNull();
  expect(screen.getByTestId("profile-cover").props.accessibilityLabel).toBe(
    "file:///managed-cover.jpg",
  );
});

it("keeps useful information when no cover exists and offers an explicit detail refresh", async () => {
  const snapshot = snapshotFixture();
  snapshot.business.cover_photo_url = null;
  snapshot.business.display_cover_photo_url = null;
  const refresh = jest.fn();
  const screen = await render(
    <ReadOnlyBusinessProfile
      source="recent"
      snapshot={snapshot}
      refreshing={false}
      onRefresh={refresh}
    />,
  );
  expect(screen.queryByTestId("profile-cover")).toBeNull();
  expect(screen.getByText(snapshot.business.business_name)).toBeTruthy();
  await act(async () => {
    screen
      .getByTestId("read-only-business-scroll")
      .props.refreshControl.props.onRefresh();
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});
