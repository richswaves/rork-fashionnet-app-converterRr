import React, { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getSupabase } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import { creativeRoles, businessRoles, roleQuestions } from "@/constants/onboarding";

export default function SignupScreen() {
  const router = useRouter();
  const { updateProfileAsync } = useProfile();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [userType, setUserType] = useState<"creative" | "business" | undefined>(undefined);
  const [role, setRole] = useState<string | undefined>(undefined);

  const sessionIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const hasQuestions = useMemo(() => {
    if (!role) return false;
    return (roleQuestions[role] ?? []).length > 0;
  }, [role]);

  const canSubmit = useMemo(() => {
    const baseValid = email.trim().length > 3 && password.trim().length >= 6;
    const onboardingReady = !!userType && !!role;
    return baseValid && onboardingReady;
  }, [email, password, userType, role]);

  const onSubmit = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured.");
      return;
    }
    if (!canSubmit) {
      Alert.alert("Incomplete", "Please fill out all fields.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: { data: fullName.trim().length > 0 ? { full_name: fullName.trim() } : undefined },
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
          profession: role,
        } as any);
      } catch (e) {
        console.log("Profile upsert after signup failed", e);
      }

      if (hasQuestions) {
        router.replace({ pathname: "/onboarding/question", params: { role: String(role), userType: String(userType), i: "0", sid: sessionIdRef.current } } as any);
      } else {
        router.replace("/onboarding/pending-approval" as any);
      }
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Failed to sign up";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 16 }}>
          <Text style={styles.title}>Create your account</Text>
          <TextInput
            testID="signup-fullname"
            placeholder="Full name"
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>You are joining as</Text>
          <View style={styles.row}>
            {( ["creative", "business"] as const ).map((t) => (
              <TouchableOpacity
                key={t}
                testID={`signup-type-${t}`}
                style={[styles.pill, userType === t && styles.pillActive]}
                onPress={() => {
                  setUserType(t);
                  setRole(undefined);
                }}
              >
                <Text style={[styles.pillText, userType === t && styles.pillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!!userType && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select your role</Text>
            <View style={styles.grid}>
              {(userType === "creative" ? creativeRoles : businessRoles).map((r) => (
                <TouchableOpacity key={r} style={[styles.roleItem, role === r && styles.roleItemActive]} onPress={() => setRole(r)}>
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{String(r).replace(/_/g, " ")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          testID="signup-submit"
          style={[styles.primaryBtn, { opacity: loading || !canSubmit ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={loading || !canSubmit}
        >
          <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Create account"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { padding: 20, gap: 16 },
  title: { color: "#F9FAFB", fontSize: 28, fontWeight: "700" as const },
  sectionTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" as const, marginBottom: 10 },
  card: { backgroundColor: "#0F172A", borderColor: "#1F2937", borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#374151", backgroundColor: "#0B1220" },
  pillActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  pillText: { color: "#D1D5DB", fontWeight: "600" as const },
  pillTextActive: { color: "#111827", fontWeight: "700" as const },
  roleItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#0B1220", borderWidth: 1, borderColor: "#1F2937" },
  roleItemActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  roleText: { color: "#D1D5DB" },
  roleTextActive: { color: "#111827", fontWeight: "700" as const },
  input: { backgroundColor: "#111827", borderColor: "#1F2937", borderWidth: 1, color: "#F9FAFB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  primaryBtn: { backgroundColor: "#FFFFFF", paddingVertical: 16, alignItems: "center", borderRadius: 14, marginTop: 8 },
  primaryBtnText: { color: "#111827", fontSize: 17, fontWeight: "700" as const },
});
