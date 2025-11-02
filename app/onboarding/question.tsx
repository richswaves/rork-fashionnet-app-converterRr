import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { roleQuestions } from "@/constants/onboarding";
import { useProfile } from "@/contexts/ProfileContext";
import { sbInsert } from "@/integrations/supabase/client";

export default function OnboardingQuestion() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; userType?: string; i?: string; sid?: string }>();
  const { currentUserId, profile, updateProfileAsync } = useProfile() as any;

  const role = String(params.role || "");
  const userType = String(params.userType || "");
  const index = Number(params.i || 0);
  const sessionId = String(params.sid || `${Date.now()}`);

  const questions = useMemo(() => (role ? roleQuestions[role] ?? [] : []), [role]);
  const q = questions[index];

  const [selected, setSelected] = useState<string[]>([]);
  const multiple = q?.multiple ?? false;

  const toggle = useCallback((opt: string) => {
    setSelected((prev) => {
      if (multiple) {
        return prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt];
      }
      return [opt];
    });
  }, [multiple]);

  const onNext = useCallback(async () => {
    if (!q) return;
    if (!currentUserId) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/login" as any);
      return;
    }
    if (selected.length === 0) {
      Alert.alert("Select an option", "Choose at least one option to continue.");
      return;
    }

    try {
      await sbInsert("onboarding_responses", {
        user_id: currentUserId,
        role,
        question: q.prompt,
        answer: selected,
      } as any);
    } catch (e) {
      console.log("Failed to insert response", e);
    }

    const nextIndex = index + 1;
    if (nextIndex < questions.length) {
      router.replace({ pathname: "/onboarding/question", params: { role, userType, i: String(nextIndex), sid: sessionId } } as any);
      return;
    }

    try {
      await sbInsert("onboarding_step_events", {
        session_id: sessionId,
        user_id: currentUserId,
        step_number: 4,
        step_name: "profile_setup_complete",
        event_type: "complete",
        user_type: userType,
        specific_role: role,
      } as any);
    } catch (e) {
      console.log("Failed to record completion", e);
    }

    try {
      await updateProfileAsync({
        user_id: currentUserId,
        profession: role,
        is_profile_updated: true,
        account_status: profile?.account_status ?? "pending",
      } as any);
    } catch (e) {
      console.log("Failed to finalize profile", e);
    }

    if (profile?.account_status && profile.account_status !== "approved") {
      router.replace("/onboarding/pending-approval" as any);
    } else {
      router.replace("/(tabs)/opportunities" as any);
    }
  }, [currentUserId, index, profile?.account_status, q, questions.length, role, router, selected, sessionId, updateProfileAsync, userType]);

  const onSkip = useCallback(() => {
    if (!q) return;
    router.replace({ pathname: "/onboarding/question", params: { role, userType, i: String(index + 1), sid: sessionId } } as any);
  }, [index, role, router, sessionId, userType, q]);

  if (!q) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}> 
          <Text style={styles.prompt}>No question</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/(tabs)/opportunities" as any)}>
            <Text style={styles.primaryBtnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.fullPage}>
        <View style={styles.header}> 
          <Text style={styles.progress}>{index + 1} / {questions.length}</Text>
          <Text style={styles.roleText}>{String(role).replace(/_/g, " ")}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.prompt}>{q.prompt}</Text>
          <View style={styles.optionsWrap}>
            {q.options.map((opt) => {
              const isSel = selected.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  testID={`ob-q-${q.id}-${opt}`}
                  style={[styles.pill, isSel && styles.pillActive]}
                  onPress={() => toggle(opt)}
                >
                  <Text style={[styles.pillText, isSel && styles.pillTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity testID="ob-skip" style={[styles.secondaryBtn]} onPress={onSkip}>
            <Text style={styles.secondaryBtnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="ob-next" style={[styles.primaryBtn, { opacity: selected.length === 0 ? 0.6 : 1 }]} onPress={onNext}>
            <Text style={styles.primaryBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.legalNote} testID="onboarding-legal-note">
          <Text style={styles.legalText}>By continuing, you agree to our </Text>
          <Link href="/legal/terms"><Text style={styles.legalLink}>Terms</Text></Link>
          <Text style={styles.legalText}>, </Text>
          <Link href="/legal/privacy"><Text style={styles.legalLink}>Privacy Policy</Text></Link>
          <Text style={styles.legalText}>, </Text>
          <Link href="/legal/subscription"><Text style={styles.legalLink}>Subscription Addendum</Text></Link>
          <Text style={styles.legalText}>, </Text>
          <Link href="/legal/community-guidelines"><Text style={styles.legalLink}>Community Guidelines</Text></Link>
          <Text style={styles.legalText}>, </Text>
          <Link href="/legal/dmca"><Text style={styles.legalLink}>DMCA</Text></Link>
          <Text style={styles.legalText}>, </Text>
          <Link href="/legal/dpa"><Text style={styles.legalLink}>DPA</Text></Link>
          <Text style={styles.legalText}> and </Text>
          <Link href="/legal/cookie-policy"><Text style={styles.legalLink}>Cookie Policy</Text></Link>
          <Text style={styles.legalText}>.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  fullPage: { flex: 1, padding: 20, gap: 12 },
  header: { paddingTop: 12, paddingBottom: 4 },
  progress: { color: "#9CA3AF", fontSize: 14, fontWeight: "600" as const },
  roleText: { color: "#9CA3AF", fontSize: 12 },
  body: { flex: 1, justifyContent: "center", gap: 16 },
  prompt: { color: "#F9FAFB", fontSize: 24, fontWeight: "800" as const, lineHeight: 30 },
  optionsWrap: { flexDirection: "row", flexWrap: "wrap" as const, gap: 10 },
  pill: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: "#374151", backgroundColor: "#0B1220" },
  pillActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  pillText: { color: "#D1D5DB", fontWeight: "700" as const },
  pillTextActive: { color: "#111827", fontWeight: "800" as const },
  footer: { flexDirection: "row", gap: 12 },
  primaryBtn: { flex: 1, backgroundColor: "#FFFFFF", paddingVertical: 16, alignItems: "center", borderRadius: 14 },
  primaryBtnText: { color: "#111827", fontSize: 16, fontWeight: "800" as const },
  secondaryBtn: { flex: 1, backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#1F2937", paddingVertical: 16, alignItems: "center", borderRadius: 14 },
  secondaryBtnText: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" as const },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20 },
  legalNote: { marginTop: 10, flexDirection: "row", flexWrap: "wrap" as const, alignItems: "center" },
  legalText: { color: "#9CA3AF", fontSize: 12 },
  legalLink: { color: "#93C5FD", fontSize: 12, textDecorationLine: "underline" as const },
});
