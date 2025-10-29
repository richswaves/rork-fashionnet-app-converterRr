import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GrainTexture from "@/components/GrainTexture";
import { useProfile } from "@/contexts/ProfileContext";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";
import { trpc } from "@/lib/trpc";
import { Shield, Calendar, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";

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

export default function AdminActivityOverview() {
  const router = useRouter();
  const { currentUserId } = useProfile();
  const isAdmin = useIsAdmin(currentUserId);
  const [days, setDays] = useState<number>(30);

  const searchPatterns = trpc.admin.analytics.getSearchPatterns.useQuery({ daysBack: days }, { enabled: isAdmin });
  const filterStatsOpps = trpc.admin.analytics.getFilterUsageStats.useQuery({ page: "opportunities", daysBack: days }, { enabled: isAdmin });
  const filterStatsNetwork = trpc.admin.analytics.getFilterUsageStats.useQuery({ page: "network", daysBack: days }, { enabled: isAdmin });
  const locationOpps = trpc.admin.analytics.getLocationStats.useQuery({ page: "opportunities", daysBack: days }, { enabled: isAdmin });
  const oppStats = trpc.admin.analytics.getOpportunityStats.useQuery({ daysBack: days }, { enabled: isAdmin });

  const refreshing = searchPatterns.isRefetching || filterStatsOpps.isRefetching || filterStatsNetwork.isRefetching || locationOpps.isRefetching || oppStats.isRefetching;

  const topSearches = useMemo(() => (searchPatterns.data ?? []).slice(0, 10), [searchPatterns.data]);
  const topFiltersOpps = useMemo(() => (filterStatsOpps.data ?? []).slice(0, 10), [filterStatsOpps.data]);
  const topFiltersNetwork = useMemo(() => (filterStatsNetwork.data ?? []).slice(0, 10), [filterStatsNetwork.data]);
  const topLocationsOpps = useMemo(() => (locationOpps.data ?? []).slice(0, 10), [locationOpps.data]);
  const topOpps = useMemo(() => (oppStats.data ?? []).slice(0, 10), [oppStats.data]);

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
        <Text style={styles.title}>Behavior Analytics</Text>
        <Shield size={22} color="#8B5CF6" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          if (searchPatterns?.refetch) searchPatterns.refetch();
          if (filterStatsOpps?.refetch) filterStatsOpps.refetch();
          if (filterStatsNetwork?.refetch) filterStatsNetwork.refetch();
          if (locationOpps?.refetch) locationOpps.refetch();
          if (oppStats?.refetch) oppStats.refetch();
        }} tintColor="#fff" />}
        testID="admin-activity-scroll"
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

        <Section title="Top Searches">
          {topSearches.length === 0 ? <Empty label="No searches" /> : (
            <List rows={topSearches.map(s => ({
              left: `${s.page} • ${s.search_query}`,
              right: `${s.search_count} ×`
            }))} />
          )}
        </Section>

        <Section title="Popular Filters • Opportunities">
          {topFiltersOpps.length === 0 ? <Empty label="No filters" /> : (
            <List rows={topFiltersOpps.map(f => ({ left: `${f.filter_key} = ${f.filter_value}`, right: String(f.usage_count) }))} />
          )}
        </Section>

        <Section title="Popular Filters • Network">
          {topFiltersNetwork.length === 0 ? <Empty label="No filters" /> : (
            <List rows={topFiltersNetwork.map(f => ({ left: `${f.filter_key} = ${f.filter_value}`, right: String(f.usage_count) }))} />
          )}
        </Section>

        <Section title="Top Locations (Opportunities)">
          {topLocationsOpps.length === 0 ? <Empty label="No locations" /> : (
            <List rows={topLocationsOpps.map(l => ({ left: l.location, right: String(l.interaction_count) }))} />
          )}
        </Section>

        <Section title="Top Opportunities">
          {topOpps.length === 0 ? <Empty label="No opportunity activity" /> : (
            <View style={{ gap: 8 }}>
              {topOpps.map(row => (
                <View key={row.opportunity_id} style={styles.cardRow} testID={`opp-${row.opportunity_id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{row.title || "Untitled"}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {row.view_count} views • {row.application_count} applies • {row.save_count} saves
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: "/create-opportunity", params: { id: row.opportunity_id } })} style={styles.rowCta} testID={`opp-open-${row.opportunity_id}`}>
                    <ArrowRight size={16} color="#0B0B0F" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function List({ rows }: { rows: { left: string; right: string }[] }) {
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={`${r.left}-${i}`} style={styles.row} testID={`row-${i}`}>
          <View style={styles.rowLeft} />
          <Text style={styles.rowText} numberOfLines={1}>{r.left}</Text>
          <Text style={styles.rowValue}>{r.right}</Text>
        </View>
      ))}
    </View>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.empty} testID="empty">
      <Text style={styles.emptyText}>{label}</Text>
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
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  daysPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  daysPillText: { color: "#E5E7EB", fontSize: 13, fontWeight: "800" as const },
  daysActions: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 6 },
  daysBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#0F0F14", borderWidth: 1, borderColor: "#2A2A33" },
  daysBtnActive: { backgroundColor: "#8B5CF6" },
  daysBtnText: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const },
  daysBtnTextActive: { color: "#0B0B0F", fontWeight: "900" as const },
  sectionTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" as const },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rowLeft: { width: 22, alignItems: "center" },
  rowText: { flex: 1, color: "#D1D5DB", fontSize: 13, fontWeight: "600" },
  rowValue: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const, marginLeft: 10 },
  empty: { backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 12 },
  rowTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" as const },
  rowSub: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
  rowCta: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
});
