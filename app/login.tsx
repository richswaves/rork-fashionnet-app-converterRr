import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";
import { useRouter } from "expo-router";
import { AlertTriangle } from "lucide-react-native";
import { sbSelect, getSupabase } from "@/integrations/supabase/client";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

interface ProfileRow { username?: string; user_id: string; email?: string | null }

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { login } = useProfile();
  const router = useRouter();
  const supabaseConfigured: boolean = !!getSupabase();

  const resolveEmailFromIdentifier = async (value: string): Promise<string> => {
    const trimmed = value.trim();
    if (trimmed.includes("@")) return trimmed.toLowerCase();
    try {
      const rows = await sbSelect<ProfileRow>("profiles", {
        select: "user_id,username,email",
        query: { username: `eq.${trimmed}` },
        limit: 1,
      });
      const email = rows[0]?.email ?? null;
      if (!email) throw new Error("No email linked to that username");
      return String(email).trim().toLowerCase();
    } catch (e) {
      console.error("resolveEmailFromIdentifier error", e);
      throw new Error("We couldn't find an email for that username. Try your full email address.");
    }
  };

  const handleLogin = async () => {
    const id = identifier.trim();
    const pwd = password.trim();
    if (!id || !pwd) {
      Alert.alert("Error", "Enter username or email and password");
      return;
    }

    setIsLoading(true);
    try {
      const email = await resolveEmailFromIdentifier(id);
      await login(email, pwd);
      router.replace("/(tabs)/opportunities");
    } catch (error: any) {
      console.error("Login error:", error);
      const msg = typeof error?.message === "string" ? error.message : undefined;
      const friendly =
        msg?.toLowerCase().includes("invalid login credentials")
          ? "Incorrect email or password. If you signed up with a social login or magic link, use that method or reset your password."
          : msg ?? "We couldn't sign you in. Please check your details and try again.";
      Alert.alert("Login Failed", friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in app settings.");
      return;
    }
    setIsLoading(true);
    try {
      WebBrowser.maybeCompleteAuthSession?.();
      const redirectTo = Platform.select<string | undefined>({
        web: typeof window !== "undefined" ? window.location.origin : undefined,
        default: Linking.createURL("/") ?? undefined,
      });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Google login error:", error);
      const msg = typeof error?.message === "string" ? error.message : "We couldn't start Google sign-in.";
      Alert.alert("Google Sign-in Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/h4pde2oatr513vougr9pr" }}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {!supabaseConfigured && (
            <View style={styles.warning} testID="supabase-missing-warning">
              <AlertTriangle size={18} color="#F59E0B" />
              <Text style={styles.warningText}>Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in app settings.</Text>
            </View>
          )}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username or Email</Text>
              <TextInput
                style={styles.input}
                placeholder="yourname or your@email.com"
                placeholderTextColor="#6B7280"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading && supabaseConfigured}
                testID="login-identifier"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading && supabaseConfigured}
                testID="login-password"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (isLoading || !supabaseConfigured) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              testID="login-submit"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.separatorRow}>
              <View style={styles.separator} />
              <Text style={styles.separatorText}>or</Text>
              <View style={styles.separator} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, (isLoading || !supabaseConfigured) && styles.buttonDisabled]}
              onPress={handleGoogleLogin}
              disabled={isLoading}
              testID="login-google"
            >
              <Image
                source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 280,
    height: 120,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  form: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#E5E7EB",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1F1F28",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2D2D3A",
  },
  button: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  separatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 16,
  },
  separator: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2D2D3A",
  },
  separatorText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  googleBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  googleText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2A1E0A",
    borderColor: "#3F2A0F",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  warningText: {
    color: "#F59E0B",
    flex: 1,
  },
});
