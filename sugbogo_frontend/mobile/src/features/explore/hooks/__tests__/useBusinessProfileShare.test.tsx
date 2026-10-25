import { act, renderHook } from "@testing-library/react-native";

import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { shareBusinessProfile } from "../../utils/businessProfileActions";
import useBusinessProfileShare from "../useBusinessProfileShare";

jest.mock("../../utils/businessProfileActions", () => ({
  shareBusinessProfile: jest.fn(),
}));

it("shares one native sheet across header actions and allows sharing again after dismissal", async () => {
  let dismiss!: () => void;
  (shareBusinessProfile as jest.Mock).mockReturnValue(
    new Promise<void>((resolve) => {
      dismiss = resolve;
    }),
  );
  const business = businessFixture();
  const { result } = await renderHook(() => useBusinessProfileShare(business));
  let sharing!: Promise<void>;
  await act(() => {
    sharing = result.current();
    void result.current();
  });
  expect(shareBusinessProfile).toHaveBeenCalledTimes(1);
  await act(async () => {
    dismiss();
    await sharing;
  });
  (shareBusinessProfile as jest.Mock).mockResolvedValue(undefined);
  await act(async () => {
    await result.current();
  });
  expect(shareBusinessProfile).toHaveBeenCalledTimes(2);
});
