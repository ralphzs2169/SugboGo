import { Switch, Text, View } from "react-native";

type Props = {
  title: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
};

export default function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: Props) {
  return (
    <View className="flex-row items-center justify-between rounded-xl bg-surface p-4">
      <View className="flex-1 pr-4">
        <Text className="text-base font-semibold text-text">{title}</Text>

        {description && (
          <Text className="mt-1 text-sm text-gray-500">{description}</Text>
        )}
      </View>

      {value !== undefined && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        />
      )}
    </View>
  );
}
