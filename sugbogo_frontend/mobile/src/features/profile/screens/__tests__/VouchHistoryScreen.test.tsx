import React from "react";
import { BackHandler } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import {
  getExploreBusinessDetail,
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "@/features/explore/api/exploreBusiness.service";
import { getVouchHistory } from "../../api/vouchHistory.service";
import {
  businessDetail,
  historyBusiness,
  historyPage,
} from "../../__tests__/vouchHistory.fixtures";
import type { VouchHistoryBusiness } from "../../types/vouchHistory.types";
import VouchHistoryScreen from "../VouchHistoryScreen";

jest.mock("react-native/Libraries/Lists/FlatList", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: React.forwardRef(function MockHistoryList(
      props: {
        data: VouchHistoryBusiness[];
        renderItem: (value: { item: VouchHistoryBusiness }) => React.ReactNode;
        ListHeaderComponent: React.ReactNode;
        ListEmptyComponent: React.ReactNode;
        ListFooterComponent: React.ReactNode;
      },
      ref: React.Ref<unknown>,
    ) {
      const { View } = jest.requireActual("react-native");
      React.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }));
      return (
        <View {...props}>
          {props.ListHeaderComponent}
          {props.data.length
            ? props.data.map((item) => (
                <View key={item.id}>{props.renderItem({ item })}</View>
              ))
            : props.ListEmptyComponent}
          {props.ListFooterComponent}
        </View>
      );
    }),
  };
});

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: 1 } }),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn().mockResolvedValue("installation"),
}));
jest.mock("../../api/vouchHistory.service", () => ({
  getVouchHistory: jest.fn(),
}));
jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
  vouchForBusinessSpecialty: jest.fn(),
  removeBusinessSpecialtyVouch: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("../../assets/businesses-vouched.svg", () => () => null);
jest.mock("../../assets/specialty-vouches.svg", () => () => null);
jest.mock("lottie-react-native", () => () => null);
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: (ref: { current: { present: () => void } | null }) =>
    ref.current?.present(),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetModal: React.forwardRef(function MockBottomSheet(
      {
        children,
        onDismiss,
        onChange,
      }: {
        children: React.ReactNode;
        onDismiss: () => void;
        onChange: (index: number) => void;
      },
      ref: React.Ref<unknown>,
    ) {
      const [open, setOpen] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => {
          setOpen(true);
          onChange(0);
        },
        dismiss: () => {
          setOpen(false);
          onDismiss();
        },
      }));
      return open ? <View testID="manage-vouch-sheet">{children}</View> : null;
    }),
    BottomSheetScrollView: View,
    BottomSheetBackdrop: () => null,
  };
});
jest.mock(
  "@/features/explore/components/business-profile/BusinessSpecialtyVouchCard",
  () => ({
    __esModule: true,
    default: ({
      name,
      onPress,
      isVouched,
      disabled,
      vouchCount,
    }: {
      name: string;
      onPress: () => void;
      isVouched: boolean;
      disabled: boolean;
      vouchCount: number;
    }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Toggle " + name}
          accessibilityState={{ selected: isVouched, disabled }}
          disabled={disabled}
          onPress={onPress}
        >
          <Text>{name + ": " + vouchCount}</Text>
        </Pressable>
      );
    },
  }),
);

