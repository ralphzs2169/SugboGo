import React from "react";
import { Alert } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { getMyPockets, removeBusinessFromPocket } from "@/features/explore/api/exploreBusiness.service";
import MyPocketsScreen from "../MyPocketsScreen";

jest.setTimeout(15000);

let mockUserId = 42;
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: mockUserId } }),
}));
jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  getMyPockets: jest.fn(),
  removeBusinessFromPocket: jest.fn(),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: ({ options }: { options: { headerRight: () => React.ReactNode } }) => options.headerRight() },
  router: { push: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: ({ title, primaryActionTitle, onPrimaryAction }: {
    title: string; primaryActionTitle: string; onPrimaryAction: () => void;
  }) => {
    const { Text, Pressable } = require("react-native");
    return <Pressable onPress={onPrimaryAction}><Text>{title}</Text><Text>{primaryActionTitle}</Text></Pressable>;
  },
}));

const pocket = {
  id: 901, business_id: 77, name: "Real Cebu Cafe", photo_url: null,
  category: "Cafes", location: "Cebu City", saved_at: "2026-10-17T00:00:00Z",
};
function response(items = [pocket], page = 1, hasNext = false) {
  return {
    success: true, message: "Success.", data: {
      items, pagination: { page, page_size: 10, total_items: items.length, total_pages: hasNext ? 2 : page,
        has_next: hasNext, has_previous: page > 1 },
    },
  };
}

let client: QueryClient;
async function setup() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><MyPocketsScreen /></QueryClientProvider>);
}

beforeEach(() => {
  mockUserId = 42;
  jest.clearAllMocks();
  (getMyPockets as jest.Mock).mockResolvedValue(response());
  (removeBusinessFromPocket as jest.Mock).mockResolvedValue({ success: true, data: { business_id: 77, is_pocketed: false } });
});
afterEach(async () => { await cleanup(); client?.clear(); });

it("shows real saved data and opens the business by its business ID", async () => {
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  expect(getMyPockets).toHaveBeenCalledWith(1, "");
  await fireEvent.press(screen.getByText("Real Cebu Cafe"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/(explorer)/business/[businessId]", params: { businessId: 77 } });
});

it("shows loading without fake or empty data", async () => {
  (getMyPockets as jest.Mock).mockReturnValue(new Promise(() => {}));
  const screen = await setup();
  expect(screen.getByLabelText("Loading pockets")).toBeTruthy();
  expect(screen.queryByText("No saved pockets yet.")).toBeNull();
});

it("shows a successful empty list", async () => {
  (getMyPockets as jest.Mock).mockResolvedValue(response([]));
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("No saved pockets yet.")).toBeTruthy());
});

it("retries a failed list request", async () => {
  (getMyPockets as jest.Mock).mockResolvedValueOnce({ success: false, message: "Offline", code: "NETWORK_ERROR" });
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Couldn't load pockets")).toBeTruthy());
  expect(screen.queryByText("No saved pockets yet.")).toBeNull();
  await fireEvent.press(screen.getByText("Retry"));
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
});

it("refreshes and loads later pages", async () => {
  (getMyPockets as jest.Mock).mockImplementation((page: number) => Promise.resolve(
    page === 1 ? response([pocket], 1, true) : response([{ ...pocket, id: 902, business_id: 78, name: "Second Cafe" }], 2),
  ));
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  await fireEvent(screen.getByTestId("my-pockets-list"), "onRefresh");
  await waitFor(() => expect(getMyPockets).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByTestId("my-pockets-list").props.refreshing).toBe(false));
  await fireEvent(screen.getByTestId("my-pockets-list"), "onEndReached");
  await waitFor(() => expect(screen.getByText("Second Cafe")).toBeTruthy());
  expect(getMyPockets).toHaveBeenCalledWith(2, "");
});

it("searches the server across all saved pages", async () => {
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  (getMyPockets as jest.Mock).mockResolvedValue(response([]));
  await fireEvent.changeText(screen.getByPlaceholderText("Search saved MSMEs..."), " missing ");
  await waitFor(() => expect(getMyPockets).toHaveBeenCalledWith(1, "missing"));
  await waitFor(() => expect(screen.getByText("No matching pockets.")).toBeTruthy());
});

