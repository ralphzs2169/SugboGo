import { useEffect } from "react";
import { fireEvent, render, within } from "@testing-library/react-native";
import { FormProvider, useForm } from "react-hook-form";

import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import type { SpecialtyTagOption } from "../../../types/registration/registrationOption.types";
import SpecialtyTagsSection from "../specialty-tags/SpecialtyTagsSection";

const taxonomy: SpecialtyTagOption[] = Array.from(
  { length: 18 },
  (_, index) => ({
    id: index + 1,
    name: `Specialty ${index + 1}`,
    color: "blue",
    icon: "coffee",
  }),
);
let mockTaxonomy = {
  specialtyTags: taxonomy,
  isLoading: false,
  error: null as Error | null,
  refetch: jest.fn(),
};

jest.mock("../../../hooks/registration/useSpecialtyTags", () => ({
  __esModule: true,
  default: () => mockTaxonomy,
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, ScrollView, Pressable, Text } =
    jest.requireActual("react-native");
  return {
    BottomSheetScrollView: ScrollView,
    BottomSheetBackdrop: () => null,
    BottomSheetModal: React.forwardRef(function Sheet(
      {
        children,
        onDismiss,
      }: { children: React.ReactNode; onDismiss: () => void },
      ref,
    ) {
      const [open, setOpen] = React.useState(false);
      const dismiss = () => {
        setOpen(false);
        onDismiss();
      };
      React.useImperativeHandle(ref, () => ({
        present: () => setOpen(true),
        dismiss,
      }));
      return open ? (
        <View testID="specialty-picker">
          {children}
          <Pressable accessibilityLabel="Close tags" onPress={dismiss}>
            <Text>Close tags</Text>
          </Pressable>
        </View>
      ) : null;
    }),
  };
});

function Form({
  selected,
  disabled = false,
}: {
  selected: number[];
  disabled?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      ...MERCHANT_REGISTRATION_DEFAULT_VALUES,
      specialtyTags: selected,
    },
    disabled,
  });
  const { reset } = form;
  useEffect(() => {
    reset({ ...MERCHANT_REGISTRATION_DEFAULT_VALUES, specialtyTags: selected });
  }, [selected, reset]);
  return (
    <FormProvider {...form}>
      <SpecialtyTagsSection />
    </FormProvider>
  );
}

function visibleNames(screen: Awaited<ReturnType<typeof render>>) {
  return screen
    .getAllByRole("button")
    .map((button) => button.props.accessibilityLabel)
    .filter((label: string | undefined) => label?.startsWith("Specialty "));
}

describe("restored specialty visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaxonomy = {
      specialtyTags: taxonomy,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
  });

  it.each([
    [1, 2, 3],
    [12, 14, 17],
    [2, 12, 17],
  ])(
    "includes restored selections once and deterministically fills the visible window: %j",
    async (...selected) => {
      const screen = await render(<Form selected={selected} />);
      const expectedIds = [
        ...taxonomy
          .filter((tag) => selected.includes(tag.id))
          .map((tag) => tag.id),
        ...taxonomy
          .filter((tag) => !selected.includes(tag.id))
          .map((tag) => tag.id),
      ].slice(0, 10);
      expect(visibleNames(screen)).toEqual(
        expectedIds.map((id) => `Specialty ${id}`),
      );
      expect(new Set(visibleNames(screen)).size).toBe(10);
      expect(screen.getByText("3 of 3 selected")).toBeTruthy();
      for (const id of selected) {
        expect(
          screen.getByRole("button", {
            name: `Specialty ${id}`,
            selected: true,
          }),
        ).toBeTruthy();
      }
    },
  );

  it("shows saved selections restored after initial taxonomy rendering", async () => {
    const screen = await render(<Form selected={[]} />);
    await screen.rerender(<Form selected={[13, 15, 18]} />);
    for (const id of [13, 15, 18]) {
      expect(
        screen.getByRole("button", { name: `Specialty ${id}`, selected: true }),
      ).toBeTruthy();
    }
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
    expect(visibleNames(screen)).toHaveLength(10);
  });

  it("preserves positions on deselection and makes picker additions visible without duplicates", async () => {
    const selected = [12, 14, 17];
    const screen = await render(<Form selected={selected} />);
    const before = visibleNames(screen);
    await fireEvent.press(screen.getByRole("button", { name: "Specialty 14" }));
    expect(screen.getByText("2 of 3 selected")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Specialty 14", selected: false }),
    ).toBeTruthy();
    expect(visibleNames(screen)).toEqual(before);

    await fireEvent.press(screen.getByText("See all tags"));
    const picker = within(screen.getByTestId("specialty-picker"));
    await fireEvent.press(picker.getByRole("button", { name: "Specialty 18" }));
    await fireEvent.press(screen.getByLabelText("Close tags"));
    expect(
      screen.getByRole("button", { name: "Specialty 18", selected: true }),
    ).toBeTruthy();
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
    expect(screen.getAllByLabelText("Specialty 18")).toHaveLength(1);
    expect(visibleNames(screen)).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Specialty 1" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Specialty 1" }));
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
  });

  it("retains selected IDs through taxonomy failure and preserves visible order on refetch", async () => {
    const selected = [12, 14, 17];
    mockTaxonomy.specialtyTags = [];
    mockTaxonomy.error = new Error("Unavailable");
    const screen = await render(<Form selected={selected} />);
    expect(screen.queryByLabelText("Specialty 12")).toBeNull();
    mockTaxonomy = { ...mockTaxonomy, specialtyTags: taxonomy, error: null };
    await screen.rerender(<Form selected={selected} />);
    const before = visibleNames(screen);
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
    mockTaxonomy.specialtyTags = [...taxonomy]
      .reverse()
      .map((tag) => ({ ...tag }));
    await screen.rerender(<Form selected={selected} />);
    expect(visibleNames(screen)).toEqual(before);
    for (const id of selected) {
      expect(
        screen.getByRole("button", { name: `Specialty ${id}`, selected: true }),
      ).toBeTruthy();
    }
  });

  it("keeps every selected chip visible even when restored state exceeds the normal window", async () => {
    const selected = taxonomy.slice(0, 12).map((tag) => tag.id);
    const screen = await render(<Form selected={selected} />);
    expect(visibleNames(screen)).toHaveLength(12);
    for (const id of selected) {
      expect(
        screen.getByRole("button", { name: `Specialty ${id}`, selected: true }),
      ).toBeTruthy();
    }
  });

  it("keeps restored chips visible while persistence locks prevent changes", async () => {
    const selected = [12, 14, 17];
    const screen = await render(<Form selected={selected} disabled />);
    await fireEvent.press(screen.getByRole("button", { name: "Specialty 12" }));
    await fireEvent.press(screen.getByText("See all tags"));
    expect(
      screen.getByRole("button", { name: "Specialty 12", selected: true }),
    ).toBeDisabled();
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
    expect(screen.queryByTestId("specialty-picker")).toBeNull();
  });
});
