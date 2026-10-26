import { fireEvent, render } from "@testing-library/react-native";

import RegistrationFooter from "../RegistartionFooter";

const actions = {
  onBack: jest.fn(),
  onNext: jest.fn(),
  onSaveAndReview: jest.fn(),
};

it("shows pending changes and clears the indicator when saved or reverted", async () => {
  const screen = await render(
    <RegistrationFooter
      {...actions}
      currentStep={2}
      totalSteps={6}
      isResubmission={false}
      hasChanges
    />,
  );
  expect(screen.getByText("You have unsaved changes")).toBeTruthy();
  await fireEvent.press(screen.getByText("Save & Continue"));
  expect(actions.onNext).toHaveBeenCalledTimes(1);

  await screen.rerender(
    <RegistrationFooter
      {...actions}
      currentStep={2}
      totalSteps={6}
      isResubmission={false}
      hasChanges={false}
    />,
  );
  expect(screen.queryByText("You have unsaved changes")).toBeNull();
});

it("preserves the edit action while displaying the same draft indicator", async () => {
  const screen = await render(
    <RegistrationFooter
      {...actions}
      currentStep={2}
      totalSteps={6}
      isResubmission={false}
      isEditing
      hasChanges
    />,
  );
  expect(screen.getByText("You have unsaved changes")).toBeTruthy();
  await fireEvent.press(screen.getByText("Save & Review"));
  expect(actions.onSaveAndReview).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Back")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back to Review" }));
  expect(actions.onBack).toHaveBeenCalledTimes(1);
});

it("blocks final submission while review-visible work is unsaved", async () => {
  const screen = await render(
    <RegistrationFooter
      {...actions}
      currentStep={6}
      totalSteps={6}
      isResubmission={false}
      hasChanges
    />,
  );
  expect(
    screen.getByRole("button", { name: "Submit Application" }),
  ).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Submit Application" }),
  );
  expect(actions.onNext).not.toHaveBeenCalled();
});
