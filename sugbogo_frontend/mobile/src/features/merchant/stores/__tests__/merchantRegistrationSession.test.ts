import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  invalidateAuthSession,
  suspendAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { useMerchantRegistrationStore } from "../merchantRegistrationStore";

const location = {
  latitude: 10.31,
  longitude: 123.88,
  formattedAddress: "Cebu City",
  province: "Cebu",
  city: "Cebu City",
  barangay: "Lahug",
  streetAddress: "Gorordo Avenue",
  isWithinServiceArea: true,
};

function seedTemporaryState() {
  useMerchantRegistrationStore.setState({
    selectedLocation: location,
    selectedAddress: { ...location, unit: "Unit 1" },
    selectedLandmarks: [
      {
        id: "custom-1",
        name: "Landmark",
        address: "Cebu",
        latitude: 10.31,
        longitude: 123.88,
        source: "custom",
      },
    ],
    addressLoadFailed: true,
    nearbyLandmarksLoadFailed: true,
  });
}

describe("merchant registration session boundaries", () => {
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    seedTemporaryState();
  });

  it.each([
    ["logout or automatic expiration", invalidateAuthSession],
    ["replacement login", beginAuthSession],
    ["offline session suspension", suspendAuthSession],
  ])("clears private selections on %s", (_label, transition) => {
    transition();

    expect(useMerchantRegistrationStore.getState()).toMatchObject({
      selectedLocation: null,
      selectedAddress: null,
      selectedLandmarks: [],
      addressLoadFailed: false,
      nearbyLandmarksLoadFailed: false,
    });
  });

  it("clears selections when authentication is withdrawn without a generation event", () => {
    useAuthStore.getState().clearUser();
    expect(useMerchantRegistrationStore.getState().selectedLocation).toBeNull();
  });

  it("clears selections when the authenticated owner changes", () => {
    useAuthStore.getState().setUser({ id: 2 } as User);
    expect(useMerchantRegistrationStore.getState().selectedAddress).toBeNull();
    expect(useMerchantRegistrationStore.getState().selectedLandmarks).toEqual(
      [],
    );
  });

  it("preserves same-session selections when the user's profile is refreshed", () => {
    useAuthStore.getState().setUser({ id: 1, first_name: "Updated" } as User);
    expect(useMerchantRegistrationStore.getState().selectedLocation).toEqual(
      location,
    );
    expect(
      useMerchantRegistrationStore.getState().selectedLandmarks,
    ).toHaveLength(1);
  });
});
