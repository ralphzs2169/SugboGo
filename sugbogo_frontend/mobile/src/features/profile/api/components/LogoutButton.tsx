import { TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clearSession } from '@/features/auth/utils/authSession';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await clearSession();
    router.replace('/(auth)/login');
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      className="flex-row items-center py-md"
    >
      <MaterialCommunityIcons name="logout" size={18} color="#DC2626" />
      <Text className="ml-sm text-body font-bold text-error">
        LOGOUT
      </Text>
    </TouchableOpacity>
  );
}