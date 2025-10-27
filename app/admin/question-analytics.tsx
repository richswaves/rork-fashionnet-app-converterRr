import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";
import GrainTexture from "@/components/GrainTexture";
import { Shield } from "lucide-react-native";
import OnboardingQuestionAnalytics from "@/components/admin/OnboardingQuestionAnalytics";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";

function useIsAdmin(userId?: string) {
  return useQuery<boolean>({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const rows = await sbSelect<{ user_id: string; role: string }>("user_roles", {
        select: "user_id,role",
        query: { user_id: `eq.${userId}`, role: "eq.admin" },
        limit: 1,
      });
      return (rows?.length ?? 0) > 0;
    },
  }).data ?? false;
}

export default function QuestionAnalyticsScreen() {
  const { currentUserId } = useProfile();
  const isAdmin = useIsAdmin(currentUserId);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={["top","bottom"]}>
        <GrainTexture />
        <View style={styles.center}>
          <Text style={styles.denied}>Access denied. Admin only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top","bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <Text style={styles.title}>Question Analytics</Text>
        <Shield size={22} color="#8B5CF6" />
      </View>
      <OnboardingQuestionAnalytics />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" as const },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  denied: { color: "#EF4444", fontSize: 16, fontWeight: "700" as const },
});
