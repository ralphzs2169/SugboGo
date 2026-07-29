import { View, Text, Image } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';

export default function UserInfoCard() {
  const user = useAuthStore((state) => state.user);

  return (
    <View
      className="flex-row items-center rounded-card bg-surface p-md mx-screen-x mt-md"
      style={{ elevation: 2 }}
    >
      <Image
        source={require('@/assets/images/default-avatar.png')}
        className="h-14 w-14 rounded-full mr-md"
      />
      <View>
        <Text className="text-md font-bold text-text-primary">
          {user?.email ?? 'Explorer'}
        </Text>
        <Text className="text-body text-text-secondary capitalize">
          {user?.role ?? ''}
        </Text>
      </View>
    </View>
  );
}