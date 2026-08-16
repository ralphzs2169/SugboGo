import { Controller, FieldPathByValue, useFormContext } from "react-hook-form";

import FormSelect from "./FormSelect";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type SelectOption = {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof FormSelect>["icon"];
};

type RHFFormSelectProps = {
  name: FieldPathByValue<MerchantRegistrationForm, string>;
  onSelectPress: () => void;
  options?: SelectOption[];
} & Omit<
  React.ComponentProps<typeof FormSelect>,
  "value" | "onPress" | "error"
>;

/**
 * Connects FormSelect to React Hook Form for string-based select fields.
 *
 * Resolves the stored form value to its corresponding option label and
 * optional icon while keeping the option value as the form value.
 *
 * Clears the field's validation error when the user opens the selector.
 */
export default function RHFFormSelect({
  name,
  onSelectPress,
  options = [],
  ...props
}: RHFFormSelectProps) {
  const { control, clearErrors } = useFormContext<MerchantRegistrationForm>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedOption = options.find(
          (option) => option.value === field.value,
        );

        const handlePress = () => {
          clearErrors(name);
          onSelectPress();
        };

        return (
          <FormSelect
            {...props}
            value={selectedOption?.label}
            icon={selectedOption?.icon}
            error={fieldState.error?.message}
            onPress={handlePress}
          />
        );
      }}
    />
  );
}
