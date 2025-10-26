import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { sbSelect, getSupabase } from "@/integrations/supabase/client";
import GrainTexture from "@/components/GrainTexture";
import { PieChart, Shield, BarChart3, Users as UsersIcon, BriefcaseBusiness, ChevronRight, AlertTriangle } from "lucide-react-native";
import { useProfile } from "@/contexts/ProfileContext";

function useAdminCheck(userId?: string) {
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
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const { currentUserId } = useProfile();
  const { data: isAdmin } = useAdminCheck(currentUserId);

  const usersStats = useQuery<{ total: number; recent7: number}>({
    queryKey: ["admin", "users-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const supabase = getSupabase();
      const { count: total, error: totalError } = await supabase!
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (totalError) console.log("users total error", totalError.message);
      
      const { count: recent7, error: recentError } = await supabase!
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (recentError) console.log("users recent error", recentError.message);
      
      return { total: total ?? 0, recent7: recent7 ?? 0 };
    },
  });

  const oppStats = useQuery<{ total: number; recent7: number}>({
    queryKey: ["admin", "opps-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const supabase = getSupabase();
      const { count: total, error: totalError } = await supabase!
        .from("opportunities")
        .select("*", { count: "exact", head: true });
      if (totalError) console.log("opportunities total error", totalError.message);
      
      const { count: recent7, error: recentError } = await supabase!
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (recentError) console.log("opportunities recent error", recentError.message);
      
      return { total: total ?? 0, recent7: recent7 ?? 0 };
    },
  });

  const rolesPie = useQuery<{ role: string; count: number }[]>({
    queryKey: ["admin", "onboarding-roles"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase!
        .from("onboarding_responses")
        .select("role, user_id");
      if (error || !data) return [];
      const map = new Map<string, Set<string>>();
      data.forEach(r => {
        if (!r.role || !r.user_id) return;
        if (!map.has(r.role)) map.set(r.role, new Set());
        map.get(r.role)!.add(r.user_id);
      });
      return Array.from(map.entries()).map(([role, set]) => ({ role, count: set.size }));
    },
  });

  const professionPie = useQuery<{ profession: string; count: number }[]>({
    queryKey: ["admin", "profession-pie"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const rows = await sbSelect<{ profession: string }>("profiles", { select: "profession" });
      const target = new Set([
        "model","photographer","stylist","designer","content_creator","creative_director","fashion_creative","videographer","agency","clothing_brand","brand_owner","business_owner","manufacturer","retailer","publisher","other_business",
      ]);
      const counts = new Map<string, number>();
      rows.forEach(r => {
        const p = (r.profession ?? "").toLowerCase();
        if (!p || !target.has(p)) return;
        counts.set(p, (counts.get(p) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([profession, count]) => ({ profession, count }));
    },
  });

  const refreshAll = () => {
    usersStats.refetch();
    oppStats.refetch();
    rolesPie.refetch();
    professionPie.refetch();
  };

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
        <Text style={styles.title}>Admin Dashboard</Text>
        <Shield size={22} color="#8B5CF6" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor="#fff" />}
      >
        <View style={styles.row}>
          <StatCard
            title="Users"
            primary={usersStats.data?.total ?? 0}
            secondary={`+${usersStats.data?.recent7 ?? 0} last 7d`}
          />
          <StatCard
            title="Opportunities"
            primary={oppStats.data?.total ?? 0}
            secondary={`+${oppStats.data?.recent7 ?? 0} last 7d`}
          />
        </View>

        <Section title="Approvals">
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/approvals")}> 
            <Text style={styles.linkText}>Review applications</Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/suspended")}>
            <Text style={styles.linkText}>Suspended accounts</Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/access")}>
            <Text style={styles.linkText}>Manage admin access</Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Section>

        <Section title="Reports">
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/reports")}>
            <View style={styles.linkLeftContent}>
              <AlertTriangle size={18} color="#EF4444" />
              <Text style={styles.linkText}>User reports</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Section>

        <Section title="Onboarding Roles">
          <TinyBars data={(rolesPie.data ?? []).sort((a,b)=>b.count-a.count).slice(0,6).map(r=>({ label: r.role, value: r.count }))} />
        </Section>

        <Section title="Profile Professions">
          <TinyBars data={(professionPie.data ?? []).sort((a,b)=>b.count-a.count).slice(0,8).map(r=>({ label: r.profession, value: r.count }))} />
        </Section>

        <Section title="Funnel">
          <View style={styles.placeholderCard}>
            <BarChart3 size={18} color="#8B5CF6" />
            <Text style={styles.placeholderText}>Detailed funnel via RPC coming soon</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ title, primary, secondary }: { title: string; primary: number; secondary: string; }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statPrimary}>{primary}</Text>
      <Text style={styles.statSecondary}>{secondary}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHeader}>
        <PieChart size={16} color="#9CA3AF" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function TinyBars({ data }: { data: { label: string; value: number }[] }) {
  const max = useMemo(() => Math.max(1, ...data.map(d => d.value)), [data]);
  return (
    <View style={{ gap: 8 }}>
      {data.map(d => {
        const widthPct = Math.max(6, Math.round((d.value / max) * 100));
        return (
          <View key={d.label} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${widthPct}%` }]} />
            </View>
            <Text style={styles.barValue}>{d.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" as const },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  denied: { color: "#EF4444", fontSize: 16, fontWeight: "700" as const },
  row: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 14, padding: 14 },
  statHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statTitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const },
  statPrimary: { color: "#fff", fontSize: 28, fontWeight: "800" as const, marginTop: 6 },
  statSecondary: { color: "#6B7280", fontSize: 12, fontWeight: "700" as const },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" as const },
  linkCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 12 },
  linkLeftContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" as const },
  placeholderCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 12 },
  placeholderText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" as const },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { color: "#9CA3AF", fontSize: 12, flex: 0.6 },
  barTrack: { flex: 1, height: 10, backgroundColor: "#1F2937", borderRadius: 6, overflow: "hidden" },
  barFill: { height: 10, backgroundColor: "#8B5CF6" },
  barValue: { color: "#E5E7EB", fontSize: 12, width: 32, textAlign: "right" as const },
});
