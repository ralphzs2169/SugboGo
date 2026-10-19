import { render } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import PocketCollectionRoute from "@/app/(explorer)/profile/pockets/[collectionId]";
import PocketCollectionScreen from "../PocketCollectionScreen";

jest.mock("expo-router", () => ({ useLocalSearchParams: jest.fn() }));
jest.mock("../PocketCollectionScreen", () => jest.fn(() => null));

describe("PocketCollectionRoute", () => {
  it.each(["20", "7", "00030"])(
    "passes numeric identity %s to the feature screen",
    async (collectionId) => {
      jest.mocked(useLocalSearchParams).mockReturnValue({ collectionId });
      await render(<PocketCollectionRoute />);
      expect(
        jest.mocked(PocketCollectionScreen).mock.calls.at(-1)?.[0],
      ).toEqual({ collectionId: Number(collectionId) });
    },
  );

  it.each(
    [
      undefined,
      [],
      ["20", "30"],
      "",
      "0",
      "-1",
      "1.5",
      "1e2",
      "Infinity",
      "abc",
      "9007199254740992",
    ].map((collectionId) => ({ collectionId })),
  )("rejects malformed route identity %#", async ({ collectionId }) => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue(collectionId === undefined ? {} : { collectionId });
    await render(<PocketCollectionRoute />);
    expect(jest.mocked(PocketCollectionScreen).mock.calls.at(-1)?.[0]).toEqual({
      collectionId: null,
    });
  });
});
