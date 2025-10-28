import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GrainTexture from "@/components/GrainTexture";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";
import { trpc } from "@/lib/trpc";
import { Shield, ArrowLeft, Calendar } from "lucide-react-native";
import { useProfile } from "@/contexts/ProfileContext";

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

export default function UserActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = String(params.userId || "");
  const [days, setDays] = useState<number>(30);
  const { currentUserId } = useProfile();

  const isAdmin = useIsAdmin(currentUserId);

  const summary = trpc.admin.analytics.getUserActivitySummary.useQuery({ userId, daysBack: days }, { enabled: !!userId && isAdmin });
  const recent = trpc.admin.analytics.listRecentUserEvents.useQuery({ userId, limit: 50 }, { enabled: !!userId && isAdmin });

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

  const sum = (summary.data as any) ?? {};

  return (
    <SafeAreaView style={styles.container} edges={["top","bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back">
          <ArrowLeft size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>User Activity</Text>
        <Shield size={22} color="#8B5CF6" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={summary.isRefetching || recent.isRefetching} onRefresh={() => { summary.refetch(); recent.refetch(); }} tintColor="#fff" />}
      >
        <View style={styles.controlsRow}>
          <View style={styles.daysPill}>
            <Calendar size={14} color="#9CA3AF" />
            <Text style={styles.daysPillText}>{days} days</Text>
            <View style={styles.daysActions}>
              {[7, 30, 90].map((d) => (
                <Pressable key={d} onPress={() => setDays(d)} style={[styles.daysBtn, days === d && styles.daysBtnActive]} testID={`range-${d}`}>
                  <Text style={[styles.daysBtnText, days === d && styles.daysBtnTextActive]}>{d}d</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.stat} testID="total-events">
            <Text style={styles.statLabel}>Total events</Text>
            <Text style={styles.statValue}>{Number(sum.total_events ?? 0)}</Text>
          </View>
          <View style={styles.stat} testID="pages-visited">
            <Text style={styles.statLabel}>Pages visited</Text>
            <Text style={styles.statValue}>{Number(sum.pages_visited ?? 0)}</Text>
          </View>
          <View style={styles.stat} testID="last-active">
            <Text style={styles.statLabel}>Last active</Text>
            <Text style={styles.statValue}>{(sum.last_active ?? "-") as string}</Text>
          </View>
          <View style={styles.stat} testID="most-active-page">
            <Text style={styles.statLabel}>Top page</Text>
            <Text style={styles.statValue}>{(sum.most_active_page ?? "-") as string}</Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Recent events</Text>
          {(recent.data ?? []).map((e, i) => (
            <View key={`${e.event_type}-${i}`} style={styles.row}>
              <Text style={styles.rowText} numberOfLines={1}>{e.event_type} • {e.page}</Text>
              <Text style={styles.rowValue}>{new Date(e.created_at).toLocaleString()}</Text>
            </View>
          ))}
          {(recent.data ?? []).length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No events</Text></View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" as const },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  denied: { color: "#EF4444", fontSize: 16, fontWeight: "700" as const },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  daysPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  daysPillText: { color: "#E5E7EB", fontSize: 13, fontWeight: "800" as const },
  daysActions: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 6 },
  daysBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#0F0F14", borderWidth: 1, borderColor: "#2A2A33" },
  daysBtnActive: { backgroundColor: "#8B5CF6" },
  daysBtnText: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const },
  daysBtnTextActive: { color: "#0B0B0F", fontWeight: "900" as const },
  sectionTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" as const },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 12 },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const },
  statValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" as const, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rowText: { flex: 1, color: "#D1D5DB", fontSize: 13, fontWeight: "600" },
  rowValue: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const, marginLeft: 10 },
  empty: { backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
});
