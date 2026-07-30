import {
  Controller,
  FieldPathByValue,
  get,
  useFormContext,
} from "react-hook-form";

import FormSelect from "./FormSelect";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type SelectOption = {
  label: string;
  value: string;
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
 * Resolves the stored form value to its corresponding option label so
 * the form can retain the option ID while displaying a human-readable name.
 */
export default function RHFFormSelect({
  name,
  onSelectPress,
  options = [],
  ...props
}: RHFFormSelectProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        // Keep the form value as the option ID while displaying its label.
        const selectedOption = options.find(
          (option) => option.value === field.value,
        );

        return (
          <FormSelect
            {...props}
            value={selectedOption?.label}
            error={get(errors, name)?.message}
            onPress={onSelectPress}
          />
        );
      }}
    />
  );
}
