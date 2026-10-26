import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import Button from "@/shared/components/Button";
import { DAYS } from "../../../constants/operatingHours.constants";
import {
  operatingHoursSchema,
  type OperatingHoursForm,
} from "../../../validation/operatingHours.schema";
import OperatingHoursStep from "../steps/OperatingHoursStep";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@react-native-community/datetimepicker", () => () => null);

const onContinue = jest.fn();
const schema = z.object({ operatingHours: operatingHoursSchema });

function HoursForm() {
  const form = useForm<OperatingHoursForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      operatingHours: Object.fromEntries(
        DAYS.map((day) => [
          day,
          {
            isOpen: false,
            is24Hours: false,
            openTime: "",
            closeTime: "",
          },
        ]),
      ) as OperatingHoursForm["operatingHours"],
    },
  });
  return (
    <FormProvider {...form}>
      <OperatingHoursStep
        registerErrorScrollTarget={() => ({
          ref: () => {},
          onLayout: () => {},
        })}
      />
      <Button
        title="Continue"
        onPress={() => void form.handleSubmit(onContinue)()}
      />
    </FormProvider>
  );
}

describe("registration operating-hours validation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps all-closed guidance inline until corrected and allows a valid 24-hour day", async () => {
    const screen = await render(<HoursForm />);
    await fireEvent.press(screen.getByText("Continue"));
    expect(screen.getByText("At least one day must be open.")).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Edit monday hours"));
    expect(screen.getByText("At least one day must be open.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    await fireEvent.press(screen.getByText("Open 24 hours"));
    await waitFor(() =>
      expect(screen.queryByText("At least one day must be open.")).toBeNull(),
    );
    await fireEvent.press(screen.getByText("Continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({
        operatingHours: expect.objectContaining({
          monday: expect.objectContaining({ isOpen: true, is24Hours: true }),
        }),
      }),
      undefined,
    );
  });
});
