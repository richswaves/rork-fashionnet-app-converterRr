import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import GrainTexture from "@/components/GrainTexture";
import { getSupabase } from "@/integrations/supabase/client";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Waiting for recovery link...");

  useEffect(() => {
    let canceled = false;
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("Supabase not configured");
      return;
    }
    const s = supabase;

    async function initFromUrl() {
      try {
        const initial = Platform.OS === "web" ? (typeof window !== "undefined" ? window.location.href : undefined) : await Linking.getInitialURL();
        const url = initial ?? "";
        const parsed = Linking.parse(url);
        const qp = parsed.queryParams as Record<string, string | undefined> | undefined;
        const hash = url.includes("#") ? url.split("#")[1] : undefined;
        const hashParams: Record<string, string> = (() => {
          if (!hash) return {} as Record<string, string>;
          return Object.fromEntries(hash.split("&").map(p => {
            const [k, v] = p.split("=");
            return [decodeURIComponent(k ?? ""), decodeURIComponent(v ?? "")];
          }));
        })();

        const type = (qp?.type as string | undefined) ?? (hashParams["type"] as string | undefined);
        const code = (qp?.code as string | undefined) ?? (hashParams["code"] as string | undefined);
        const accessToken = (qp?.access_token as string | undefined) ?? (hashParams["access_token"] as string | undefined);
        const refreshToken = (qp?.refresh_token as string | undefined) ?? (hashParams["refresh_token"] as string | undefined);

        if (type === "recovery" || code || accessToken) {
          setStatus("Restoring session from recovery link...");
          if (code) {
            const { error } = await s.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else if (accessToken) {
            const { error } = await s.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || "" });
            if (error) throw error;
          }
          const { data } = await s.auth.getSession();
          if (data?.session?.user?.id) {
            if (!canceled) {
              setReady(true);
              setStatus("");
            }
          } else {
            throw new Error("No session after recovery");
          }
        } else {
          setReady(false);
          setStatus("Open the reset link from your email on this device.");
        }
      } catch (e: any) {
        console.error("ResetPassword init error", e);
        setReady(false);
        setStatus(typeof e?.message === "string" ? e.message : "Failed to read recovery link");
      }
    }

    initFromUrl();
    return () => { canceled = true; };
  }, []);

  const canSubmit = useMemo(() => newPassword.length >= 6 && confirmPassword.length >= 6 && newPassword === confirmPassword, [newPassword, confirmPassword]);

  const onSubmit = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return Alert.alert("Error", "Supabase is not configured.");
    if (!canSubmit) return Alert.alert("Invalid", "Passwords must match and be at least 6 characters.");
    try {
      setBusy(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert("Success", "Password updated. Please log in.");
      router.replace("/login" as any);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Failed to update password";
      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  }, [newPassword, canSubmit, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.content}>
        <Text style={styles.title}>Reset your password</Text>
        {!ready && (
          <Text style={styles.helper}>{status}</Text>
        )}
        {ready && (
          <View style={{ gap: 12, width: "100%" }}>
            <TextInput
              testID="reset-new"
              placeholder="New password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
            />
            <TextInput
              testID="reset-confirm"
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />
            <TouchableOpacity
              testID="reset-submit"
              style={[styles.primaryBtn, { opacity: busy || !canSubmit ? 0.6 : 1 }]}
              onPress={onSubmit}
              disabled={busy || !canSubmit}
            >
              {busy ? <ActivityIndicator color="#111827" /> : <Text style={styles.primaryBtnText}>Update password</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  content: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
  title: { color: "#F9FAFB", fontSize: 24, fontWeight: "700" as const, marginBottom: 8, textAlign: "center" as const },
  helper: { color: "#9CA3AF", textAlign: "center" as const },
  input: { backgroundColor: "rgba(20, 20, 20, 0.85)", borderColor: "#404040", borderWidth: 1, color: "#FFFFFF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  primaryBtn: { backgroundColor: "#FFFFFF", paddingVertical: 14, alignItems: "center", borderRadius: 12 },
  primaryBtnText: { color: "#111827", fontSize: 16, fontWeight: "700" as const },
});
