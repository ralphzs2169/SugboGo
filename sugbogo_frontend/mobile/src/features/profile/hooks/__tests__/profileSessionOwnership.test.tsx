import { act, renderHook } from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  beginAuthSession,
  invalidateAuthSession,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";
import * as profileApi from "../../api/profile.service";
import { useUpdateProfile } from "../useUpdateProfile";
import { useUpdateProfilePicture } from "../useUpdateProfilePicture";
import { useRemoveProfilePicture } from "../useRemoveProfilePicture";

jest.mock("../../api/profile.service", () => ({
  updateProfile: jest.fn(),
  updateProfilePicture: jest.fn(),
  removeProfilePicture: jest.fn(),
}));
const mockRender = jest.fn();
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulate: () => ({ resize: jest.fn(), renderAsync: () => mockRender() }),
  },
  SaveFormat: { JPEG: "jpeg" },
}));

const account = (id: number) =>
  ({ id, first_name: `Account ${id}` }) as NonNullable<
    ReturnType<typeof useAuthStore.getState>["user"]
  >;
const payload = { first_name: "Updated", last_name: "User", gender: null };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const operations = ["profile", "upload", "remove"] as const;
function useOperation(kind: (typeof operations)[number]) {
  const profile = useUpdateProfile();
  const upload = useUpdateProfilePicture();
  const remove = useRemoveProfilePicture();
  return () =>
    kind === "profile"
      ? profile.updateUserProfile(payload)
      : kind === "upload"
        ? upload.uploadProfilePicture("file:///photo.jpg")
        : remove.removePicture();
}

describe("profile operation session ownership", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    beginAuthSession();
    useAuthStore.setState({
      user: account(1),
      isAuthenticated: true,
      isLoading: false,
    });
    mockRender.mockResolvedValue({
      saveAsync: async () => ({ uri: "file:///processed.jpg" }),
    });
  });

  it.each(operations)(
    "applies %s normally within its original session",
    async (kind) => {
      const response = { success: true, data: account(1) };
      [
        profileApi.updateProfile,
        profileApi.updateProfilePicture,
        profileApi.removeProfilePicture,
      ].forEach((mock) => (mock as jest.Mock).mockResolvedValue(response));
      const hook = await renderHook(() => useOperation(kind));
      await act(async () => {
        await expect(hook.result.current()).resolves.toEqual(response);
      });
      expect(useAuthStore.getState().user).toEqual(account(1));
      await hook.unmount();
    },
  );

  it.each(operations)(
    "rejects an obsolete %s response after account switching",
    async (kind) => {
      const response = deferred<unknown>();
      [
        profileApi.updateProfile,
        profileApi.updateProfilePicture,
        profileApi.removeProfilePicture,
      ].forEach((mock) =>
        (mock as jest.Mock).mockReturnValue(response.promise),
      );
      const hook = await renderHook(() => useOperation(kind));
      let operation!: Promise<unknown>;
      await act(async () => {
        operation = hook.result.current();
      });
      beginAuthSession();
      useAuthStore.getState().setUser(account(2));
      const assertion = expect(operation).rejects.toBeInstanceOf(
        StaleAuthSessionError,
      );
      await act(async () => {
        response.resolve({ success: true, data: account(1) });
        await assertion;
      });
      expect(useAuthStore.getState().user?.id).toBe(2);
      await hook.unmount();
    },
  );

  it.each(operations)(
    "does not let %s restore a logged-out account",
    async (kind) => {
      const response = deferred<unknown>();
      [
        profileApi.updateProfile,
        profileApi.updateProfilePicture,
        profileApi.removeProfilePicture,
      ].forEach((mock) =>
        (mock as jest.Mock).mockReturnValue(response.promise),
      );
      const hook = await renderHook(() => useOperation(kind));
      let operation!: Promise<unknown>;
      await act(async () => {
        operation = hook.result.current();
      });
      invalidateAuthSession();
      useAuthStore.getState().clearUser();
      const assertion = expect(operation).rejects.toBeInstanceOf(
        StaleAuthSessionError,
      );
      await act(async () => {
        response.resolve({ success: true, data: account(1) });
        await assertion;
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      await hook.unmount();
    },
  );

  it.each(operations)(
    "rejects %s responses from a previous login of the same account",
    async (kind) => {
      const response = deferred<unknown>();
      [
        profileApi.updateProfile,
        profileApi.updateProfilePicture,
        profileApi.removeProfilePicture,
      ].forEach((mock) =>
        (mock as jest.Mock).mockReturnValue(response.promise),
      );
      const hook = await renderHook(() => useOperation(kind));
      let operation!: Promise<unknown>;
      await act(async () => {
        operation = hook.result.current();
      });
      beginAuthSession();
      const assertion = expect(operation).rejects.toBeInstanceOf(
        StaleAuthSessionError,
      );
      await act(async () => {
        response.resolve({
          success: true,
          data: { ...account(1), first_name: "Obsolete" },
        });
        await assertion;
      });
      expect(useAuthStore.getState().user?.first_name).toBe("Account 1");
      await hook.unmount();
    },
  );

  it("does not send an old upload after local image processing outlives its session", async () => {
    const processing = deferred<{
      saveAsync: () => Promise<{ uri: string }>;
    }>();
    mockRender.mockReturnValue(processing.promise);
    const hook = await renderHook(() => useOperation("upload"));
    let operation!: Promise<unknown>;
    await act(async () => {
      operation = hook.result.current();
    });
    // Even a fresh login by the same account must invalidate the old work.
    beginAuthSession();
    const assertion = expect(operation).rejects.toBeInstanceOf(
      StaleAuthSessionError,
    );
    await act(async () => {
      processing.resolve({
        saveAsync: async () => ({ uri: "file:///processed.jpg" }),
      });
      await assertion;
    });
    expect(profileApi.updateProfilePicture).not.toHaveBeenCalled();
    await hook.unmount();
  });
});
