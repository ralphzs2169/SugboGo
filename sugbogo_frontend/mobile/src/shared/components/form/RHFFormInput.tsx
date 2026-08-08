import { Controller, FieldPathByValue, useFormContext } from "react-hook-form";

import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import FormInput from "./FormInput";

type RHFFormInputProps = {
  name: FieldPathByValue<MerchantRegistrationForm, string>;
  helperText?: string;
  showError?: boolean;
} & Omit<
  React.ComponentProps<typeof FormInput>,
  "value" | "onChangeText" | "error"
>;

/**
 * Connects FormInput to React Hook Form.
 *
 * Restricts the field name to fields whose form values are strings,
 * ensuring the value is compatible with the underlying TextInput.
 */
export default function RHFFormInput({
  name,
  showError = true,
  helperText,
  ...props
}: RHFFormInputProps) {
  const { control, clearErrors } = useFormContext<MerchantRegistrationForm>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormInput
          {...props}
          value={field.value}
          helperText={helperText}
          onChangeText={(value) => {
            field.onChange(value);
            clearErrors(name);
          }}
          onFocus={() => {
            clearErrors(name);
          }}
          onBlur={field.onBlur}
          error={showError ? fieldState.error?.message : undefined}
        />
      )}
    />
  );
}
