import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { useImagePicker } from "../../hooks/useImagePicker";
import { useRemoveProfilePicture } from "../../hooks/useRemoveProfilePicture";
import { useUpdateProfile } from "../../hooks/useUpdateProfile";
import { useUpdateProfilePicture } from "../../hooks/useUpdateProfilePicture";
import type { UpdateProfileRequest } from "../../types/profile.types";
import EditProfileScreen from "../EditProfileScreen";

type RemovalEvent = { preventDefault: () => void };
const mockBeforeRemove = new Set<(event: RemovalEvent) => void>();
const mockNavigation = {
  addListener: jest.fn(
    (_event: string, listener: (event: RemovalEvent) => void) => {
      mockBeforeRemove.add(listener);
      return () => mockBeforeRemove.delete(listener);
    },
  ),
};

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useNavigation: () => mockNavigation,
}));
jest.mock("../../hooks/useImagePicker");
jest.mock("../../hooks/useRemoveProfilePicture");
jest.mock("../../hooks/useUpdateProfile");
jest.mock("../../hooks/useUpdateProfilePicture");
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-toast-message/lib/src/Toast", () => ({
  Toast: { show: jest.fn() },
}));

// Replace only native sheet presentation; retain the actual image-picker and form actions.
jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return function MockSelectionSheet(props: any) {
    const [visible, setVisible] = React.useState(false);
    React.useImperativeHandle(props.sheetRef, () => ({
      present: () => setVisible(true),
      dismiss: () => setVisible(false),
    }));
    if (!visible) {
      return null;
    }
    return (
      <View>
        <Text>{props.title}</Text>
        {props.options.map((option: { value: string; label: string }) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => {
              setVisible(false);
              props.onSelect(option.value);
            }}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});
jest.mock("../../components/edit-profile/AvatarPickerBottomSheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } = jest.requireActual("react-native");
  return function MockAvatarSheet(props: any) {
    const [visible, setVisible] = React.useState(false);
    React.useImperativeHandle(props.sheetRef, () => ({
      present: () => setVisible(true),
      dismiss: () => setVisible(false),
    }));
    return visible ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose avatar 2"
        onPress={() => {
          props.onSelect("explorer_avatar_2");
          setVisible(false);
        }}
      >
        <Text>Choose avatar 2</Text>
      </Pressable>
    ) : null;
  };
});
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return function MockConfirmModal(props: any) {
    if (!props.visible) {
      return null;
    }
    return (
      <View>
        <Text>{props.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.confirmText}
          onPress={props.onConfirm}
        >
          <Text>{props.confirmText}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={props.onCancel}
        >
          <Text>Cancel</Text>
        </Pressable>
      </View>
    );
  };
});

