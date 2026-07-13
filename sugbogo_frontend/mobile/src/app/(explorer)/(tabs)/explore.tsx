import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Explore() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      {/* Top Bar */}
      <View className="flex-row justify-end px-4 pt-12">
        <TouchableOpacity
          className="flex-row items-center gap-1"
          onPress={() => router.push('/(auth)/login')}
        >
          <Ionicons name="log-out-outline" size={20} color="#F27F0D" />
          <Text className="text-[13px] font-semibold text-[#F27F0D]">
            Go Back
          </Text>
        </TouchableOpacity>
      </View>

      {/* Center Content */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold text-gray-900">Explore</Text>
      </View>
    </View>
  );
}