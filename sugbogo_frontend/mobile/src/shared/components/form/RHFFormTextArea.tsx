import { Controller, useFormContext, FieldPath } from "react-hook-form";

import FormTextArea from "./FormTextArea";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type RHFFormTextAreaProps = {
  name: FieldPath<MerchantRegistrationForm>;
} & Omit<
  React.ComponentProps<typeof FormTextArea>,
  "value" | "onChangeText" | "error"
>;

/**
 * Connects FormTextArea to React Hook Form.
 */
export default function RHFFormTextArea({
  name,
  ...props
}: RHFFormTextAreaProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormTextArea
          {...props}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
        />
      )}
    />
  );
}