it("bulk-deletes through the API using business IDs and refetches", async () => {
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  (getMyPockets as jest.Mock).mockResolvedValue(response([]));
  await fireEvent.press(screen.getByText("Edit"));
  await fireEvent.press(screen.getByText("All"));
  await fireEvent.press(screen.getByText("Delete"));
  await waitFor(() => expect(removeBusinessFromPocket).toHaveBeenCalledWith(77));
  await waitFor(() => expect(screen.getByText("No saved pockets yet.")).toBeTruthy());
});

it("keeps pockets visible after failed deletion", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  (removeBusinessFromPocket as jest.Mock).mockResolvedValue({ success: false, message: "Offline", code: "NETWORK_ERROR" });
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  await fireEvent.press(screen.getByText("Edit"));
  await fireEvent.press(screen.getByText("All"));
  await fireEvent.press(screen.getByText("Delete"));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(screen.getByText("Real Cebu Cafe")).toBeTruthy();
  alert.mockRestore();
});

it("uses separate query caches for different accounts", async () => {
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  mockUserId = 43;
  (getMyPockets as jest.Mock).mockResolvedValue(response([]));
  await screen.rerender(<QueryClientProvider client={client}><MyPocketsScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText("No saved pockets yet.")).toBeTruthy());
  expect(screen.queryByText("Real Cebu Cafe")).toBeNull();
});


it("removes one pocket without opening its business", async () => {
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  (getMyPockets as jest.Mock).mockResolvedValue(response([]));
  await fireEvent.press(screen.getByLabelText("Remove Real Cebu Cafe from pockets"));
  await waitFor(() => expect(removeBusinessFromPocket).toHaveBeenCalledWith(77));
  await waitFor(() => expect(screen.getByText("No saved pockets yet.")).toBeTruthy());
  expect(router.push).not.toHaveBeenCalled();
});

it("reconciles partial batch deletion and allows retrying the remaining item", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const second = { ...pocket, id: 902, business_id: 78, name: "Second Cafe" };
  (getMyPockets as jest.Mock).mockResolvedValue(response([pocket, second]));
  (removeBusinessFromPocket as jest.Mock)
    .mockResolvedValueOnce({ success: true, data: {} })
    .mockResolvedValueOnce({ success: false, message: "Offline", code: "NETWORK_ERROR" });
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Second Cafe")).toBeTruthy());
  (getMyPockets as jest.Mock).mockResolvedValue(response([second]));
  await fireEvent.press(screen.getByText("Edit"));
  await fireEvent.press(screen.getByText("All"));
  await fireEvent.press(screen.getByText("Delete"));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(screen.queryByText("Real Cebu Cafe")).toBeNull();
  expect(screen.getByText("Second Cafe")).toBeTruthy();
  (getMyPockets as jest.Mock).mockResolvedValue(response([]));
  await fireEvent.press(screen.getByText("All"));
  await fireEvent.press(screen.getByText("Delete"));
  await waitFor(() => expect(screen.getByText("No saved pockets yet.")).toBeTruthy());
  expect((removeBusinessFromPocket as jest.Mock).mock.calls.map(([id]) => id)).toEqual([77, 78, 78]);
  alert.mockRestore();
});

it("retries a later-page failure without losing loaded pockets", async () => {
  (getMyPockets as jest.Mock)
    .mockResolvedValueOnce(response([pocket], 1, true))
    .mockResolvedValueOnce({ success: false, message: "Offline", code: "NETWORK_ERROR" })
    .mockResolvedValue(response([{ ...pocket, id: 902, business_id: 78, name: "Second Cafe" }], 2));
  const screen = await setup();
  await waitFor(() => expect(screen.getByText("Real Cebu Cafe")).toBeTruthy());
  await fireEvent(screen.getByTestId("my-pockets-list"), "onEndReached");
  await waitFor(() => expect(screen.getByText("Couldn't load more pockets")).toBeTruthy());
  expect(screen.getByText("Real Cebu Cafe")).toBeTruthy();
  await fireEvent.press(screen.getByText("Load more"));
  await waitFor(() => expect(screen.getByText("Second Cafe")).toBeTruthy());
});
