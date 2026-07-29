import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '@/shared/components/BrandLogo';

interface TopNavBarProps {
  showBackButton?: boolean;
  onNotificationPress?: () => void;
}

export default function TopNavBar({
  showBackButton = true,
  onNotificationPress,
}: TopNavBarProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between bg-surface px-screen-x py-md">
      {showBackButton ? (
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 24 }} />
      )}

      <BrandLogo size="sm" />

      <TouchableOpacity onPress={onNotificationPress}>
        <Ionicons name="notifications-outline" size={22} color="#1A1A1A" />
      </TouchableOpacity>
    </View>
  );
}