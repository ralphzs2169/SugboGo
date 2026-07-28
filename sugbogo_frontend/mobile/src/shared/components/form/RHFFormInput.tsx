import { Controller, FieldPath, useFormContext } from "react-hook-form";

import FormInput from "./FormInput";
import { MerchantRegistrationForm } from "@/features/merchant/types/merchantRegistration.types";

type RHFFormInputProps = {
  name: FieldPath<MerchantRegistrationForm>;
} & Omit<
  React.ComponentProps<typeof FormInput>,
  "value" | "onChangeText" | "error"
>;

/**
 * Connects FormInput to React Hook Form.
 */
export default function RHFFormInput({ name, ...props }: RHFFormInputProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormInput
          {...props}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message as string | undefined}
        />
      )}
    />
  );
}
