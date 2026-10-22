import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { BackHandler } from "react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import BusinessPocketButton from "@/features/explore/components/business-profile/BusinessPocketButton";
import type { ExploreBusiness } from "@/features/explore/types/exploreBusiness.types";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import type {
  ApiResponse,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";
import {
  getBusinessPocketMemberships,
  createPocketCollection,
  getPocketCollections,
  replaceBusinessPocketMemberships,
} from "../../api/pockets.service";
import { businessPocketMembershipsQueryKey } from "../../hooks/pocketQueryKeys";
import type {
  BusinessPocketMemberships,
  PocketCollection,
  PocketCollectionListResponse,
} from "../../types/pockets.types";
import PocketPickerSheet from "../PocketPickerSheet";
import PocketPickerProvider from "../../providers/PocketPickerProvider";
import PocketBusinessCard from "../PocketBusinessCard";

jest.mock("../../api/pockets.service", () => ({
  getBusinessPocketMemberships: jest.fn(),
  getPocketCollections: jest.fn(),
  replaceBusinessPocketMemberships: jest.fn(),
  createPocketCollection: jest.fn(),
}));
jest.mock("@/shared/components/Skeleton", () => () => null);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(() => false),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
  router: { push: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: ({
    name,
    color,
  }: {
    name: string;
    color?: string;
  }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <Text testID={`icon-${name}`} style={{ color }} />;
  },
}));
jest.mock("lottie-react-native", () => () => null);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 24 }),
}));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: (ref: { current: { present: () => void } | null }) =>
    ref.current?.present(),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, FlatList, ScrollView, TextInput } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    BottomSheetModal: React.forwardRef(function MockBottomSheetModal(
      {
        children,
        onDismiss,
        onChange,
        enablePanDownToClose,
        footerComponent: Footer,
      }: {
        children: React.ReactNode;
        onDismiss: () => void;
        onChange: (index: number) => void;
        enablePanDownToClose: boolean;
        footerComponent?: React.ComponentType;
      },
      ref,
    ) {
      React.useImperativeHandle(
        ref,
        () => ({ present: () => onChange(0), dismiss: onDismiss }),
        [onChange, onDismiss],
      );
      return (
        <View
          testID="picker-modal"
          accessibilityState={{ busy: !enablePanDownToClose }}
        >
          {children}
          {Footer && <Footer />}
        </View>
      );
    }),
    BottomSheetFlatList: FlatList,
    BottomSheetScrollView: ScrollView,
    BottomSheetTextInput: TextInput,
    BottomSheetBackdrop: () => null,
    BottomSheetFooter: View,
  };
});

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
const failure = {
  success: false as const,
  code: "VALIDATION_ERROR",
  message: "One or more Pockets could not be found.",
};
const membership = (ids: number[]): ApiResponse<BusinessPocketMemberships> => ({
  success: true,
  message: "Success.",
  data: { business_id: 42, pocket_ids: ids, is_pocketed: ids.length > 0 },
});
function page(
  ids = [20],
  number = 1,
  hasNext = false,
): ApiSuccessWithData<PocketCollectionListResponse> {
  return {
    success: true,
    message: "Success.",
    data: {
      items: ids.map((id) => ({
        id,
        name: id === 20 ? "Favorites" : `Pocket ${id}`,
        is_default: id === 20,
        business_count: 0,
        created_at: "2026-10-20T01:00:00Z",
        updated_at: "2026-10-20T01:00:00Z",
      })),
      pagination: {
        page: number,
        page_size: 1,
        total_items: hasNext ? 2 : ids.length,
        total_pages: hasNext ? 2 : ids.length ? number : 0,
        has_next: hasNext,
        has_previous: number > 1,
      },
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const cardBusiness: ExploreBusiness = {
  id: 42,
  business_name: "Card Cafe",
  is_pocketed: false,
  cover_photo_url: null,
  display_cover_photo_url: null,
  review_count: 0,
  overall_vibe: null,
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

function BusinessBookmark({ card = false }: { card?: boolean }) {
  const { data } = useQuery({
    queryKey: ["explore-business-detail", 42],
    queryFn: async () => ({ id: 42, is_pocketed: true }),
    enabled: false,
  });
  if (card) {
    return (
      <PocketBusinessCard
        business={{ ...cardBusiness, is_pocketed: data?.is_pocketed ?? false }}
        distance={null}
        distanceAccuracy={null}
        onPress={jest.fn()}
      />
    );
  }
  return (
    <BusinessPocketButton
      businessId={42}
      isPocketed={data?.is_pocketed ?? false}
    />
  );
}

describe("PocketPickerSheet", () => {
  let client: QueryClient;
  let serverIds: number[];
  const dismissed = jest.fn();
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    serverIds = [20, 999];
    jest
      .mocked(createPocketCollection)
      .mockReset()
      .mockResolvedValue({
        success: true,
        message: "Created.",
        data: { ...page([55]).data!.items[0], name: "Coffee spots" },
      });
    jest
      .mocked(getPocketCollections)
      .mockReset()
      .mockResolvedValue(page([20], 1, true));
    jest
      .mocked(getBusinessPocketMemberships)
      .mockReset()
      .mockImplementation(async () => membership(serverIds));
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReset()
      .mockImplementation(async (_id, ids) => {
        serverIds = [...ids];
        return membership(ids);
      });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState(initialAuth);
    jest.restoreAllMocks();
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  async function sheet(isCurrent?: () => boolean) {
    const screen = await render(
      <PocketPickerSheet
        businessId={42}
        ownerId={1}
        generation={getAuthSessionGeneration()}
        onDismiss={dismissed}
        isCurrent={isCurrent}
      />,
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Favorites" })).toBeTruthy(),
    );
    return screen;
  }

  it("blocks submission from an already-open workflow after its authority is revoked", async () => {
    let allowed = true;
    const screen = await sheet(() => allowed);
    allowed = false;
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
    expect(createPocketCollection).not.toHaveBeenCalled();
  });

  it("waits for a fresh complete selection before enabling Done, even with cached data", async () => {
    const pending = deferred<ApiResponse<BusinessPocketMemberships>>();
    client.setQueryData(businessPocketMembershipsQueryKey(1, 42), {
      business_id: 42,
      pocket_ids: [],
      is_pocketed: false,
    });
    jest
      .mocked(getBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise);
    const screen = await render(
      <PocketPickerSheet
        businessId={42}
        ownerId={1}
        generation={getAuthSessionGeneration()}
        onDismiss={dismissed}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByTestId("pocket-picker-loading")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await act(async () => pending.resolve(membership([20, 999])));
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Favorites" }).props
          .accessibilityState.checked,
      ).toBe(true),
    );
  }, 15000);

  it("retains off-page IDs and local edits through pagination, and writes the whole set only on Done", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20], 1, true))
      .mockResolvedValueOnce(page([30], 2));
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Load more Pockets" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Pocket 30" })).toBeTruthy(),
    );
    expect(
      screen.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(false);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Pocket 30" }));
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(dismissed).toHaveBeenCalledTimes(1));
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(
      42,
      [30, 999],
    );
  });

  it("submits an empty set to remove all memberships", async () => {
    serverIds = [20];
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(dismissed).toHaveBeenCalled());
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, []);
  });

  it.each(["Cancel", "Android Back"])(
    "discards draft edits using %s without submitting",
    async (action) => {
      const back = jest.spyOn(BackHandler, "addEventListener");
      const screen = await sheet();
      await fireEvent.press(
        screen.getByRole("checkbox", { name: "Favorites" }),
      );
      if (action === "Cancel")
        await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      else
        await act(async () => {
          expect(
            back.mock.calls.at(-1)?.[1]({
              type: "hardwareBackPress",
              timeStamp: Date.now(),
            }),
          ).toBe(true);
        });
      expect(dismissed).toHaveBeenCalledTimes(1);
      expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
      expect(serverIds).toEqual([20, 999]);
    },
  );

  it("recovers from initial membership and collection errors without fabricating choices", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(page());
    jest
      .mocked(getBusinessPocketMemberships)
      .mockResolvedValueOnce(failure)
      .mockImplementation(async () => membership(serverIds));
    const screen = await render(
      <PocketPickerSheet
        businessId={42}
        ownerId={1}
        generation={getAuthSessionGeneration()}
        onDismiss={dismissed}
      />,
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy(),
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    await fireEvent.press(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Favorites" })).toBeTruthy(),
    );
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
  });

  it("retains selections after a failed page and explicitly retries that page", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20], 1, true))
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(page([30], 2));
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Load more Pockets" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy(),
    );
    expect(
      screen.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Pocket 30" })).toBeTruthy(),
    );
    expect(getPocketCollections).toHaveBeenNthCalledWith(3, 2);
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(dismissed).toHaveBeenCalled());
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, [999]);
  });

  it("keeps failed saves open with their draft and permits a successful retry", async () => {
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockResolvedValueOnce(failure);
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(dismissed).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "info" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(dismissed).toHaveBeenCalledTimes(1));
  });

  it("blocks duplicate Done presses, Cancel, and Android Back while saving", async () => {
    const pending = deferred<ApiResponse<BusinessPocketMemberships>>();
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise);
    const back = jest.spyOn(BackHandler, "addEventListener");
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {
      expect(
        back.mock.calls.at(-1)?.[1]({
          type: "hardwareBackPress",
          timeStamp: Date.now(),
        }),
      ).toBe(true);
    });
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1);
    expect(dismissed).not.toHaveBeenCalled();
    await act(async () => pending.resolve(membership(serverIds)));
    await waitFor(() => expect(dismissed).toHaveBeenCalledTimes(1));
  });

  it("does not report success after unmounting into another account", async () => {
    const pending = deferred<ApiResponse<BusinessPocketMemberships>>();
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise);
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await screen.unmount();
    await act(async () => {
      useAuthStore.setState({ user: { ...user, id: 2 } });
      pending.resolve(membership([20]));
    });
    expect(dismissed).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "info" }),
    );
  });

  it("handles an empty response without inventing Favorites and permits creation", async () => {
    serverIds = [];
    jest.mocked(getPocketCollections).mockResolvedValue(page([]));
    const screen = await render(
      <PocketPickerSheet
        businessId={42}
        ownerId={1}
        generation={getAuthSessionGeneration()}
        onDismiss={dismissed}
      />,
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(screen.getByText("No Pockets yet")).toBeTruthy(),
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Create Pocket" })).toBeTruthy();
  });

  async function openCreation() {
    const screen = await sheet();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      "Coffee spots",
    );
    return screen;
  }

  it("checks a new off-page Pocket while preserving the full draft until Done", async () => {
    const screen = await openCreation();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Coffee spots" }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("checkbox", { name: "Coffee spots" }).props
        .accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(false);
    expect(createPocketCollection).toHaveBeenCalledWith("Coffee spots");
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(
        42,
        [55, 999],
      ),
    );
  });

  it("keeps the newly created collection when the picker draft is canceled", async () => {
    const screen = await openCreation();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Coffee spots" }),
      ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(createPocketCollection).toHaveBeenCalledTimes(1);
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it("retains input and the selection after creation errors or form cancellation", async () => {
    jest.mocked(createPocketCollection).mockResolvedValueOnce({
      ...failure,
      errors: { name: ["A Pocket with this name already exists."] },
    });
    const screen = await openCreation();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("A Pocket with this name already exists."),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText("Pocket name").props.value).toBe(
      "Coffee spots",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(false);
    expect(dismissed).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, [999]),
    );
  });

  it("blocks duplicate creation and dismissal while its POST is pending", async () => {
    const pending = deferred<ApiResponse<PocketCollection>>();
    jest.mocked(createPocketCollection).mockReturnValueOnce(pending.promise);
    const back = jest.spyOn(BackHandler, "addEventListener");
    const screen = await openCreation();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {
      back.mock.calls.at(-1)?.[1]({
        type: "hardwareBackPress",
        timeStamp: Date.now(),
      });
    });
    expect(
      screen.getByTestId("picker-modal").props.accessibilityState.busy,
    ).toBe(true);
    expect(createPocketCollection).toHaveBeenCalledTimes(1);
    expect(dismissed).not.toHaveBeenCalled();
    await act(async () =>
      pending.resolve({
        success: true,
        message: "Created.",
        data: { ...page([55]).data!.items[0], name: "Coffee spots" },
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Coffee spots" }),
      ).toBeTruthy(),
    );
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
  });
  it("reopens with the authoritative saved selection and exposes available counts", async () => {
    const first = await sheet();
    expect(
      first.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityValue.text,
    ).toBe("0 available businesses");
    await fireEvent.press(first.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(first.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(dismissed).toHaveBeenCalledTimes(1));
    await first.unmount();
    const reopened = await sheet();
    expect(
      reopened.getByRole("checkbox", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(false);
    expect(reopened.getByText("1 selected")).toBeTruthy();
    await fireEvent.press(reopened.getByRole("button", { name: "Cancel" }));
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(getBusinessPocketMemberships).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("integrates bookmark, one global picker, Done, saved-state update, and reopening", async () => {
    serverIds = [20];
    client.setQueryData(["explore-business-detail", 42], {
      id: 42,
      is_pocketed: true,
    });
    const screen = await render(
      <PocketPickerProvider>
        <BusinessBookmark />
      </PocketPickerProvider>,
      { wrapper: Wrapper },
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit Pocket collections" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit Pocket collections" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Favorites" })).toBeTruthy(),
    );
    expect(screen.getAllByTestId("pocket-picker-list")).toHaveLength(1);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Favorites" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.queryByTestId("pocket-picker-list")).toBeNull(),
    );
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, []);
    await fireEvent.press(
      screen.getByRole("button", { name: "Save business to Pockets" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Favorites" }).props
          .accessibilityState.checked,
      ).toBe(false),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("pocket-picker-list")).toBeNull();
  });

  it.each([false, true])(
    "keeps the card gray for draft edits and Cancel, and updates only after a successful save (failure=%s)",
    async (failure) => {
      serverIds = [];
      client.setQueryData(["explore-business-detail", 42], {
        id: 42,
        is_pocketed: false,
      });
      const result = deferred<ApiResponse<BusinessPocketMemberships>>();
      jest
        .mocked(replaceBusinessPocketMemberships)
        .mockReturnValueOnce(result.promise);
      const screen = await render(
        <PocketPickerProvider>
          <BusinessBookmark card />
        </PocketPickerProvider>,
        { wrapper: Wrapper },
      );
      const expectGray = () =>
        expect(
          screen
            .getByRole("button", { name: "Save Card Cafe to Pockets" })
            .queryAll((node) => node.props.pointerEvents === "none")[0].props
            .className,
        ).toContain("bg-gray-500");
      const open = async () => {
        await fireEvent.press(
          screen.getByRole("button", { name: "Save Card Cafe to Pockets" }),
        );
        await waitFor(() =>
          expect(
            screen.getByRole("checkbox", { name: "Favorites" }),
          ).toBeTruthy(),
        );
        await fireEvent.press(
          screen.getByRole("checkbox", { name: "Favorites" }),
        );
      };
      await open();
      expectGray();
      await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      expectGray();
      expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
      await open();
      await fireEvent.press(
        screen.getByRole("button", { name: "Save changes" }),
      );
      expectGray();
      await act(async () =>
        result.resolve(
          failure
            ? {
                success: false,
                code: "server_error",
                message: "Please try again.",
              }
            : membership([20]),
        ),
      );
      if (failure) {
        await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
        expectGray();
        await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      } else {
        await waitFor(() =>
          expect(screen.queryByTestId("pocket-picker-list")).toBeNull(),
        );
        expect(
          screen
            .getByRole("button", {
              name: "Edit Pocket collections for Card Cafe",
            })
            .queryAll((node) => node.props.pointerEvents === "none")[0].props
            .className,
        ).toContain("bg-brand");
      }
      expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1);
      expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, [20]);
    },
  );

  it.each([false, true])(
    "updates the profile icon only after confirmed saving, preserving draft, Cancel and failure appearance (failure=%s)",
    async (failure) => {
      serverIds = [];
      client.setQueryData(["explore-business-detail", 42], {
        id: 42,
        is_pocketed: false,
      });
      const result = deferred<ApiResponse<BusinessPocketMemberships>>();
      jest
        .mocked(replaceBusinessPocketMemberships)
        .mockReturnValueOnce(result.promise);
      const screen = await render(
        <PocketPickerProvider>
          <BusinessBookmark />
        </PocketPickerProvider>,
        { wrapper: Wrapper },
      );
      const expectUnsaved = () =>
        expect(
          screen.getByTestId("icon-bookmark-outline").props.style.color,
        ).toBeUndefined();
      const open = async () => {
        await fireEvent.press(
          screen.getByRole("button", { name: "Save business to Pockets" }),
        );
        await waitFor(() =>
          expect(
            screen.getByRole("checkbox", { name: "Favorites" }),
          ).toBeTruthy(),
        );
        expectUnsaved();
        await fireEvent.press(
          screen.getByRole("checkbox", { name: "Favorites" }),
        );
        expectUnsaved();
      };
      await open();
      await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      expectUnsaved();
      expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
      await open();
      await fireEvent.press(
        screen.getByRole("button", { name: "Save changes" }),
      );
      expectUnsaved();
      await act(async () =>
        result.resolve(
          failure
            ? {
                success: false,
                code: "server_error",
                message: "Please try again.",
              }
            : membership([20]),
        ),
      );
      if (failure) {
        await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
        expectUnsaved();
      } else {
        await waitFor(() =>
          expect(screen.queryByTestId("pocket-picker-list")).toBeNull(),
        );
        expect(screen.getByTestId("icon-bookmark").props.style.color).toBe(
          "#F27F0D",
        );
        // Removing the final membership restores the original outline and color.
        serverIds = [20];
        await fireEvent.press(
          screen.getByRole("button", { name: "Edit Pocket collections" }),
        );
        await waitFor(() =>
          expect(
            screen.getByRole("checkbox", { name: "Favorites" }).props
              .accessibilityState.checked,
          ).toBe(true),
        );
        await fireEvent.press(
          screen.getByRole("checkbox", { name: "Favorites" }),
        );
        expect(screen.getByTestId("icon-bookmark").props.style.color).toBe(
          "#F27F0D",
        );
        await fireEvent.press(
          screen.getByRole("button", { name: "Save changes" }),
        );
        await waitFor(() =>
          expect(screen.queryByTestId("pocket-picker-list")).toBeNull(),
        );
        expectUnsaved();
        expect(replaceBusinessPocketMemberships).toHaveBeenLastCalledWith(
          42,
          [],
        );
      }
    },
  );
});
