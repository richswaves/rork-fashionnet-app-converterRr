import React, { useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbInsert, sbUpsert } from "@/integrations/supabase/client";

type ChoiceQuestion = { id: string; prompt: string; options: string[]; multiple?: boolean };

const roleQuestions: Record<string, ChoiceQuestion[]> = {
  model: [
    { id: "shoot_types", prompt: "What types of shoots do you focus on?", options: ["Streetwear campaigns", "Editorial / magazine work", "Commercial / e-commerce", "Music / culture collaborations"], multiple: true },
    { id: "showcase_where", prompt: "Where do you showcase most of your work?", options: ["Instagram", "TikTok", "Portfolio / website"], multiple: true },
  ],
  photographer: [
    { id: "primarily_shoot", prompt: "What do you primarily shoot?", options: ["Street/editorial fashion", "Sneakers / products", "Lifestyle / culture", "Artists / events"], multiple: true },
  ],
};

const creativeRoles = ["model", "photographer", "videographer", "content_creator", "stylist", "designer", "creative_director"] as const;
const businessRoles = ["clothing_brand", "agency", "photography_business", "publisher", "other_business"] as const;

export default function ProfileSetup() {
  const router = useRouter();
  const { currentUserId, updateProfileAsync, profile } = useProfile() as any;

  const [userType, setUserType] = useState<"creative" | "business" | undefined>(undefined);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const [fullName, setFullName] = useState<string>(profile?.full_name ?? "");
  const [username, setUsername] = useState<string>(profile?.username ?? "");
  const [location, setLocation] = useState<string>(profile?.location ?? "");
  const [bio, setBio] = useState<string>(profile?.bio ?? "");

  const [height, setHeight] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [hips, setHips] = useState<string>("");

  const sessionIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const availableQuestions = useMemo<ChoiceQuestion[]>(() => {
    if (!role) return [];
    return roleQuestions[role] ?? [];
  }, [role]);

  const toggleAnswer = useCallback((qid: string, option: string, multiple?: boolean) => {
    setAnswers((prev) => {
      const existing = prev[qid] ?? [];
      if (multiple) {
        return {
          ...prev,
          [qid]: existing.includes(option) ? existing.filter((o) => o !== option) : [...existing, option],
        };
      }
      return { ...prev, [qid]: [option] };
    });
  }, []);

  const recordEvent = useCallback(async (step: number, name: string, type: string) => {
    try {
      await sbInsert("onboarding_step_events", {
        session_id: (sessionIdRef.current as unknown as string) || `${Date.now()}`,
        user_id: currentUserId,
        step_number: step,
        step_name: name,
        event_type: type,
        user_type: userType,
        specific_role: role,
      } as any);
    } catch (e) {
      console.log("onboarding event failed", e);
    }
  }, [currentUserId, role, userType]);

  const onSave = useCallback(async () => {
    if (!currentUserId) {
      Alert.alert("Not logged in", "Please log in to continue.");
      return;
    }
    if (!userType || !role) {
      Alert.alert("Missing info", "Choose your user type and role.");
      return;
    }

    try {
      await recordEvent(3, "profile_details", "complete");

      await updateProfileAsync({
        full_name: fullName || undefined,
        username: username || undefined,
        location: location || undefined,
        bio: bio || undefined,
        profession: role,
        is_profile_updated: true,
      } as any);

      const qs = availableQuestions;
      for (const q of qs) {
        const a = answers[q.id] ?? [];
        try {
          await sbInsert("onboarding_responses", {
            user_id: currentUserId,
            role,
            question: q.prompt,
            answer: a,
          } as any);
        } catch (e) {
          console.log("response insert failed", q.id, e);
        }
      }

      if (role === "model") {
        try {
          await sbUpsert("profiles", {
            user_id: currentUserId,
            profession: role,
            is_profile_updated: true,
            account_status: profile?.account_status ?? "pending",
            height: height || undefined,
            waist: waist || undefined,
            hips: hips || undefined,
          } as any, "user_id");
        } catch (e) {
          console.log("model details upsert failed", e);
        }
      }

      await recordEvent(4, "profile_setup_complete", "complete");

      if (profile?.account_status && profile.account_status !== "approved") {
        router.replace("/onboarding/pending-approval" as any);
      } else {
        router.replace("/(tabs)/opportunities" as any);
      }
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Could not save";
      Alert.alert("Save failed", msg);
    }
  }, [answers, availableQuestions, bio, currentUserId, fullName, height, location, profile?.account_status, recordEvent, role, router, updateProfileAsync, username, waist, hips, userType]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Set up your profile</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>You are joining as</Text>
          <View style={styles.row}>
            {(["creative", "business"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                testID={`type-${t}`}
                style={[styles.pill, userType === t && styles.pillActive]}
                onPress={async () => {
                  setUserType(t);
                  setRole(undefined);
                  await recordEvent(2, "user_type_selection", "complete");
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
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r.replace(/_/g, " ")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!!role && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basics</Text>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor="#9CA3AF" style={styles.input} testID="ps-fullname" />
            <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor="#9CA3AF" style={styles.input} autoCapitalize="none" testID="ps-username" />
            <TextInput value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor="#9CA3AF" style={styles.input} testID="ps-location" />
            <TextInput value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor="#9CA3AF" style={[styles.input, { height: 90 }]} multiline testID="ps-bio" />
          </View>
        )}

        {!!role && availableQuestions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tell us more</Text>
            {availableQuestions.map((q) => (
              <View key={q.id} style={{ marginBottom: 12 }}>
                <Text style={styles.prompt}>{q.prompt}</Text>
                <View style={styles.rowWrap}>
                  {q.options.map((opt) => {
                    const selected = (answers[q.id] ?? []).includes(opt);
                    return (
                      <TouchableOpacity
                        key={opt}
                        testID={`q-${q.id}-${opt}`}
                        style={[styles.pill, selected && styles.pillActive]}
                        onPress={() => toggleAnswer(q.id, opt, q.multiple)}
                      >
                        <Text style={[styles.pillText, selected && styles.pillTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {role === "model" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Measurements</Text>
            <View style={styles.row}>
              <TextInput value={height} onChangeText={setHeight} placeholder="Height" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-height" />
              <TextInput value={waist} onChangeText={setWaist} placeholder="Waist" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-waist" />
            </View>
            <View style={styles.row}>
              <TextInput value={hips} onChangeText={setHips} placeholder="Hips" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-hips" />
            </View>
          </View>
        )}

        <TouchableOpacity testID="ps-save" style={styles.primaryBtn} onPress={onSave}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { padding: 20, gap: 16 },
  title: { color: "#F9FAFB", fontSize: 24, fontWeight: "700" as const, marginBottom: 8 },
  sectionTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" as const, marginBottom: 10 },
  card: { backgroundColor: "#0F172A", borderColor: "#1F2937", borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  grid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#374151", backgroundColor: "#0B1220" },
  pillActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  pillText: { color: "#D1D5DB", fontWeight: "600" as const },
  pillTextActive: { color: "#111827", fontWeight: "700" as const },
  roleItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#0B1220", borderWidth: 1, borderColor: "#1F2937" },
  roleItemActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  roleText: { color: "#D1D5DB" },
  roleTextActive: { color: "#111827", fontWeight: "700" as const },
  input: { backgroundColor: "#0B1220", borderColor: "#1F2937", borderWidth: 1, color: "#F9FAFB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  inputHalf: { flex: 1 },
  prompt: { color: "#E5E7EB", marginBottom: 6, fontWeight: "600" as const },
  primaryBtn: { backgroundColor: "#FFFFFF", paddingVertical: 16, alignItems: "center", borderRadius: 14, marginTop: 8 },
  primaryBtnText: { color: "#111827", fontSize: 16, fontWeight: "700" as const },
});
