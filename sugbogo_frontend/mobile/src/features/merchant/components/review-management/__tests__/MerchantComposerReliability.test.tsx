import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import MerchantReviewReplyComposerSheet from "../MerchantReviewReplyComposerSheet";
import ReplyTemplateComposerSheet from "../reply-template/ReplyTemplateComposerSheet";

const mockCreateReply = jest.fn();
const mockUpdateReply = jest.fn();
const mockCreateTemplate = jest.fn();
const mockUpdateTemplate = jest.fn();
let mockSheetProps: any;
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { View, TextInput, Pressable, Text } =
    jest.requireActual("react-native");
  return {
    BottomSheetModal: ({ children, backdropComponent, ...props }: any) => {
      mockSheetProps = props;
      const onPresented = React.useRef(props.onChange);
      React.useEffect(() => {
        onPresented.current?.(0);
      }, []);
      return (
        <View>
          {backdropComponent?.({})}
          {children}
        </View>
      );
    },
    BottomSheetScrollView: View,
    BottomSheetTextInput: TextInput,
    BottomSheetBackdrop: ({ onPress }: any) => (
      <Pressable accessibilityLabel="Backdrop" onPress={onPress}>
        <Text>Backdrop</Text>
      </Pressable>
    ),
  };
});
jest.mock("../../../hooks/review-reply/useReviewReplies", () => ({
  useCreateReviewReply: () => ({
    mutateAsync: mockCreateReply,
    isPending: false,
  }),
  useUpdateReviewReply: () => ({
    mutateAsync: mockUpdateReply,
    isPending: false,
  }),
}));
jest.mock("../../../hooks/reply-templates/useReplyTemplates", () => ({
  useReplyTemplates: () => ({
    templates: [],
    isLoading: false,
    refetch: jest.fn(),
    createTemplateAsync: mockCreateTemplate,
    updateTemplateAsync: mockUpdateTemplate,
    isCreating: false,
    isUpdating: false,
  }),
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ visible, title, onConfirm, onCancel }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          <Pressable onPress={onCancel}>
            <Text>Keep Editing</Text>
          </Pressable>
          <Pressable onPress={onConfirm}>
            <Text>Discard</Text>
          </Pressable>
        </View>
      ) : null,
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPicker",
  () => ({ pickBusinessPhotos: jest.fn() }),
);

const review = {
  id: 7,
  author: { first_name: "Ana", last_name: "Cruz" },
  reply: {
    id: 9,
    text: "Thanks for visiting.",
    photos: [{ id: 44, photo_url: "https://example.com/photo.jpg" }],
  },
} as any;
const template = {
  id: 3,
  title: "Thanks",
  text: "Thanks for visiting our store.",
} as any;
function ref() {
  return {
    current: { dismiss: jest.fn(), snapToIndex: jest.fn(), present: jest.fn() },
  } as any;
}

