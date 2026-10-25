import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuthStore } from "@/features/auth/store/auth.store";
import PocketPickerSheet from "@/features/pockets/components/PocketPickerSheet";
import PocketPickerProvider from "@/features/pockets/providers/PocketPickerProvider";
import type { User } from "@/features/users/types/user.types";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";

import useBusinessPocket from "../../../hooks/useBusinessPocket";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import BusinessPocketButton from "../BusinessPocketButton";
import BusinessProfileStickyHeader from "../BusinessProfileStickyHeader";
import ExploreBusinessHero from "../ExploreBusinessHero";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: jest.fn(() => null),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));
jest.mock("../../../hooks/useBusinessPocket", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@/features/pockets/components/PocketPickerSheet", () =>
  jest.fn(() => {
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <View testID="profile-pocket-picker" />;
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
  business_name: "Profile Cafe",
  cover_photo_url: null,
  display_cover_photo_url: null,
  review_count: 0,
  overall_vibe: null,
  is_pocketed: true,
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

describe("Business Profile Pocket controls", () => {
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
  });
  afterEach(async () => {
    await cleanup();
    useAuthStore.setState(initialAuth);
  });

  it.each([false, true])(
    "preserves the white circle and colors only the filled saved icon (saved=%s)",
    async (saved) => {
      const screen = await render(
        <PocketPickerProvider>
          <BusinessPocketButton businessId={42} isPocketed={saved} />
        </PocketPickerProvider>,
      );
      const button = screen.getByRole("button", {
        name: saved ? "Edit Pocket collections" : "Save business to Pockets",
      });
      expect(button.props.className).toContain("bg-white/95");
      expect(
        button.queryAll(
          (node) =>
            node.props.className ===
            "absolute h-10 w-10 rounded-full bg-white/95",
        ),
      ).toHaveLength(1);
      expect(MaterialCommunityIcons).toHaveBeenCalledWith(
        expect.objectContaining({
          name: saved ? "bookmark" : "bookmark-outline",
          size: 22,
          color: saved ? "#F27F0D" : undefined,
        }),
        undefined,
      );
    },
  );

  it("opens one picker for the same business from the existing hero and sticky placements", async () => {
    const screen = await render(
      <PocketPickerProvider>
        <ExploreBusinessHero
          business={business}
          isOwnBusiness={false}
          onShare={jest.fn()}
          onGoBack={jest.fn()}
        />
        <BusinessProfileStickyHeader
          businessId={business.id}
          isPocketed
          businessName={business.business_name}
          coverPhotoUrl={null}
          clusterIconName="store"
          clusterName="Culinary"
          categoryName="Cafe"
          isOwnBusiness={false}
          navOpacity={new Animated.Value(1)}
          navigationVisible
          identityVisible
          identityOpacity={new Animated.Value(1)}
          translateY={new Animated.Value(0)}
          onShare={jest.fn()}
          onGoBack={jest.fn()}
        />
      </PocketPickerProvider>,
    );
    let buttons = screen.getAllByRole("button", {
      name: "Edit Pocket collections",
    });
    expect(buttons).toHaveLength(2);
    await fireEvent.press(buttons[0]);
    expect(screen.getAllByTestId("profile-pocket-picker")).toHaveLength(1);
    expect(jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0]).toMatchObject(
      { businessId: 42, ownerId: 1 },
    );
    await fireEvent.press(buttons[1]);
    expect(screen.getAllByTestId("profile-pocket-picker")).toHaveLength(1);
    const first = jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0];
    await act(async () => first?.onDismiss());
    buttons = screen.getAllByRole("button", {
      name: "Edit Pocket collections",
    });
    await fireEvent.press(buttons[1]);
    expect(
      jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0].businessId,
    ).toBe(42);
    // Opening or cancelling a saved business never invokes the legacy toggle.
    expect(useBusinessPocket).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens unsaved businesses without changing the displayed saved state", async () => {
    const screen = await render(
      <PocketPickerProvider>
        <BusinessPocketButton businessId={7} isPocketed={false} />
      </PocketPickerProvider>,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save business to Pockets" }),
    );
    expect(
      jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0].businessId,
    ).toBe(7);
    expect(
      screen.getByRole("button", { name: "Save business to Pockets" }),
    ).toBeTruthy();
    expect(useBusinessPocket).not.toHaveBeenCalled();
  });

  it("requires authentication before opening and drops the selection on account change", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    const screen = await render(
      <PocketPickerProvider>
        <BusinessPocketButton businessId={42} isPocketed />
      </PocketPickerProvider>,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit Pocket collections" }),
    );
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
    expect(PocketPickerSheet).not.toHaveBeenCalled();
    await act(async () =>
      useAuthStore.setState({ user, isAuthenticated: true }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit Pocket collections" }),
    );
    expect(screen.getByTestId("profile-pocket-picker")).toBeTruthy();
    await act(async () => useAuthStore.setState({ user: { ...user, id: 2 } }));
    expect(screen.queryByTestId("profile-pocket-picker")).toBeNull();
    expect(useBusinessPocket).not.toHaveBeenCalled();
  });
});
