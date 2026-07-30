import { Controller, useFormContext, FieldPath } from "react-hook-form";

import FormSelect from "./FormSelect";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type RHFFormSelectProps = {
  name: FieldPath<MerchantRegistrationForm>;
} & Omit<
  React.ComponentProps<typeof FormSelect>,
  "value" | "onPress" | "error"
>;

/**
 * Connects FormSelect to React Hook Form.
 */
export default function RHFFormSelect({ name, ...props }: RHFFormSelectProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormSelect
          {...props}
          value={field.value}
          error={errors[name]?.message}
          onPress={() => {
            // We'll open the bottom sheet here later.
          }}
        />
      )}
    />
  );
}
