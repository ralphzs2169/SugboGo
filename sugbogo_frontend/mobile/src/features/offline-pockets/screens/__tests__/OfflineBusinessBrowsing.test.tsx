import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import useOfflineBusinessSnapshots from "../../hooks/useOfflineBusinessSnapshots";
import { removeUnreadableOfflineBusinessSnapshot } from "../../services/offlinePockets.service";
import { snapshotFixture } from "../../validation/__tests__/snapshotFixture";
import OfflineBusinessDetailScreen from "../OfflineBusinessDetailScreen";
import OfflinePocketLibraryScreen from "../OfflinePocketLibraryScreen";

jest.mock("../../hooks/useOfflineBusinessSnapshots");
jest.mock("../../services/offlinePockets.service", () => ({
  removeUnreadableOfflineBusinessSnapshot: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("expo-image", () => ({
  Image: function LocalOnlyImage({
    source,
    onError,
  }: {
    source: { uri: string };
    onError: () => void;
  }) {
    if (!source.uri.startsWith("file://"))
      throw new Error("Remote image in offline browsing");
    const { View } = jest.requireActual("react-native");
    return (
      <View
        testID="offline-cover-image"
        accessibilityLabel={source.uri}
        onError={onError}
      />
    );
  },
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const MockConfirmModal = ({
    visible,
    onConfirm,
  }: {
    visible: boolean;
    onConfirm: () => void;
  }) =>
    visible ? (
      <Pressable onPress={onConfirm}>
        <Text>Confirm removal</Text>
      </Pressable>
    ) : null;
  return MockConfirmModal;
});

const context = {
  apiScope: "api",
  ownerId: 7,
  sessionGeneration: 1,
  clearGeneration: 0,
  access: "local" as const,
};
const refetch = jest.fn();
const snapshot = snapshotFixture(21, "2020-01-01T00:00:00.000Z");
const available = { businessId: 21, status: "available", snapshot };
/** Walks host children only; FlatList props can retain circular React owner objects. */
function containsImage(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(containsImage);
  if (node === null || typeof node !== "object") return false;
  if ("type" in node && /Image/.test(String(node.type))) return true;
  return (
    "children" in node &&
    Array.isArray(node.children) &&
    node.children.some(containsImage)
  );
}
function state(overrides = {}) {
  return {
    ownerId: 7,
    isPending: false,
    isError: false,
    refetch,
    data: { context, entries: [available] },
    ...overrides,
  };
}

describe("local business browsing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(state() as never);
    jest
      .mocked(removeUnreadableOfflineBusinessSnapshot)
      .mockResolvedValue(undefined);
  });

  it("lists cached identity and location and opens the local detail route", async () => {
    const view = await render(<OfflinePocketLibraryScreen />);
    expect(view.getByText("Sugbo Cafe")).toBeTruthy();
    expect(view.getByText("Cebu street")).toBeTruthy();
    const card = view.getByRole("button", {
      name: "View saved business Sugbo Cafe",
    });
    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/offline-business/[businessId]",
      params: { businessId: "21" },
    });
    expect(containsImage(view.toJSON())).toBe(false);
    await fireEvent.press(
      view.getByRole("button", { name: "Back to Offline Data" }),
    );
    expect(router.dismissTo).toHaveBeenCalledWith("/offline-routes");
  });

  it("renders stale but valid profile data without live actions or images", async () => {
    const view = await render(<OfflineBusinessDetailScreen businessId={21} />);
    for (const text of [
      "Sugbo Cafe",
      "Local coffee and pastries.",
      "Coffee",
      "Operating hours",
      "09123456789",
      "hello@example.com",
      "https://example.com",
    ])
      expect(view.getByText(text)).toBeTruthy();
    expect(view.getByText(/2020/)).toBeTruthy();
    expect(containsImage(view.toJSON())).toBe(false);
    expect(view.queryByText("Vouch")).toBeNull();
    expect(view.queryByText("Write a review")).toBeNull();
    expect(view.getAllByRole("button")).toHaveLength(1);
    await fireEvent.press(
      view.getByRole("button", { name: "Back to saved businesses" }),
    );
    expect(router.dismissTo).toHaveBeenCalledWith("/offline-pockets");
  });

  it("uses managed local cover URIs in cards and details, and falls back after image failure", async () => {
    const uri = "file:///documents/offline-pocket-covers/scope/7/cover.img";
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
      state({
        data: { context, entries: [available], covers: { 21: uri } },
      }) as never,
    );
    const view = await render(<OfflinePocketLibraryScreen />);
    expect(
      view.getByTestId("offline-cover-image").props.accessibilityLabel,
    ).toBe(uri);
    await view.rerender(<OfflineBusinessDetailScreen businessId={21} />);
    expect(
      view.getByTestId("offline-cover-image").props.accessibilityLabel,
    ).toBe(uri);
    await fireEvent(view.getByTestId("offline-cover-image"), "error");
    expect(view.queryByTestId("offline-cover-image")).toBeNull();
    expect(view.getByText("Sugbo Cafe")).toBeTruthy();
  });

  it("rejects a remote URI supplied as a local cover without falling back to snapshot photos", async () => {
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
      state({
        data: {
          context,
          entries: [available],
          covers: { 21: "https://example.com/untrusted.jpg" },
        },
      }) as never,
    );
    const view = await render(<OfflineBusinessDetailScreen businessId={21} />);
    expect(view.queryByTestId("offline-cover-image")).toBeNull();
    expect(view.getByText("Sugbo Cafe")).toBeTruthy();
  });

  it("keeps long business names and descriptions readable in details", async () => {
    const long = snapshotFixture();
    long.business.business_name =
      "A very long neighborhood business name ".repeat(5);
    long.business.description =
      "A thoughtful description of this local business. ".repeat(100);
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
      state({
        data: { context, entries: [{ ...available, snapshot: long }] },
      }) as never,
    );
    const view = await render(<OfflineBusinessDetailScreen businessId={21} />);
    expect(
      view.getByText(long.business.business_name).props.numberOfLines,
    ).toBeUndefined();
    expect(
      view.getByText(long.business.description).props.numberOfLines,
    ).toBeUndefined();
  });

  it.each(["corrupt", "unsupported"])(
    "offers confirmed, scoped cleanup for %s data without rendering raw payloads",
    async (status) => {
      jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
        state({
          data: {
            context,
            entries: [{ businessId: 21, status, snapshot: null }],
          },
        }) as never,
      );
      const view = await render(
        <OfflineBusinessDetailScreen businessId={21} />,
      );
      expect(view.queryByText("Sugbo Cafe")).toBeNull();
      await fireEvent.press(view.getByText("Remove device copy"));
      expect(removeUnreadableOfflineBusinessSnapshot).not.toHaveBeenCalled();
      await act(async () => fireEvent.press(view.getByText("Confirm removal")));
      expect(removeUnreadableOfflineBusinessSnapshot).toHaveBeenCalledWith(
        context,
        21,
      );
    },
  );

  it("shows a missing snapshot without offering deletion", async () => {
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
      state({
        data: {
          context,
          entries: [{ businessId: 21, status: "missing", snapshot: null }],
        },
      }) as never,
    );
    const view = await render(<OfflineBusinessDetailScreen businessId={21} />);
    expect(view.getByText("Business unavailable offline")).toBeTruthy();
    expect(view.queryByText("Remove device copy")).toBeNull();
  });

  it("dismisses stale cleanup confirmation after the resource or clearing generation changes", async () => {
    const unreadable = { businessId: 21, status: "corrupt", snapshot: null };
    jest
      .mocked(useOfflineBusinessSnapshots)
      .mockReturnValue(
        state({ data: { context, entries: [unreadable] } }) as never,
      );
    const view = await render(<OfflineBusinessDetailScreen businessId={21} />);
    await fireEvent.press(view.getByText("Remove device copy"));
    expect(view.getByText("Confirm removal")).toBeTruthy();
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
      state({
        data: { context, entries: [{ ...unreadable, businessId: 22 }] },
      }) as never,
    );
    await view.rerender(<OfflineBusinessDetailScreen businessId={22} />);
    expect(view.queryByText("Confirm removal")).toBeNull();
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue(
      state({
        data: {
          context: { ...context, clearGeneration: 1 },
          entries: [unreadable],
        },
      }) as never,
    );
    await view.rerender(<OfflineBusinessDetailScreen businessId={21} />);
    expect(view.queryByText("Confirm removal")).toBeNull();
    expect(removeUnreadableOfflineBusinessSnapshot).not.toHaveBeenCalled();
  });

  it("distinguishes empty, storage failure, loading, and revoked access", async () => {
    jest
      .mocked(useOfflineBusinessSnapshots)
      .mockReturnValue(state({ data: { context, entries: [] } }) as never);
    const view = await render(<OfflinePocketLibraryScreen />);
    expect(view.getByText("No saved businesses yet")).toBeTruthy();
    jest
      .mocked(useOfflineBusinessSnapshots)
      .mockReturnValue(state({ isError: true }) as never);
    await view.rerender(<OfflinePocketLibraryScreen />);
    expect(view.queryByText("No saved businesses yet")).toBeNull();
    await fireEvent.press(view.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
    jest
      .mocked(useOfflineBusinessSnapshots)
      .mockReturnValue(state({ isPending: true }) as never);
    await view.rerender(<OfflinePocketLibraryScreen />);
    expect(view.queryByText("Sugbo Cafe")).toBeNull();
    jest
      .mocked(useOfflineBusinessSnapshots)
      .mockReturnValue(state({ ownerId: null }) as never);
    await view.rerender(<OfflinePocketLibraryScreen />);
    expect(view.queryByText("Sugbo Cafe")).toBeNull();
    expect(view.getByText("Sign in to access saved businesses")).toBeTruthy();
  });
});