describe("Merchant composer draft and save reliability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens an existing reply pristine and dismisses it without warning", async () => {
    const sheetRef = ref();
    const screen = await render(
      <MerchantReviewReplyComposerSheet
        businessId={1}
        review={review}
        sheetRef={sheetRef}
        onDismiss={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText("Backdrop"));
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard reply?")).toBeNull();
  });

  it("protects text and photo removals through backdrop and pan dismissal", async () => {
    const sheetRef = ref();
    const screen = await render(
      <MerchantReviewReplyComposerSheet
        businessId={1}
        review={review}
        sheetRef={sheetRef}
        onDismiss={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText("Remove photo"));
    await fireEvent.changeText(
      screen.getByDisplayValue(review.reply.text),
      "A revised reply.",
    );
    await fireEvent.press(screen.getByLabelText("Backdrop"));
    await fireEvent.press(screen.getByText("Keep Editing"));
    expect(screen.getByDisplayValue("A revised reply.")).toBeTruthy();
    expect(screen.queryByLabelText("Remove photo")).toBeNull();
    await act(() => mockSheetProps.onChange(-1));
    expect(sheetRef.current.present).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText("Discard"));
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("freezes a reply submission, blocks duplicates/dismissal, and retains a failed draft", async () => {
    let reject: (error: unknown) => void = () => {};
    mockUpdateReply.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const sheetRef = ref();
    const screen = await render(
      <MerchantReviewReplyComposerSheet
        businessId={1}
        review={review}
        sheetRef={sheetRef}
        onDismiss={jest.fn()}
      />,
    );
    await fireEvent.changeText(
      screen.getByDisplayValue(review.reply.text),
      "A revised reply.",
    );
    await act(() => {
      void fireEvent.press(screen.getByLabelText("Save changes"));
    });
    expect(screen.getByDisplayValue("A revised reply.").props.editable).toBe(
      false,
    );
    await act(() => {
      void fireEvent.press(screen.getByLabelText("Save changes"));
    });
    await fireEvent.press(screen.getByLabelText("Backdrop"));
    expect(mockUpdateReply).toHaveBeenCalledTimes(1);
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    await act(() => reject({ success: false, message: "Try again." }));
    await waitFor(() =>
      expect(screen.getByDisplayValue("A revised reply.").props.editable).toBe(
        true,
      ),
    );
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    mockUpdateReply.mockResolvedValueOnce({});
    await act(() => {
      void fireEvent.press(screen.getByLabelText("Save changes"));
    });
    await waitFor(() =>
      expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1),
    );
    expect(mockUpdateReply.mock.lastCall?.[0].keepPhotoIds).toEqual([44]);
  });

  it("does not warn for an empty new template or an unchanged existing template", async () => {
    const first = ref();
    const screen = await render(
      <ReplyTemplateComposerSheet sheetRef={first} onDismiss={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(first.current.dismiss).toHaveBeenCalledTimes(1);
    await screen.unmount();
    const second = ref();
    const existing = await render(
      <ReplyTemplateComposerSheet
        sheetRef={second}
        template={template}
        onDismiss={jest.fn()}
      />,
    );
    await fireEvent.changeText(
      existing.getByDisplayValue(template.title),
      ` ${template.title} `,
    );
    await fireEvent.press(existing.getByLabelText("Backdrop"));
    expect(second.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps a new template draft after a pan attempt and discards only when approved", async () => {
    const sheetRef = ref();
    const screen = await render(
      <ReplyTemplateComposerSheet sheetRef={sheetRef} onDismiss={jest.fn()} />,
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Thank you"),
      "My response",
    );
    await act(() => mockSheetProps.onChange(-1));
    await fireEvent.press(screen.getByText("Keep Editing"));
    expect(screen.getByDisplayValue("My response")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close"));
    await fireEvent.press(screen.getByText("Discard"));
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("locks template fields until success and dismisses exactly once", async () => {
    let complete: () => void = () => {};
    mockUpdateTemplate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const sheetRef = ref();
    const screen = await render(
      <ReplyTemplateComposerSheet
        sheetRef={sheetRef}
        template={template}
        onDismiss={jest.fn()}
      />,
    );
    await fireEvent.changeText(
      screen.getByDisplayValue(template.title),
      "Updated title",
    );
    await act(() => {
      void fireEvent.press(screen.getByLabelText("Save changes"));
    });
    expect(screen.getByDisplayValue("Updated title").props.editable).toBe(
      false,
    );
    expect(screen.getByDisplayValue(template.text).props.editable).toBe(false);
    await fireEvent.press(screen.getByLabelText("Backdrop"));
    await act(() => {
      void fireEvent.press(screen.getByLabelText("Save changes"));
    });
    expect(mockUpdateTemplate).toHaveBeenCalledTimes(1);
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    await act(() => complete());
    await waitFor(() =>
      expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByDisplayValue("Updated title").props.editable).toBe(
      false,
    );
  });

  it("preserves a failed template edit and re-enables its fields", async () => {
    mockUpdateTemplate.mockRejectedValueOnce({
      success: false,
      message: "Offline",
    });
    const sheetRef = ref();
    const screen = await render(
      <ReplyTemplateComposerSheet
        sheetRef={sheetRef}
        template={template}
        onDismiss={jest.fn()}
      />,
    );
    await fireEvent.changeText(
      screen.getByDisplayValue(template.title),
      "Keep this title",
    );
    await act(() => {
      void fireEvent.press(screen.getByLabelText("Save changes"));
    });
    await waitFor(() => expect(mockUpdateTemplate).toHaveBeenCalledTimes(1));
    expect(screen.getByDisplayValue("Keep this title").props.editable).toBe(
      true,
    );
    expect(screen.getByDisplayValue(template.text)).toBeTruthy();
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
  });
});
