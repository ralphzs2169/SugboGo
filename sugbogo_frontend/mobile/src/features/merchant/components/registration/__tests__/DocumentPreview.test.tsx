import { fireEvent, render } from "@testing-library/react-native";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Linking } from "react-native";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";
import type { z } from "zod";

import Button from "@/shared/components/Button";
import ImagePreviewModal from "@/shared/components/modals/ImagePreviewModal";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import type { BusinessDocument } from "../../../types/registration/registrationOption.types";
import type { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import DocumentPreview from "../verification-documents/DocumentPreview";
import DocumentUploadCard from "../verification-documents/DocumentUploadCard";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("../verification-documents/DocumentPicker", () => ({
  pickBusinessDocuments: jest.fn(),
}));
jest.mock("@/shared/components/modals/ImagePreviewModal", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const pdf: BusinessDocument = {
  uri: "file:///cache/private-permit.pdf",
  fileName: "Permit.pdf",
  mimeType: "application/pdf",
};
const inspectForm = jest.fn();

function DocumentForm({ document }: { document: BusinessDocument }) {
  const form = useForm<z.input<typeof merchantRegistrationSchema>>({
    defaultValues: {
      ...MERCHANT_REGISTRATION_DEFAULT_VALUES,
      verificationDocuments: {
        ...MERCHANT_REGISTRATION_DEFAULT_VALUES.verificationDocuments,
        businessRegistration: document,
      },
    },
  });
  const selectedDocument = useWatch({
    control: form.control,
    name: "verificationDocuments.businessRegistration",
  });
  return (
    <FormProvider {...form}>
      <DocumentUploadCard
        document={selectedDocument}
        onDocumentChange={(value) =>
          form.setValue("verificationDocuments.businessRegistration", value, {
            shouldDirty: true,
          })
        }
      />
      <Button
        title="Inspect form"
        onPress={() => {
          inspectForm(form.getValues(), form.formState.isDirty);
        }}
      />
    </FormProvider>
  );
}

describe("document preview recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("hands a cached local PDF to the installed sharing capability", async () => {
    const screen = await render(<DocumentPreview document={pdf} />);
    await fireEvent.press(screen.getByText(pdf.fileName!));
    expect(Sharing.isAvailableAsync).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      pdf.uri,
      expect.objectContaining({
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      }),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it.each(["rejected", "unavailable"])(
    "reports %s local handoff and preserves the selected document and form",
    async (failure) => {
      if (failure === "unavailable") {
        jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
      } else {
        jest
          .mocked(Sharing.shareAsync)
          .mockRejectedValue(new Error(`Native failure opening ${pdf.uri}`));
      }
      const screen = await render(<DocumentForm document={pdf} />);
      await fireEvent.press(screen.getByText(pdf.fileName!));
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          text1: "Unable to open document",
        }),
      );
      expect(JSON.stringify(jest.mocked(Toast.show).mock.calls)).not.toContain(
        pdf.uri,
      );
      expect(screen.getByText(pdf.fileName!)).toBeTruthy();
      await fireEvent.press(screen.getByText("Inspect form"));
      expect(inspectForm).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationDocuments: expect.objectContaining({
            businessRegistration: pdf,
          }),
        }),
        false,
      );
      if (failure === "unavailable") {
        expect(Sharing.shareAsync).not.toHaveBeenCalled();
      }
    },
  );

  it("keeps a persisted private URL on the existing remote-open path", async () => {
    const uri = "https://example.com/private/document.pdf?token=existing";
    const screen = await render(
      <DocumentPreview document={{ ...pdf, id: 8, uri }} showRemove={false} />,
    );
    await fireEvent.press(screen.getByText(pdf.fileName!));
    expect(Linking.openURL).toHaveBeenCalledWith(uri);
    expect(Sharing.isAvailableAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it.each([
    "content://provider/permit.pdf",
    "https://example.com/private/permit.pdf",
  ])(
    "catches rejected provider/remote opening without disclosing the URI: %s",
    async (uri) => {
      jest
        .mocked(Linking.openURL)
        .mockRejectedValue(new Error(`Cannot resolve ${uri}`));
      const screen = await render(
        <DocumentPreview document={{ ...pdf, uri }} />,
      );
      await fireEvent.press(screen.getByText(pdf.fileName!));
      expect(Linking.openURL).toHaveBeenCalledWith(uri);
      expect(Toast.show).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(jest.mocked(Toast.show).mock.calls)).not.toContain(
        uri,
      );
      expect(screen.getByText(pdf.fileName!)).toBeTruthy();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported URIs with recovery feedback", async () => {
    const screen = await render(
      <DocumentPreview document={{ ...pdf, uri: "unknown://document" }} />,
    );
    await fireEvent.press(screen.getByText(pdf.fileName!));
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledTimes(1);
  });

  it("keeps image documents in the existing image-preview modal", async () => {
    const document = {
      ...pdf,
      uri: "file:///cache/permit.png",
      mimeType: "image/png",
    };
    const screen = await render(<DocumentPreview document={document} />);
    await fireEvent.press(screen.getByText(pdf.fileName!));
    expect(ImagePreviewModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: true,
        uri: document.uri,
      }),
      undefined,
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
