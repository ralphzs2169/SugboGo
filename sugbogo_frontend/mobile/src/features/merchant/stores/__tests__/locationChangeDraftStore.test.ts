import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";
import { useLocationChangeDraftStore } from "../locationChangeDraftStore";

const business = {
  id: 7,
  location: {
    latitude: 10.31,
    longitude: 123.88,
    address: "Live flat address",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    landmarks: [
      {
        id: 1,
        name: "Live landmark",
        address: "Nearby",
        latitude: 10.32,
        longitude: 123.89,
        source: "custom",
        place_id: null,
      },
    ],
  },
} as MerchantBusinessProfileResponse;

describe("Location change draft", () => {
  beforeEach(() => useLocationChangeDraftStore.getState().reset());

  it("resets only proposed landmarks when the pin changes, including a second move", () => {
    const store = useLocationChangeDraftStore.getState();
    store.initialize(business);
    expect(useLocationChangeDraftStore.getState().landmarks).toHaveLength(1);

    const first = useLocationChangeDraftStore.getState().location!;
    store.setLocation({ ...first, latitude: 10.33 });
    expect(useLocationChangeDraftStore.getState().landmarks).toEqual([]);
    expect(business.location.landmarks).toHaveLength(1);

    store.setLandmarks([
      {
        id: "new",
        name: "New",
        address: "Nearby",
        latitude: 10.34,
        longitude: 123.9,
        source: "custom",
      },
    ]);
    const second = useLocationChangeDraftStore.getState().location!;
    store.setLocation({ ...second, longitude: 123.9 });
    expect(useLocationChangeDraftStore.getState().landmarks).toEqual([]);
  });

  it("keeps proposed landmarks when only the flat address changes", () => {
    const store = useLocationChangeDraftStore.getState();
    store.initialize(business);
    const location = useLocationChangeDraftStore.getState().location!;
    store.setLocation({ ...location, address: "Edited display address" });

    expect(useLocationChangeDraftStore.getState().landmarks).toHaveLength(1);
    expect(business.location.address).toBe("Live flat address");
  });
  it("refreshes a pristine baseline and preserves a dirty draft across route reinitialization", () => {
    const store = useLocationChangeDraftStore.getState();
    store.initialize(business);
    const newer = {
      ...business,
      location: { ...business.location, address: "New live address" },
    };
    store.initialize(newer);
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "New live address",
    );
    store.setLocation({
      ...useLocationChangeDraftStore.getState().location!,
      address: "My draft",
    });
    store.initialize({
      ...newer,
      location: { ...newer.location, address: "Newest live address" },
    });
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "My draft",
    );
    store.setLocation({
      ...useLocationChangeDraftStore.getState().location!,
      address: " New live address ",
    });
    store.initialize({
      ...newer,
      location: { ...newer.location, address: "Newest live address" },
    });
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "Newest live address",
    );
  });

  it("ignores landmark ordering and display IDs when deciding whether a draft is pristine", () => {
    const store = useLocationChangeDraftStore.getState();
    store.initialize(business);
    store.setLandmarks(
      useLocationChangeDraftStore.getState().landmarks.map((item) => ({
        ...item,
        id: "picker-id",
        name: ` ${item.name} `,
      })),
    );
    store.initialize({
      ...business,
      location: { ...business.location, city: "New city" },
    });
    expect(useLocationChangeDraftStore.getState().location?.city).toBe(
      "New city",
    );
  });
});
