import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { RefObject } from "react";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ReviewComposerSheet from "../ReviewComposerSheet";

const mockCreateReview = jest.fn();
const mockDismiss = jest.fn();

jest.mock("../../../hooks/useBusinessReviews", () => ({
  useCreateReview: () => ({
    mutateAsync: mockCreateReview,
    isPending: false,
    error: null,
  }),
  useUpdateReview: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
  }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, TextInput } = require("react-native");
  return {
    BottomSheetModal: View,
    BottomSheetScrollView: View,
    BottomSheetBackdrop: View,
    BottomSheetTextInput: TextInput,
  };
});
jest.mock("@/shared/components/form/FormTextArea", () => ({
  __esModule: true,
  default: ({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TextInput } = require("react-native");
    return (
      <TextInput
        accessibilityLabel="Your review"
        value={value}
        onChangeText={onChangeText}
      />
    );
  },
}));
jest.mock("@/shared/components/Button", () => ({
  __esModule: true,
  default: ({ title, onPress }: { title: string; onPress: () => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPicker",
  () => ({ pickBusinessPhotos: jest.fn() }),
);
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPreview",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

const sheetRef = {
  current: { dismiss: mockDismiss },
} as unknown as RefObject<BottomSheetModal | null>;

describe("ReviewComposerSheet moderation response", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["published", "Review added", undefined, undefined],
    [
      "under_review",
      "Review submitted",
      "Your review is saved privately. Its status is not yet confirmed.",
      undefined,
    ],
    [
      "under_review",
      "Review submitted",
      "We're checking your review before it appears publicly.",
      "pending",
    ],
  ])(
    "treats %s as a successful submission",
    async (status, title, detail, progress) => {
      mockCreateReview.mockResolvedValue({
        id: 12,
        business_id: 20,
        user_id: 4,
        status,
        ...(progress ? { moderation_progress: { state: progress } } : {}),
      });
      const screen = await render(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          }}
        >
          <ReviewComposerSheet
            businessId={20}
            businessName="Sugbo Cafe"
            sheetRef={sheetRef}
          />
        </SafeAreaProvider>,
      );
      await act(async () => {
        fireEvent.changeText(
          screen.getByLabelText("Your review"),
          "Friendly service and a pleasant visit.",
        );
      });
      await act(async () => {
        fireEvent.press(screen.getByText("Submit review"));
      });

      await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "success",
            text1: title,
            ...(detail ? { text2: detail } : {}),
          }),
        ),
      );
      screen.unmount();
    },
  );
});
