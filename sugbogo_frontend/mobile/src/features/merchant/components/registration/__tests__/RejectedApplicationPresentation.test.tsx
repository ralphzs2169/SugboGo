import { render } from "@testing-library/react-native";
import RejectedApplicationSection from "../../portal/RejectedApplicationSection";
import type { ApplicationFeedbackResponse } from "../../../types/registration/registrationApi.types";

jest.mock("lottie-react-native", () => () => null);
const disposition = {
  review_id: 9,
  explanation: "This establishment is already represented.",
  reconsidered: false,
  reconsideration_explanation: null,
};
const feedback = [
  {
    section: "identity",
    message: "Correct the phone number.",
    is_changed: false,
  },
] as ApplicationFeedbackResponse[];
it("shows duplicate rejection and immediate resubmission guidance without empty feedback", async () => {
  const screen = await render(
    <RejectedApplicationSection
      feedback={[]}
      reviewedAt="Today"
      duplicateDisposition={disposition}
    />,
  );
  expect(screen.getByText(disposition.explanation)).toBeTruthy();
  expect(screen.getByText(/You may review and resubmit/)).toBeTruthy();
  expect(screen.queryByText("Administrator Feedback")).toBeNull();
  expect(screen.queryByText(/reconsideration is required/)).toBeNull();
});
it("shows ordinary feedback and correction progress in combined rejection", async () => {
  const screen = await render(
    <RejectedApplicationSection
      feedback={feedback}
      reviewedAt="Today"
      duplicateDisposition={disposition}
    />,
  );
  expect(screen.getByText(disposition.explanation)).toBeTruthy();
  expect(screen.getByText(feedback[0].message)).toBeTruthy();
  expect(screen.getByText("Changes still required")).toBeTruthy();
});
it("keeps ordinary rejection focused on corrections", async () => {
  const screen = await render(
    <RejectedApplicationSection feedback={feedback} reviewedAt="Today" />,
  );
  expect(screen.getByText(feedback[0].message)).toBeTruthy();
  expect(screen.queryByText("Reason: Duplicate Registration")).toBeNull();
});