const user: User = {
  id: 1,
  first_name: "Cebu",
  last_name: "Explorer",
  gender: "male",
  email: "cebu@example.com",
  role: "explorer",
  status: "active",
  avatar_key: "explorer_avatar_1",
  avatar_url: "https://example.com/photo.jpg",
  has_completed_interest_selection: true,
  has_custom_profile_picture: true,
  has_oauth_accounts: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function startSave(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(screen.getByRole("button", { name: "Save Changes" }));
}

describe("EditProfileScreen save integrity", () => {
  const updateUserProfile = jest.fn();
  const uploadProfilePicture = jest.fn();
  const removePicture = jest.fn();
  const pickFromGallery = jest.fn();

  beforeEach(() => {
    mockBeforeRemove.clear();
    updateUserProfile.mockReset();
    uploadProfilePicture.mockReset();
    removePicture.mockReset();
    pickFromGallery.mockReset();
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    jest
      .mocked(useUpdateProfile)
      .mockReturnValue({ updateUserProfile, isUpdating: false });
    jest
      .mocked(useUpdateProfilePicture)
      .mockReturnValue({ uploadProfilePicture, isUploading: false });
    jest
      .mocked(useRemoveProfilePicture)
      .mockReturnValue({ removePicture, isRemoving: false });
    jest
      .mocked(useImagePicker)
      .mockReturnValue({ pickFromGallery, takePhoto: jest.fn() });
    pickFromGallery.mockResolvedValue("file:///chosen-photo.jpg");
    updateUserProfile.mockImplementation(
      async (values: UpdateProfileRequest) => {
        const updated = { ...useAuthStore.getState().user!, ...values };
        useAuthStore.getState().setUser(updated);
        return { success: true, message: "Saved", data: updated };
      },
    );
    removePicture.mockResolvedValue({
      success: true,
      message: "Saved",
      data: user,
    });
    uploadProfilePicture.mockResolvedValue({
      success: true,
      message: "Saved",
      data: user,
    });
  });

  it("locks fields, gender, avatar actions, navigation and rapid duplicate saves for the submitted snapshot", async () => {
    const request = deferred<ApiResponse<User>>();
    updateUserProfile.mockReturnValueOnce(request.promise);
    const screen = await render(<EditProfileScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your first name"),
      "Submitted",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Change avatar" }),
    );
    expect(screen.getByText("Profile picture actions")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save Changes" });
    await fireEvent.press(save);
    await fireEvent.press(save);
    expect(updateUserProfile).toHaveBeenCalledTimes(1);
    expect(
      screen.getByPlaceholderText("Enter your first name").props.editable,
    ).toBe(false);
    expect(
      screen.getByPlaceholderText("Enter your last name").props.editable,
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: "Change avatar" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true, busy: true });
    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true, busy: true });
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your first name"),
      "Too late",
    );
    await fireEvent.press(screen.getByText("Male"));
    await fireEvent.press(
      screen.getByRole("button", { name: "Change avatar" }),
    );
    expect(screen.queryByText("Select Gender")).toBeNull();
    expect(screen.queryByText("Profile picture actions")).toBeNull();
    expect(
      screen.getByPlaceholderText("Enter your first name").props.value,
    ).toBe("Submitted");
    const preventDefault = jest.fn();
    await act(async () => {
      mockBeforeRemove.forEach((listener) => listener({ preventDefault }));
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard changes?")).toBeNull();

    await act(async () => {
      const updated = { ...user, first_name: "Submitted" };
      useAuthStore.getState().setUser(updated);
      request.resolve({ success: true, message: "Saved", data: updated });
    });
    expect(updateUserProfile).toHaveBeenCalledWith({
      first_name: "Submitted",
      last_name: "Explorer",
      gender: "male",
      avatar_key: "explorer_avatar_1",
    });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/profile");
    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    const afterSave = jest.fn();
    mockBeforeRemove.forEach((listener) =>
      listener({ preventDefault: afterSave }),
    );
    expect(afterSave).not.toHaveBeenCalled();
  });

  it("ignores a delayed gallery selection while the submitted profile is saving", async () => {
    const gallery = deferred<string | null>();
    const request = deferred<ApiResponse<User>>();
    pickFromGallery.mockReturnValueOnce(gallery.promise);
    updateUserProfile.mockReturnValueOnce(request.promise);
    const screen = await render(<EditProfileScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Change avatar" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Upload Photo" }));
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your first name"),
      "Submitted",
    );
    await startSave(screen);
    await act(async () => {
      gallery.resolve("file:///late-selection.jpg");
    });
    expect(uploadProfilePicture).not.toHaveBeenCalled();
    await act(async () => {
      const updated = { ...user, first_name: "Submitted" };
      useAuthStore.getState().setUser(updated);
      request.resolve({ success: true, message: "Saved", data: updated });
    });
    expect(uploadProfilePicture).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it.each(["upload", "remove"])(
    "keeps one lock across %s and the subsequent profile mutation",
    async (photoAction) => {
      const photoRequest = deferred<ApiResponse<User>>();
      const profileRequest = deferred<ApiResponse<User>>();
      (photoAction === "upload"
        ? uploadProfilePicture
        : removePicture
      ).mockReturnValueOnce(photoRequest.promise);
      updateUserProfile.mockReturnValueOnce(profileRequest.promise);
      const screen = await render(<EditProfileScreen />);
      await fireEvent.changeText(
        screen.getByPlaceholderText("Enter your first name"),
        "Submitted",
      );
      await fireEvent.press(
        screen.getByRole("button", { name: "Change avatar" }),
      );
      if (photoAction === "upload") {
        await fireEvent.press(
          screen.getByRole("button", { name: "Upload Photo" }),
        );
      } else {
        await fireEvent.press(
          screen.getByRole("button", { name: "Choose SugboGo Avatar" }),
        );
        await fireEvent.press(
          screen.getByRole("button", { name: "Choose avatar 2" }),
        );
      }
      await startSave(screen);
      expect(updateUserProfile).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Change avatar" }).props
          .accessibilityState.disabled,
      ).toBe(true);
      await act(async () => {
        photoRequest.resolve({ success: true, message: "Saved", data: user });
      });
      expect(updateUserProfile).toHaveBeenCalledTimes(1);
      expect(
        screen.getByPlaceholderText("Enter your first name").props.editable,
      ).toBe(false);
      expect(
        screen.getByRole("button", { name: "Change avatar" }).props
          .accessibilityState.disabled,
      ).toBe(true);
      await act(async () => {
        profileRequest.resolve({ success: true, message: "Saved", data: user });
      });
      expect(router.replace).toHaveBeenCalledWith("/profile");
    },
  );

  it.each(["response", "exception"])(
    "retains failed input, restores editing, and protects dirty navigation after a %s failure",
    async (failure) => {
      const request = deferred<ApiResponse<User>>();
      updateUserProfile.mockReturnValueOnce(request.promise);
      const screen = await render(<EditProfileScreen />);
      await fireEvent.changeText(
        screen.getByPlaceholderText("Enter your first name"),
        "Keep my draft",
      );
      await startSave(screen);
      await act(async () => {
        if (failure === "response") {
          request.resolve({
            success: false,
            code: "UNKNOWN_ERROR",
            message: "Please retry",
            errors: {},
          });
        } else {
          request.reject(new Error("Network error"));
        }
      });
      expect(router.replace).not.toHaveBeenCalled();
      expect(
        screen.getByPlaceholderText("Enter your first name").props.value,
      ).toBe("Keep my draft");
      expect(
        screen.getByPlaceholderText("Enter your first name").props.editable,
      ).toBe(true);
      expect(
        screen.getByRole("button", { name: "Change avatar" }).props
          .accessibilityState.disabled,
      ).toBe(false);
      expect(
        screen.getByRole("button", { name: "Save Changes" }).props
          .accessibilityState.disabled,
      ).toBe(false);
      const preventDefault = jest.fn();
      await act(async () => {
        mockBeforeRemove.forEach((listener) => listener({ preventDefault }));
      });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Discard changes?")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      await startSave(screen);
      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith("/profile"),
      );
    },
  );

  it("does not continue a composite save after session expiration", async () => {
    const photoRequest = deferred<ApiResponse<User>>();
    uploadProfilePicture.mockReturnValueOnce(photoRequest.promise);
    const screen = await render(<EditProfileScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Change avatar" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Upload Photo" }));
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your first name"),
      "Old owner",
    );
    await startSave(screen);
    await act(async () => {
      invalidateAuthSession();
      useAuthStore.getState().clearUser();
      photoRequest.resolve({ success: true, message: "Saved", data: user });
    });
    expect(updateUserProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
