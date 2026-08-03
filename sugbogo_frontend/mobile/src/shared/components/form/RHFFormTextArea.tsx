import { Controller, FieldPathByValue, useFormContext } from "react-hook-form";

import FormTextArea from "./FormTextArea";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type RHFFormTextAreaProps = {
  name: FieldPathByValue<MerchantRegistrationForm, string>;
} & Omit<
  React.ComponentProps<typeof FormTextArea>,
  "value" | "onChangeText" | "error"
>;

/**
 * Connects FormTextArea to React Hook Form for string-based fields.
 *
 * Clears the field's validation error when the user starts editing it.
 */
export default function RHFFormTextArea({
  name,
  ...props
}: RHFFormTextAreaProps) {
  const { control, clearErrors } = useFormContext<MerchantRegistrationForm>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormTextArea
          {...props}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            clearErrors(name);
          }}
          onFocus={() => {
            clearErrors(name);
          }}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
