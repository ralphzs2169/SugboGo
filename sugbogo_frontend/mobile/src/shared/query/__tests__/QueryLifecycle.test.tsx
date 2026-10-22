import { act, render } from "@testing-library/react-native";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { AppState, Platform, type AppStateStatus } from "react-native";

import QueryLifecycle, {
  subscribeNativeQueryLifecycle,
} from "../QueryLifecycle";

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(),
}));

let networkChanged: (state: NetInfoState) => void;
let appChanged: (state: AppStateStatus) => void;
let stopNetwork: jest.Mock;
let stopApp: jest.Mock;
const releases: (() => void)[] = [];

function connect(connected: boolean, reachable: boolean | null = connected) {
  networkChanged({
    isConnected: connected,
    isInternetReachable: reachable,
  } as NetInfoState);
}

beforeEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
  stopNetwork = jest.fn();
  stopApp = jest.fn();
  jest.replaceProperty(Platform, "OS", "ios");
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    networkChanged = listener;
    return stopNetwork;
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
    appChanged = listener;
    return { remove: stopApp };
  });
});

afterEach(() => {
  releases.splice(0).forEach((release) => release());
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  jest.restoreAllMocks();
});

it("maps offline, unreachable, unknown reachability and reconnect events", () => {
  releases.push(subscribeNativeQueryLifecycle());
  connect(false);
  expect(onlineManager.isOnline()).toBe(false);
  connect(true, false);
  expect(onlineManager.isOnline()).toBe(false);
  connect(true, null);
  expect(onlineManager.isOnline()).toBe(true);
  connect(true);
  expect(onlineManager.isOnline()).toBe(true);
});

it("maps background and inactive states back to foreground focus", () => {
  releases.push(subscribeNativeQueryLifecycle());
  appChanged("background");
  expect(focusManager.isFocused()).toBe(false);
  appChanged("inactive");
  expect(focusManager.isFocused()).toBe(false);
  appChanged("active");
  expect(focusManager.isFocused()).toBe(true);
});

it("initializes focus from the current native app state", () => {
  const previousState = AppState.currentState;
  Object.defineProperty(AppState, "currentState", {
    value: "background",
    configurable: true,
  });
  try {
    releases.push(subscribeNativeQueryLifecycle());
    expect(focusManager.isFocused()).toBe(false);
  } finally {
    Object.defineProperty(AppState, "currentState", {
      value: previousState,
      configurable: true,
    });
  }
});

it("shares listeners across mounts and cleans up only after the final unmount", async () => {
  const first = await render(<QueryLifecycle />);
  const second = await render(<QueryLifecycle />);
  expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  await first.unmount();
  expect(stopNetwork).not.toHaveBeenCalled();
  await second.unmount();
  expect(stopNetwork).toHaveBeenCalledTimes(1);
  expect(stopApp).toHaveBeenCalledTimes(1);

  // Native callbacks already queued before removal must no longer affect Query.
  onlineManager.setOnline(true);
  connect(false);
  expect(onlineManager.isOnline()).toBe(true);
  appChanged("background");
  expect(focusManager.isFocused()).toBe(true);
});

it("can register again after cleanup without duplicate or stale listeners", () => {
  const release = subscribeNativeQueryLifecycle();
  release();
  release();
  releases.push(subscribeNativeQueryLifecycle());
  expect(NetInfo.addEventListener).toHaveBeenCalledTimes(2);
  expect(stopNetwork).toHaveBeenCalledTimes(1);
  connect(false);
  expect(onlineManager.isOnline()).toBe(false);
});

it("preserves browser lifecycle handling on web", () => {
  jest.replaceProperty(Platform, "OS", "web");
  releases.push(subscribeNativeQueryLifecycle());
  expect(NetInfo.addEventListener).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});

it("revalidates stale active queries on reconnect and foreground", async () => {
  releases.push(subscribeNativeQueryLifecycle());
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.mount();
  const fetch = jest.fn(async () => ["loaded business"]);
  const observer = new QueryObserver(client, {
    queryKey: ["lifecycle-test"],
    queryFn: fetch,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await act(async () => {
      await observer.refetch();
    });
    const initialCalls = fetch.mock.calls.length;
    await act(async () => connect(false));
    expect(fetch).toHaveBeenCalledTimes(initialCalls);
    await act(async () => connect(true));
    expect(fetch).toHaveBeenCalledTimes(initialCalls + 1);
    await act(async () => appChanged("background"));
    expect(fetch).toHaveBeenCalledTimes(initialCalls + 1);
    await act(async () => appChanged("active"));
    expect(fetch).toHaveBeenCalledTimes(initialCalls + 2);
  } finally {
    unsubscribe();
    client.unmount();
    client.clear();
  }
});
