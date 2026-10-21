import { fireEvent, render } from "@testing-library/react-native";
import ReviewOperatingHours from "../review/sections/ReviewOperatingHours";
import { DAYS } from "../../../constants/operatingHours.constants";
import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";

function makeForm() {
  return {
    operatingHours: Object.fromEntries(
      DAYS.map((day, index) => [
        day,
        {
          isOpen: index < 5,
          is24Hours: false,
          openTime: "08:00",
          closeTime: "17:00",
        },
      ]),
    ),
  } as MerchantRegistrationForm;
}

it("keeps every day separate even with matching schedules and preserves editing", async () => {
  const onEdit = jest.fn();
  const screen = await render(
    <ReviewOperatingHours form={makeForm()} onEdit={onEdit} />,
  );
  for (const day of DAYS) {
    expect(
      screen.getByText(day.charAt(0).toUpperCase() + day.slice(1)),
    ).toBeTruthy();
  }
  expect(screen.getByText("Sunday")).toBeTruthy();
  expect(screen.getAllByText("8:00 AM – 5:00 PM")).toHaveLength(5);
  expect(screen.getAllByText("Closed")).toHaveLength(2);
  await fireEvent.press(screen.getByText("Edit"));
  expect(onEdit).toHaveBeenCalledTimes(1);
});

it("keeps distinct and 24-hour schedules separate", async () => {
  const form = makeForm();
  form.operatingHours.wednesday.is24Hours = true;
  form.operatingHours.sunday.openTime = "09:00";
  const screen = await render(<ReviewOperatingHours form={form} />);
  expect(screen.getByText("Monday")).toBeTruthy();
  expect(screen.getByText("Wednesday")).toBeTruthy();
  expect(screen.getByText("Friday")).toBeTruthy();
  expect(screen.getByText("Open 24 hours")).toBeTruthy();
  expect(screen.getByText("Saturday")).toBeTruthy();
  expect(screen.getByText("Sunday")).toBeTruthy();
});