describe("production Vouch History screen", () => {
  let client: QueryClient;
  let serverBusiness: VouchHistoryBusiness;
  let serverItems: VouchHistoryBusiness[];
  beforeEach(() => {
    (getVouchHistory as jest.Mock).mockReset();
    (getExploreBusinessDetail as jest.Mock).mockReset();
    (removeBusinessSpecialtyVouch as jest.Mock).mockReset();
    (vouchForBusinessSpecialty as jest.Mock).mockReset();
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: 0 },
      },
    });
    serverBusiness = historyBusiness(1, [1, 2]);
    serverItems = [serverBusiness];
    (getVouchHistory as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: historyPage(serverItems),
    }));
    (getExploreBusinessDetail as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: businessDetail(serverBusiness),
    }));
    (removeBusinessSpecialtyVouch as jest.Mock).mockImplementation(
      async (_businessId, tagId) => {
        serverBusiness = {
          ...serverBusiness,
          specialty_tags: serverBusiness.specialty_tags.map((tag) =>
            tag.id === tagId
              ? {
                  ...tag,
                  is_vouched: false,
                  vouch_count: Math.max(0, tag.vouch_count - 1),
                }
              : tag,
          ),
          vouches: serverBusiness.vouches.filter(
            (vouch) => vouch.specialty.id !== tagId,
          ),
        };
        serverItems = serverBusiness.vouches.length ? [serverBusiness] : [];
        return {
          success: true,
          data: { business_id: 1, tag_id: tagId, is_vouched: false },
        };
      },
    );
    (vouchForBusinessSpecialty as jest.Mock).mockImplementation(
      async (_businessId, tagId) => {
        const tag = serverBusiness.specialty_tags.find(
          (tag) => tag.id === tagId,
        )!;
        // This represents the backend response, not a client-generated production record.
        serverBusiness = {
          ...serverBusiness,
          last_vouched_at: "2026-10-11T02:00:00Z",
          specialty_tags: serverBusiness.specialty_tags.map((tag) =>
            tag.id === tagId
              ? { ...tag, is_vouched: true, vouch_count: tag.vouch_count + 1 }
              : tag,
          ),
          vouches: [
            { id: 900, specialty: tag, created_at: "2026-10-11T02:00:00Z" },
            ...serverBusiness.vouches,
          ],
        };
        serverItems = [serverBusiness];
        return {
          success: true,
          data: { id: 900, business_id: 1, tag_id: tagId, is_vouched: true },
        };
      },
    );
  });
  afterEach(() => client.clear());

  async function renderScreen() {
    return render(
      <QueryClientProvider client={client}>
        <VouchHistoryScreen />
      </QueryClientProvider>,
    );
  }
  async function openManage(screen: Awaited<ReturnType<typeof renderScreen>>) {
    await waitFor(() =>
      expect(
        screen.getByLabelText("Manage vouches for Business 1"),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByLabelText("Manage vouches for Business 1"),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Toggle Specialty 1")).toBeTruthy(),
    );
  }

  it("renders every grouped endorsement and full-history totals", async () => {
    serverItems = [historyBusiness(1, [1, 2, 3, 4])];
    (getVouchHistory as jest.Mock).mockResolvedValue({
      success: true,
      data: historyPage(serverItems, 1, 25, 60),
    });
    const screen = await renderScreen();
    await waitFor(() => expect(screen.getByText("Specialty 4")).toBeTruthy());
    for (const id of [1, 2, 3, 4])
      expect(screen.getByText("Specialty " + id)).toBeTruthy();
    expect(screen.getByTestId("history-business-total").props.children).toBe(
      25,
    );
    expect(screen.getByTestId("history-specialty-total").props.children).toBe(
      60,
    );
  }, 15000);

  it("requests Oldest and Newest as separate server orderings starting at page one", async () => {
    const screen = await renderScreen();
    await waitFor(() => expect(screen.getByText("Business 1")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Sort history by Oldest"));
    await waitFor(() =>
      expect(getVouchHistory).toHaveBeenCalledWith("oldest", 1),
    );
    await fireEvent.press(screen.getByLabelText("Sort history by Newest"));
    await waitFor(() =>
      expect(getVouchHistory).toHaveBeenLastCalledWith("newest", 1),
    );
  });

  it("navigates to the existing business profile using the business ID", async () => {
    const screen = await renderScreen();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Open Business 1 business profile"),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByLabelText("Open Business 1 business profile"),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "1" },
    });
  });

  it("shows the initial skeleton until history resolves", async () => {
    (getVouchHistory as jest.Mock).mockReturnValue(new Promise(() => {}));
    const screen = await renderScreen();
    expect(screen.getByTestId("vouch-history-loading")).toBeTruthy();
    expect(screen.queryByTestId("vouch-history-empty")).toBeNull();
  });

  it("renders a successful empty result with zero totals", async () => {
    serverItems = [];
    const screen = await renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId("vouch-history-empty")).toBeTruthy(),
    );
    expect(screen.getByTestId("history-business-total").props.children).toBe(0);
  });

  it("retries initial errors instead of presenting them as empty history", async () => {
    (getVouchHistory as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderScreen();
    await waitFor(() => expect(screen.getByLabelText("Retry")).toBeTruthy());
    expect(screen.queryByTestId("vouch-history-empty")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Retry"));
    await waitFor(() => expect(screen.getByText("Business 1")).toBeTruthy());
  });

  it("pulls to refresh without removing loaded content", async () => {
    const screen = await renderScreen();
    await waitFor(() => expect(screen.getByText("Business 1")).toBeTruthy());
    let resolve!: (value: unknown) => void;
    (getVouchHistory as jest.Mock).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () =>
      screen
        .getByTestId("vouch-history-list")
        .props.refreshControl.props.onRefresh(),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("vouch-history-list").props.refreshControl.props
          .refreshing,
      ).toBe(true),
    );
    expect(screen.getByText("Business 1")).toBeTruthy();
    await act(async () => resolve({ success: true, data: historyPage() }));
    await waitFor(() =>
      expect(
        screen.getByTestId("vouch-history-list").props.refreshControl.props
          .refreshing,
      ).toBe(false),
    );
  });

  it("keeps content after a refresh error and retries the history query", async () => {
    const screen = await renderScreen();
    await waitFor(() => expect(screen.getByText("Business 1")).toBeTruthy());
    (getVouchHistory as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () =>
      screen
        .getByTestId("vouch-history-list")
        .props.refreshControl.props.onRefresh(),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText("Unable to refresh history. Tap to retry."),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Business 1")).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText("Unable to refresh history. Tap to retry."),
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Unable to refresh history. Tap to retry."),
      ).toBeNull(),
    );
  });

  it("guards duplicate next-page events and keeps content through loading, error and retry", async () => {
    (getVouchHistory as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: historyPage([historyBusiness()], 1, 11, 20),
    });
    const screen = await renderScreen();
    await waitFor(() => expect(screen.getByText("Business 1")).toBeTruthy());
    let resolve!: (value: unknown) => void;
    (getVouchHistory as jest.Mock).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => {
      screen.getByTestId("vouch-history-list").props.onEndReached();
      screen.getByTestId("vouch-history-list").props.onEndReached();
    });
    await waitFor(() =>
      expect(screen.getByTestId("vouch-history-page-loader")).toBeTruthy(),
    );
    expect(getVouchHistory).toHaveBeenCalledTimes(2);
    expect(
      screen.getByTestId("vouch-history-list").props.refreshControl.props
        .refreshing,
    ).toBe(false);
    expect(screen.getByText("Business 1")).toBeTruthy();
    await act(async () =>
      resolve({ success: false, code: "NETWORK_ERROR", message: "Offline" }),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText(
          "Unable to load more history. Tap to retry next page.",
        ),
      ).toBeTruthy(),
    );
    (getVouchHistory as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: historyPage([historyBusiness(2)], 2, 11, 20),
    });
    await fireEvent.press(
      screen.getByLabelText(
        "Unable to load more history. Tap to retry next page.",
      ),
    );
    await waitFor(() => expect(screen.getByText("Business 2")).toBeTruthy());
    expect(screen.getByText("Business 1")).toBeTruthy();
    expect(getVouchHistory).toHaveBeenLastCalledWith("newest", 2);
  });

  it("opens Manage Vouch from the kebab action and dismisses explicitly", async () => {
    const screen = await renderScreen();
    await openManage(screen);
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close Manage Vouch"));
    await waitFor(() =>
      expect(screen.queryByTestId("manage-vouch-sheet")).toBeNull(),
    );
  });

  it("keeps the selected identity visible while current reactions are loading", async () => {
    (getExploreBusinessDetail as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );
    const screen = await renderScreen();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Manage vouches for Business 1"),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByLabelText("Manage vouches for Business 1"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("manage-vouch-loading")).toBeTruthy(),
    );
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
    expect(screen.getAllByText("Business 1").length).toBe(2);
    expect(screen.queryByLabelText("Toggle Specialty 1")).toBeNull();
  });

  it("consumes Android back while the sheet is open and removes its listener", async () => {
    const remove = jest.fn();
    const subscription = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove });
    try {
      const screen = await renderScreen();
      await openManage(screen);
      const handler = subscription.mock.calls.find(
        ([event]) => event === "hardwareBackPress",
      )?.[1];
      expect(handler).toBeDefined();
      await act(async () => {
        expect(handler?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(
          true,
        );
      });
      await waitFor(() =>
        expect(screen.queryByTestId("manage-vouch-sheet")).toBeNull(),
      );
      expect(remove).toHaveBeenCalled();
    } finally {
      subscription.mockRestore();
    }
  });

  it("removes one endorsement independently while retaining the business and other endorsement", async () => {
    const screen = await renderScreen();
    await openManage(screen);
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 1"));
    await waitFor(() =>
      expect(screen.getByTestId("history-specialty-total").props.children).toBe(
        1,
      ),
    );
    expect(screen.getByLabelText("Manage vouches for Business 1")).toBeTruthy();
    expect(screen.queryByText("Specialty 1")).toBeNull();
    expect(screen.getByText("Specialty 2")).toBeTruthy();
    expect(
      screen.getByLabelText("Toggle Specialty 2").props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
  });

  it("removes the final history card but retains the sheet and supports re-vouching", async () => {
    serverBusiness = historyBusiness(1, [1]);
    serverItems = [serverBusiness];
    const screen = await renderScreen();
    await openManage(screen);
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 1"));
    await waitFor(() =>
      expect(screen.getByTestId("history-business-total").props.children).toBe(
        0,
      ),
    );
    expect(screen.queryByLabelText("Manage vouches for Business 1")).toBeNull();
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Toggle Specialty 1").props.accessibilityState
          .disabled,
      ).toBe(false),
    );
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 3"));
    await waitFor(() =>
      expect(screen.getByTestId("history-business-total").props.children).toBe(
        1,
      ),
    );
    expect(screen.getByText("Specialty 3")).toBeTruthy();
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
    const data = screen.getByTestId("vouch-history-list").props.data;
    expect(data[0].vouches[0]).toMatchObject({
      id: 900,
      created_at: "2026-10-11T02:00:00Z",
    });
  });

  it("adopts backend order after adding a specialty rather than sorting loaded records locally", async () => {
    serverItems = [historyBusiness(2), serverBusiness];
    const screen = await renderScreen();
    await waitFor(() =>
      expect(
        screen
          .getByTestId("vouch-history-list")
          .props.data.map((item: VouchHistoryBusiness) => item.id),
      ).toEqual([2, 1]),
    );
    await openManage(screen);
    (vouchForBusinessSpecialty as jest.Mock).mockImplementationOnce(
      async () => {
        serverBusiness = historyBusiness(1, [1, 2, 3]);
        serverItems = [serverBusiness, historyBusiness(2)];
        return {
          success: true,
          data: { id: 103, business_id: 1, tag_id: 3, is_vouched: true },
        };
      },
    );
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 3"));
    await waitFor(() =>
      expect(
        screen
          .getByTestId("vouch-history-list")
          .props.data.map((item: VouchHistoryBusiness) => item.id),
      ).toEqual([1, 2]),
    );
    expect(screen.getByTestId("history-specialty-total").props.children).toBe(
      5,
    );
  });

  it("restores the reaction and keeps the sheet usable after mutation failure", async () => {
    (removeBusinessSpecialtyVouch as jest.Mock).mockResolvedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Rejected",
    });
    const screen = await renderScreen();
    await openManage(screen);
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 1"));
    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", text2: "Rejected" }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText("Toggle Specialty 1").props.accessibilityState,
      ).toMatchObject({ selected: true, disabled: false }),
    );
    expect(screen.getByTestId("history-specialty-total").props.children).toBe(
      2,
    );
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
  });

  it("blocks repeated specialty presses while the mutation is pending", async () => {
    let resolve!: (value: unknown) => void;
    (removeBusinessSpecialtyVouch as jest.Mock).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await renderScreen();
    await openManage(screen);
    const reaction = screen.getByLabelText("Toggle Specialty 1");
    await fireEvent.press(reaction);
    await fireEvent.press(reaction);
    await waitFor(() =>
      expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByLabelText("Toggle Specialty 2").props.accessibilityState
        .disabled,
    ).toBe(true);
    await act(async () => resolve({ success: true, data: {} }));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Toggle Specialty 1").props.accessibilityState
          .disabled,
      ).toBe(false),
    );
  });

  it.each(["success", "failure"] as const)(
    "keeps a delayed %s request protected across dismissal and reopening",
    async (outcome) => {
      const removeOnServer = (
        removeBusinessSpecialtyVouch as jest.Mock
      ).getMockImplementation()!;
      let resolve!: (value: unknown) => void;
      (removeBusinessSpecialtyVouch as jest.Mock).mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const screen = await renderScreen();
      await openManage(screen);
      await fireEvent.press(screen.getByLabelText("Toggle Specialty 1"));
      await waitFor(() =>
        expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1),
      );
      expect(client.getQueryData(["explore-business-detail", 1])).toMatchObject(
        {
          specialty_tags: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              is_vouched: false,
              vouch_count: 0,
            }),
          ]),
        },
      );
      await fireEvent.press(screen.getByLabelText("Close Manage Vouch"));
      await waitFor(() =>
        expect(screen.queryByTestId("manage-vouch-sheet")).toBeNull(),
      );
      await openManage(screen);
      expect(
        screen.getByLabelText("Toggle Specialty 3").props.accessibilityState
          .disabled,
      ).toBe(true);
      await fireEvent.press(screen.getByLabelText("Toggle Specialty 3"));
      expect(vouchForBusinessSpecialty).not.toHaveBeenCalled();
      expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolve(
          outcome === "success"
            ? await removeOnServer(1, 1)
            : { success: false, code: "VALIDATION_ERROR", message: "Rejected" },
        );
      });
      await waitFor(() =>
        expect(
          screen.getByLabelText("Toggle Specialty 1").props.accessibilityState,
        ).toMatchObject({ selected: outcome === "failure", disabled: false }),
      );
      expect(screen.getByTestId("history-specialty-total").props.children).toBe(
        outcome === "success" ? 1 : 2,
      );
      expect(client.getQueryData(["explore-business-detail", 1])).toMatchObject(
        {
          specialty_tags: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              is_vouched: outcome === "failure",
              vouch_count: outcome === "success" ? 0 : 1,
            }),
          ]),
        },
      );
      if (outcome === "failure")
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", text2: "Rejected" }),
        );
      expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
      await fireEvent.press(screen.getByLabelText("Toggle Specialty 3"));
      await waitFor(() =>
        expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
      );
      expect(vouchForBusinessSpecialty).toHaveBeenCalledWith(
        1,
        3,
        "installation",
      );
      await waitFor(() =>
        expect(
          screen.getByLabelText("Toggle Specialty 3").props.accessibilityState,
        ).toMatchObject({ selected: true, disabled: false }),
      );
    },
  );

  it("settles a delayed request against its original business while the sheet stays dismissed", async () => {
    const removeOnServer = (
      removeBusinessSpecialtyVouch as jest.Mock
    ).getMockImplementation()!;
    let resolve!: (value: unknown) => void;
    (removeBusinessSpecialtyVouch as jest.Mock).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await renderScreen();
    await openManage(screen);
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 1"));
    await waitFor(() =>
      expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1),
    );
    await fireEvent.press(screen.getByLabelText("Close Manage Vouch"));
    await waitFor(() =>
      expect(screen.queryByTestId("manage-vouch-sheet")).toBeNull(),
    );
    await act(async () => resolve(await removeOnServer(1, 1)));
    await waitFor(() =>
      expect(screen.getByTestId("history-specialty-total").props.children).toBe(
        1,
      ),
    );
    expect(
      client.getQueryState(["explore-business-detail", 1])?.isInvalidated,
    ).toBe(true);
    await openManage(screen);
    await waitFor(() =>
      expect(
        screen.getByLabelText("Toggle Specialty 1").props.accessibilityState,
      ).toMatchObject({ selected: false, disabled: false }),
    );
  });

  it("retries unavailable business detail while keeping the selected business visible", async () => {
    (getExploreBusinessDetail as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: "NOT_FOUND",
      message: "Unavailable",
    });
    const screen = await renderScreen();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Manage vouches for Business 1"),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByLabelText("Manage vouches for Business 1"),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText("Unable to load specialties. Tap to retry."),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId("manage-vouch-sheet")).toBeTruthy();
    expect(screen.queryByLabelText("Toggle Specialty 1")).toBeNull();
    await fireEvent.press(
      screen.getByLabelText("Unable to load specialties. Tap to retry."),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Toggle Specialty 1")).toBeTruthy(),
    );
  });

  it("preserves the existing prohibition on vouching for an owned business", async () => {
    (getExploreBusinessDetail as jest.Mock).mockResolvedValue({
      success: true,
      data: { ...businessDetail(), is_own_business: true },
    });
    const screen = await renderScreen();
    await openManage(screen);
    expect(
      screen.getByLabelText("Toggle Specialty 1").props.accessibilityState
        .disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByLabelText("Toggle Specialty 1"));
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
  });
});
