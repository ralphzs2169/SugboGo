import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import Toast from "react-native-toast-message";
import ReviewDisputeEvidenceSection from "../dispute-detail-screen/ReviewDisputeEvidenceSection";
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").View,
}));
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => () => null);
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
test("document open rejection shows actionable feedback, retains evidence and allows retry", async () => {
  const open = jest
    .spyOn(Linking, "openURL")
    .mockRejectedValueOnce(new Error("No handler"))
    .mockResolvedValueOnce(undefined);
  const screen = await render(
    <ReviewDisputeEvidenceSection
      evidence={[
        {
          id: 1,
          type: "document",
          file_name: "receipt.pdf",
          url: "https://example.com/receipt.pdf",
          created_at: "2026-01-01",
        },
      ]}
      isPending={false}
      remainingSlots={4}
      isAddingEvidence={false}
      isDeletingEvidence={false}
      isPickingImages={false}
      isPickingDocuments={false}
      onPickImages={jest.fn()}
      onPickDocuments={jest.fn()}
      onRequestDelete={jest.fn()}
    />,
  );
  await fireEvent.press(
    screen.getAllByRole("button", { name: "Open receipt.pdf" })[0],
  );
  await waitFor(() =>
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Unable to open document" }),
    ),
  );
  expect(screen.getByText("receipt.pdf")).toBeTruthy();
  await fireEvent.press(
    screen.getAllByRole("button", { name: "Open receipt.pdf" })[0],
  );
  expect(open).toHaveBeenCalledTimes(2);
  open.mockRestore();
});
