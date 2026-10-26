import { act, fireEvent, render } from "@testing-library/react-native";
import { FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";

import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import RHFFormInput from "@/shared/components/form/RHFFormInput";
import RHFFormSelect from "@/shared/components/form/RHFFormSelect";
import RHFFormTextArea from "@/shared/components/form/RHFFormTextArea";
import PhotoGrid from "../business-photos/PhotoGrid";
import DocumentUploadCard from "../verification-documents/DocumentUploadCard";
import { pickBusinessPhotos } from "../business-photos/PhotoPicker";
import { pickBusinessDocuments } from "../verification-documents/DocumentPicker";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../business-photos/PhotoPicker", () => ({
  pickBusinessPhotos: jest.fn(),
}));
jest.mock("../verification-documents/DocumentPicker", () => ({
  pickBusinessDocuments: jest.fn(),
}));
jest.mock("../business-photos/PhotoPreview", () => {
  const { Pressable } = jest.requireActual("react-native");
  return function Photo({ onRemove }: { onRemove?: () => void }) {
    return onRemove ? (
      <Pressable accessibilityLabel="Remove photo" onPress={onRemove} />
    ) : null;
  };
});
jest.mock("../verification-documents/DocumentPreview", () => {
  const { Pressable } = jest.requireActual("react-native");
  return function Document({ onRemove }: { onRemove?: () => void }) {
    return onRemove ? (
      <Pressable accessibilityLabel="Remove document" onPress={onRemove} />
    ) : null;
  };
});

const onPhotosChange = jest.fn();
const onDocumentChange = jest.fn();
const onSelect = jest.fn();

function Fields({ disabled }: { disabled: boolean }) {
  const form = useForm({
    defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
    disabled,
  });
  return (
    <FormProvider {...form}>
      <View>
        <RHFFormInput name="businessName" label="Name" placeholder="Name" />
        <RHFFormTextArea
          name="businessDescription"
          label="Description"
          placeholder="Description"
        />
        <RHFFormSelect
          name="representativeRole"
          label="Role"
          placeholder="Select role"
          onSelectPress={onSelect}
        />
        <PhotoGrid
          disabled={disabled}
          photos={[{ id: 1, uri: "https://example.com/existing.jpg" }]}
          maxPhotos={3}
          onPhotosChange={onPhotosChange}
        />
        <DocumentUploadCard
          document={{ id: 1, uri: "https://example.com/existing.pdf" }}
          onDocumentChange={onDocumentChange}
          maxDocuments={2}
        />
      </View>
    </FormProvider>
  );
}

describe("registration save lock controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("disables RHF inputs, selection, photo and document changes, then restores editing", async () => {
    const screen = await render(<Fields disabled />);
    expect(screen.getByPlaceholderText("Name").props.editable).toBe(false);
    expect(screen.getByPlaceholderText("Description").props.editable).toBe(
      false,
    );
    await fireEvent.changeText(screen.getByPlaceholderText("Name"), "Blocked");
    await fireEvent.press(screen.getByText("Select role"));
    await fireEvent.press(screen.getByText("Add Photo"));
    await fireEvent.press(screen.getByText("Add Another Document"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(pickBusinessPhotos).not.toHaveBeenCalled();
    expect(pickBusinessDocuments).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Remove photo")).toBeNull();
    expect(screen.queryByLabelText("Remove document")).toBeNull();
    await screen.rerender(<Fields disabled={false} />);
    expect(screen.getByPlaceholderText("Name").props.editable).toBe(true);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Name"),
      "Retry Cafe",
    );
    expect(screen.getByDisplayValue("Retry Cafe")).toBeTruthy();
    await fireEvent.press(screen.getByText("Select role"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Remove photo")).toBeTruthy();
    expect(screen.getByLabelText("Remove document")).toBeTruthy();
  });

  it.each(["photo", "document"])(
    "ignores a delayed %s selection after persistence locks the form",
    async (kind) => {
      let finish!: (value: { uri: string }[]) => void;
      const picker = new Promise<{ uri: string }[]>((resolve) => {
        finish = resolve;
      });
      (kind === "photo"
        ? jest.mocked(pickBusinessPhotos)
        : jest.mocked(pickBusinessDocuments)
      ).mockReturnValueOnce(picker);
      const screen = await render(<Fields disabled={false} />);
      await fireEvent.press(
        screen.getByText(
          kind === "photo" ? "Add Photo" : "Add Another Document",
        ),
      );
      await screen.rerender(<Fields disabled />);
      await act(async () => {
        finish([{ uri: "file:///late-selection" }]);
      });
      expect(onPhotosChange).not.toHaveBeenCalled();
      expect(onDocumentChange).not.toHaveBeenCalled();
    },
  );
});
