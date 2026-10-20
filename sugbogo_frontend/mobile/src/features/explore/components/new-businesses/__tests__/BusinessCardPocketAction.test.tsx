import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SafePressable from "@/shared/components/SafePressable";

import { useAuthStore } from "@/features/auth/store/auth.store";
import PocketBusinessCard from "@/features/pockets/components/PocketBusinessCard";
import PocketPickerSheet from "@/features/pockets/components/PocketPickerSheet";
import PocketPickerProvider from "@/features/pockets/providers/PocketPickerProvider";
import type { User } from "@/features/users/types/user.types";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";

import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import BusinessCard from "../BusinessCard";

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
  router: { push: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: jest.fn(() => null),
}));
jest.mock("@/features/pockets/components/PocketPickerSheet", () =>
  jest.fn(() => {
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <View testID="card-pocket-picker" />;
  }),
);

const initialAuth = useAuthStore.getState();
const user: User = {
  id: 1,
  first_name: "Pocket",
  last_name: "Explorer",
  gender: null,
  email: "pocket@example.com",
  role: "explorer",
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};
const business: ExploreBusiness = {
  id: 42,
  business_name: "Card Cafe",
  cover_photo_url: null,
  display_cover_photo_url: null,
  review_count: 0,
  overall_vibe: null,
  is_pocketed: false,
  cluster: { id: 1, name: "Culinary", icon: "utensils" },
  category: { id: 1, name: "Cafe" },
  specialty_tags: [],
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.31,
    longitude: 123.89,
  },
};

describe("Business card Pocket actions", () => {
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
  });
  afterEach(async () => {
    await cleanup();
    useAuthStore.setState(initialAuth);
  });

  describe.each(["default", "compact", "featured"] as const)(
    "%s variant",
    (variant) => {
      it.each([false, true])(
        "keeps the saved=%s bookmark action separate from profile navigation",
        async (isPocketed) => {
          const navigate = jest.fn();
          const openPicker = jest.fn();
          const screen = await render(
            <BusinessCard
              business={{ ...business, is_pocketed: isPocketed }}
              distance={null}
              distanceAccuracy={null}
              variant={variant}
              onPress={navigate}
              onPocketPress={openPicker}
            />,
          );
          const action = screen.getByRole("button", {
            name: isPocketed
              ? "Edit Pocket collections for Card Cafe"
              : "Save Card Cafe to Pockets",
          });
          const background = action.queryAll(
            (node) => node.props.pointerEvents === "none",
          )[0];
          expect(background.props.className).toContain(
            isPocketed ? "bg-brand" : "bg-gray-500",
          );
          expect(MaterialCommunityIcons).toHaveBeenCalledWith(
            expect.objectContaining({
              name: isPocketed ? "bookmark" : "bookmark-outline",
              color: "#FFFFFF",
            }),
            undefined,
          );
          await fireEvent.press(action);
          expect(openPicker).toHaveBeenCalledTimes(1);
          expect(navigate).not.toHaveBeenCalled();
          await fireEvent.press(
            screen.getByRole("button", {
              name: "Open Card Cafe business profile",
            }),
          );
          expect(navigate).toHaveBeenCalledTimes(1);
          expect(openPicker).toHaveBeenCalledTimes(1);
        },
      );
    },
  );

  it("keeps a compact trailing action outside profile navigation and the bookmark", async () => {
    const navigate = jest.fn();
    const remove = jest.fn();
    const picker = jest.fn();
    const screen = await render(
      <BusinessCard
        business={business}
        distance={null}
        distanceAccuracy={null}
        variant="compact"
        onPress={navigate}
        onPocketPress={picker}
        compactTrailingAction={
          <SafePressable
            accessibilityRole="button"
            accessibilityLabel="Remove Card Cafe"
            onPress={remove}
          />
        }
      />,
    );
    const navigation = screen.getByRole("button", {
      name: "Open Card Cafe business profile",
    });
    const action = screen.getByRole("button", { name: "Remove Card Cafe" });
    expect(
      navigation.queryAll(
        (node) => node.props.accessibilityLabel === "Remove Card Cafe",
      ),
    ).toHaveLength(0);
    await fireEvent.press(action);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(picker).not.toHaveBeenCalled();
    await fireEvent.press(navigation);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("disables the bookmark while another picker is open without disabling the card body", async () => {
    const navigate = jest.fn();
    const openPicker = jest.fn();
    const screen = await render(
      <BusinessCard
        business={business}
        distance={null}
        distanceAccuracy={null}
        onPress={navigate}
        onPocketPress={openPicker}
        pocketActionDisabled
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save Card Cafe to Pockets" }),
    );
    expect(openPicker).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Card Cafe business profile" }),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("leaves non-opted-in cards with their existing body action only", async () => {
    const navigate = jest.fn();
    const screen = await render(
      <BusinessCard
        business={{ ...business, is_pocketed: true }}
        distance={null}
        distanceAccuracy={null}
        onPress={navigate}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: /Pocket collections/ }),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Card Cafe business profile" }),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("opens the shared picker for an opted-in card and permits editing an already saved business", async () => {
    const navigate = jest.fn();
    const screen = await render(
      <PocketPickerProvider>
        <PocketBusinessCard
          business={{ ...business, is_pocketed: true }}
          distance={null}
          distanceAccuracy={null}
          onPress={navigate}
        />
      </PocketPickerProvider>,
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Edit Pocket collections for Card Cafe",
      }),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0]).toMatchObject(
      { businessId: 42, ownerId: 1 },
    );
    await act(async () =>
      jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0].onDismiss(),
    );
    expect(screen.queryByTestId("card-pocket-picker")).toBeNull();
  });

  it("sends guests to authentication without opening the picker or navigating to the profile", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    const navigate = jest.fn();
    const screen = await render(
      <PocketPickerProvider>
        <PocketBusinessCard
          business={business}
          distance={null}
          distanceAccuracy={null}
          onPress={navigate}
        />
      </PocketPickerProvider>,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save Card Cafe to Pockets" }),
    );
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
    expect(navigate).not.toHaveBeenCalled();
    expect(PocketPickerSheet).not.toHaveBeenCalled();
  });
});
