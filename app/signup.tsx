import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getSupabase, sbInsert, sbUpsert } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

export default function SignupScreen() {
  const router = useRouter();
  const { updateProfileAsync } = useProfile();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.trim().length >= 6;
  }, [email, password]);

  const onSubmit = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured.");
      return;
    }
    if (!canSubmit) {
      Alert.alert("Incomplete", "Enter a valid email and a 6+ character password.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: {
          data: fullName.trim().length > 0 ? { full_name: fullName.trim() } : undefined,
        },
      });
      if (error) throw error;
      const userId = data.user?.id as string | undefined;
      if (!userId) {
        Alert.alert("Sign up", "Check your email to confirm your account.");
        return;
      }

      try {
        await updateProfileAsync({
          user_id: userId,
          full_name: fullName.trim() || undefined,
          account_status: "pending",
          is_profile_updated: false,
        } as any);
      } catch (e) {
        console.log("Profile upsert after signup failed", e);
      }

      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        await sbInsert("onboarding_step_events", {
          session_id: sessionId,
          user_id: userId,
          step_number: 1,
          step_name: "auth_screen",
          event_type: "complete",
        } as any);
      } catch (e) {
        console.log("Failed to record onboarding event", e);
      }

      router.replace("/onboarding/profile-setup" as any);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Failed to sign up";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={{ gap: 16 }}>
          <Text style={styles.title}>Create your account</Text>
          <TextInput
            testID="signup-fullname"
            placeholder="Full name (optional)"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            testID="signup-email"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            testID="signup-password"
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
        </View>
        <TouchableOpacity
          testID="signup-submit"
          style={[styles.primaryBtn, { opacity: loading || !canSubmit ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={loading || !canSubmit}
        >
          <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Sign up"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { flex: 1, padding: 20, gap: 24, justifyContent: "space-between" },
  title: { color: "#F9FAFB", fontSize: 28, fontWeight: "700" as const },
  input: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
    borderWidth: 1,
    color: "#F9FAFB",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
  },
  primaryBtnText: { color: "#111827", fontSize: 17, fontWeight: "700" as const },
});
