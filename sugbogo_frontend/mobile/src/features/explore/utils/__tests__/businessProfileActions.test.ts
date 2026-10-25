import { Linking, Share } from "react-native";
import Toast from "react-native-toast-message";

import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import {
  normalizeBusinessWebsite,
  openBusinessWebsite,
  shareBusinessProfile,
} from "../businessProfileActions";

jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

it.each([
  ["https://example.com/path", "https://example.com/path"],
  ["  example.com  ", "https://example.com/"],
  ["www.example.com/menu", "https://www.example.com/menu"],
  ["//example.com/menu", "https://example.com/menu"],
  ["http://example.com", "http://example.com/"],
  ["javascript:alert(1)", null],
  ["data:text/html,hello", null],
  ["file:///tmp/example", null],
  ["sugbogo://business/1", null],
  ["mailto:hello@example.com", null],
  ["https://user:secret@example.com", null],
  ["https://exam ple.com", null],
  ["https://example.com\n/unsafe", null],
  ["https://", null],
  [null, null],
  ["", null],
])("normalizes or rejects the merchant website %s", (input, expected) => {
  expect(normalizeBusinessWebsite(input)).toBe(expected);
});

it("opens only validated HTTP websites and handles native failures", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await openBusinessWebsite("example.com/menu");
  expect(open).toHaveBeenCalledWith("https://example.com/menu");
  open.mockClear();
  await openBusinessWebsite("javascript:alert(1)");
  expect(open).not.toHaveBeenCalled();
  open.mockRejectedValueOnce(new Error("Browser unavailable"));
  await expect(
    openBusinessWebsite("https://example.com"),
  ).resolves.toBeUndefined();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ text1: "Unable to open website" }),
  );
  open.mockRestore();
});

it("shares profile text without inventing a public link or reporting cancellation as failure", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: Share.dismissedAction });
  const business = businessFixture();
  await shareBusinessProfile(business);
  const content = share.mock.calls[0][0];
  expect(content.message).toContain(business.business_name);
  expect(content.message).toContain(business.location.address);
  expect(content).not.toHaveProperty("url");
  expect(content.message).not.toMatch(/https?:\/\/|sugbogo:\/\//);
  expect(Toast.show).not.toHaveBeenCalled();
  share.mockRestore();
});

it("handles share rejection and browser cancellation without an unhandled promise", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockRejectedValueOnce(new Error("Native failure"));
  await expect(
    shareBusinessProfile(businessFixture()),
  ).resolves.toBeUndefined();
  expect(Toast.show).toHaveBeenCalledTimes(1);
  (Toast.show as jest.Mock).mockClear();
  const abort = new Error("Cancelled");
  abort.name = "AbortError";
  share.mockRejectedValueOnce(abort);
  await shareBusinessProfile(businessFixture());
  expect(Toast.show).not.toHaveBeenCalled();
  share.mockRestore();
});
