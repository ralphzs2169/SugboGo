import { DAYS } from "../../constants/operatingHours.constants";
import { operatingHoursSchema } from "../../validation/operatingHours.schema";
import { mapBusinessHoursToForm } from "../mapBusinessHoursToForm.utils";
import { buildHoursPayload } from "../operatingHours.utils";

const approved = DAYS.map((day) => ({
  day,
  is_open: true,
  is_24_hours: false,
  open_time: "08:00:00",
  close_time: "17:00:00",
}));

describe("shared operating hours", () => {
  it("initializes approved hours and submits all seven days", () => {
    const form = mapBusinessHoursToForm(approved);

    expect(form.monday).toEqual({
      isOpen: true,
      is24Hours: false,
      openTime: "08:00",
      closeTime: "17:00",
    });
    expect(buildHoursPayload(form).hours).toHaveLength(7);
    expect(buildHoursPayload(form).hours[0]).toEqual({
      day: "monday",
      is_open: true,
      is_24_hours: false,
      open_time: "08:00",
      close_time: "17:00",
    });
  });

  it("keeps overnight hours valid and rejects equal times or no open day", () => {
    const form = mapBusinessHoursToForm(approved);
    form.monday.openTime = "22:00";
    form.monday.closeTime = "02:00";
    expect(operatingHoursSchema.safeParse(form).success).toBe(true);

    form.monday.closeTime = "22:00";
    expect(operatingHoursSchema.safeParse(form).success).toBe(false);

    for (const day of DAYS) {
      form[day].isOpen = false;
    }
    expect(operatingHoursSchema.safeParse(form).success).toBe(false);
  });
});
