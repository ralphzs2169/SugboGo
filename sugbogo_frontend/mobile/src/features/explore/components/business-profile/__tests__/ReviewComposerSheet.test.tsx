import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import {
  useCreateReview,
  useUpdateReview,
} from "../../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../../types/review.types";
import ReviewComposerSheet from "../ReviewComposerSheet";

jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, TextInput } = require("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetTextInput: TextInput,
  };
});
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPicker",
  () => ({
    pickBusinessPhotos: jest.fn(),
  }),
);
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPreview",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock("@/shared/components/form/FormTextArea", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextInput } = require("react-native");
  return {
    __esModule: true,
    default: (props: {
      value: string;
      onChangeText: (value: string) => void;
    }) => (
      <TextInput
        accessibilityLabel="Your review"
        value={props.value}
        onChangeText={props.onChangeText}
      />
    ),
  };
});
jest.mock("@/shared/components/Button", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: {
      title: string;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        disabled={props.disabled}
        onPress={props.onPress}
      >
        <Text>{props.title}</Text>
      </Pressable>
    ),
  };
});
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("../../../hooks/useBusinessReviews", () => ({
  useCreateReview: jest.fn(),
  useUpdateReview: jest.fn(),
}));

const create = jest.fn();
const update = jest.fn();
const sheetRef = { current: { dismiss: jest.fn() } };
const review = {
  id: 8,
  text: "A lovely visit with friendly staff.",
  photos: [],
  show_in_community: false,
} as unknown as BusinessReview;

function showReview(existing?: BusinessReview) {
  return render(
    <ReviewComposerSheet
      businessId={20}
      businessName="Sugbo Cafe"
      sheetRef={sheetRef as never}
      review={existing}
    />,
  );
}

async function settleForm() {
  await act(async () => {});
}

describe("ReviewComposerSheet Community visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({ id: 9 });
    update.mockResolvedValue(review);
    (useCreateReview as jest.Mock).mockReturnValue({
      mutateAsync: create,
      isPending: false,
      error: null,
    });
    (useUpdateReview as jest.Mock).mockReturnValue({
      mutateAsync: update,
      isPending: false,
      error: null,
    });
  });

  it("defaults on and submits an explicit enabled preference", async () => {
    const screen = await showReview();
    await settleForm();
    expect(screen.getByRole("switch").props.value).toBe(true);
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A lovely visit with friendly staff.",
    );
    expect(screen.getByLabelText("Your review").props.value).toBe(
      "A lovely visit with friendly staff.",
    );
    await fireEvent.press(screen.getByText("Submit review"));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        text: "A lovely visit with friendly staff.",
        photos: [],
        showInCommunity: true,
      }),
    );
  });

  it("submits the disabled creation preference", async () => {
    const screen = await showReview();
    await settleForm();
    await fireEvent(screen.getByRole("switch"), "valueChange", false);
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A lovely visit with friendly staff.",
    );
    await fireEvent.press(screen.getByText("Submit review"));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ showInCommunity: false }),
      ),
    );
  });

  it("loads the saved value and permits a visibility-only edit", async () => {
    const screen = await showReview(review);
    await settleForm();
    expect(screen.getByRole("switch").props.value).toBe(false);
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        reviewId: 8,
        text: undefined,
        photos: [],
        keepPhotoIds: undefined,
        showInCommunity: true,
        textChanged: false,
      }),
    );
  });

  it("preserves the saved preference when editing only review text", async () => {
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A newer review with plenty of detail.",
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "A newer review with plenty of detail.",
          showInCommunity: undefined,
          textChanged: true,
        }),
      ),
    );
  });

  it("can change visibility on a legacy short review without rewriting it", async () => {
    const shortReview = { ...review, text: "Older short review." };
    const screen = await showReview(shortReview);
    await settleForm();
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          text: undefined,
          showInCommunity: true,
        }),
      ),
    );
  });

  it("keeps the chosen value and shows existing error feedback after failure", async () => {
    create.mockRejectedValue(new Error("Network unavailable"));
    const screen = await showReview();
    await settleForm();
    await fireEvent(screen.getByRole("switch"), "valueChange", false);
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A lovely visit with friendly staff.",
    );
    await fireEvent.press(screen.getByText("Submit review"));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("switch").props.value).toBe(false);
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });
});
