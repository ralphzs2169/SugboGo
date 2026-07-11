import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

export default function Register() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Demo-only mock rules (keeps parity with existing login.tsx)
  const MOCK_EMAIL = 'sugbogo@gmail.com';
  const MOCK_PASSWORD = 'sugbogo123';

  const handleRegister = () => {
    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    // Demo success path
    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
      setErrorMsg('');
      router.push('/(auth)/login');
    } else {
      setErrorMsg('Registration failed (demo). Please use the mock email/password.');
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        className="flex-1 bg-[#F5F5F5]"
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-6">
          <Image
            source={require('../../../assets/images/sugbogo-logo-small.png')}
            className="mb-2 h-[70px] w-[70px]"
            resizeMode="contain"
          />
          <Text className="text-[32px] font-bold tracking-[0.5px]">
            <Text className="text-[#1A1A1A]">Sugbo</Text>
            <Text className="text-[#F27F0D]">Go</Text>
          </Text>
          <Text className="mt-1 text-[13px] text-[#666]">Discover the Hidden Gems of Cebu.</Text>
        </View>

        <View style={styles.card} className="w-full rounded-[16px] bg-white p-6">
          <Text className="mb-6 text-[20px] font-bold text-[#1A1A1A] text-center">Create your Account</Text>

          <View className="mb-4">
            <Text className="mb-1.5 text-[11px] font-bold tracking-[0.5px] text-[#444]">FULL NAME</Text>
            <TextInput
              className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-[14px] py-[14px] text-[14px] text-[#333]"
              placeholder="Enter your full name"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1.5 text-[11px] font-bold tracking-[0.5px] text-[#444]">EMAIL ADDRESS</Text>
            <TextInput
              className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-[14px] py-[14px] text-[14px] text-[#333]"
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <View className="mb-1.5 flex-row items-center">
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#444]">PASSWORD</Text>
            </View>
            <View className="flex-row items-center rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-[14px]">
              <TextInput
                className="flex-1 py-[14px] text-[14px] text-[#333]"
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-5">
            <View className="mb-1.5 flex-row items-center">
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#444]">CONFIRM PASSWORD</Text>
            </View>
            <View className="flex-row items-center rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-[14px]">
              <TextInput
                className="flex-1 py-[14px] text-[14px] text-[#333]"
                placeholder="Confirm your password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
          </View>

          {errorMsg ? <Text className="mb-3 text-[12px] font-semibold text-[#DC2626]">{errorMsg}</Text> : null}

          <TouchableOpacity
  className="mb-5 mt-2 flex-row items-center justify-center rounded-lg bg-[#F27F0D] px-4 py-4"
  onPress={handleRegister}
>
  <Text className="mr-2 text-[16px] font-bold text-white">Create Account</Text>
  <MaterialIcons name="keyboard-arrow-right" size={20} color="white" />
</TouchableOpacity>

          <View className="mb-5 flex-row items-center">
            <View style={styles.dividerLine} />
            <Text className="mx-3 text-[11px] font-semibold tracking-[0.5px] text-[#999]">OR SIGN UP WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View className="flex-row justify-center">
            <TouchableOpacity style={styles.oauthBtn} className="mr-4" aria-label="Continue with Google">
                          <Image
                            source={require('../../../icons/google-logo.png')}
                            style={{ width: 26, height: 26, resizeMode: 'contain' }}
                          />
                        </TouchableOpacity>

            <TouchableOpacity style={[styles.oauthBtn, styles.facebookBtn]} className="mr-4">
              <Ionicons name="logo-facebook" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.oauthBtn, styles.appleBtn]}>
              <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-6 flex-row items-center">
          <Text className="text-[14px] text-[#666]">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-[14px] font-bold text-[#F27F0D]">Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  oauthBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facebookBtn: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  appleBtn: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
});

