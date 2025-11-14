import React, { useMemo, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { sbSelect, getSupabase } from "../../integrations/supabase/client";
import GrainTexture from "../../components/GrainTexture";
import { PieChart, Shield, BarChart3, ChevronRight, AlertTriangle, Scale, TrendingUp, Users, Target, MapPin, Layers, CalendarDays } from "lucide-react-native";
import { useProfile } from "../../contexts/ProfileContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { trpc } from "../../lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../backend/trpc/app-router";

type PostAnalyticsResponse = inferRouterOutputs<AppRouter>["admin"]["analytics"]["getPostAnalytics"];
type ShareSlice = PostAnalyticsResponse["posterRoleShare"][number];
type PostAnalyticsItem = PostAnalyticsResponse["posts"][number];

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
  const { markAsViewed } = useNotifications();

  useEffect(() => {
    if (isAdmin) {
      markAsViewed("admin");
    }
  }, [isAdmin, markAsViewed]);

  const usersStats = useQuery<{ total: number; recent7: number }>({
    queryKey: ["admin", "users-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const supabase = getSupabase();
      const { count: total } = await supabase!.from("profiles").select("*", { count: "exact", head: true });
      const { count: recent7 } = await supabase!
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      return { total: total ?? 0, recent7: recent7 ?? 0 };
    },
  });

  const oppStats = useQuery<{ total: number; recent7: number }>({
    queryKey: ["admin", "opps-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const supabase = getSupabase();
      const { count: total } = await supabase!.from("opportunities").select("*", { count: "exact", head: true });
      const { count: recent7 } = await supabase!
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      return { total: total ?? 0, recent7: recent7 ?? 0 };
    },
  });

  const rolesPie = useQuery<{ role: string; count: number }[]>({
    queryKey: ["admin", "onboarding-roles"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data } = await supabase!.from("onboarding_responses").select("role, user_id");
      if (!data) return [];
      const map = new Map<string, Set<string>>();
      data.forEach((r) => {
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
        "model",
        "photographer",
        "stylist",
        "designer",
        "content_creator",
        "creative_director",
        "fashion_creative",
        "videographer",
        "agency",
        "clothing_brand",
        "brand_owner",
        "business_owner",
        "manufacturer",
        "retailer",
        "publisher",
        "other_business",
      ]);
      const counts = new Map<string, number>();
      rows.forEach((r) => {
        const p = (r.profession ?? "").toLowerCase();
        if (!p || !target.has(p)) return;
        counts.set(p, (counts.get(p) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([profession, count]) => ({ profession, count }));
    },
  });

  const postAnalytics = trpc.admin.analytics.getPostAnalytics.useQuery({ daysBack: 90 }, { enabled: !!isAdmin });

  const refreshAll = () => {
    usersStats.refetch();
    oppStats.refetch();
    rolesPie.refetch();
    professionPie.refetch();
    postAnalytics.refetch();
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <GrainTexture />
        <View style={styles.center}>
          <Text style={styles.denied}>Access denied. Admin only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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
          <StatCard title="Users" primary={usersStats.data?.total ?? 0} secondary={`+${usersStats.data?.recent7 ?? 0} last 7d`} />
          <StatCard title="Opportunities" primary={oppStats.data?.total ?? 0} secondary={`+${oppStats.data?.recent7 ?? 0} last 7d`} />
        </View>

        <Section title="Opportunity Insights">
          <PostAnalyticsSection
            data={postAnalytics.data}
            isLoading={postAnalytics.isLoading}
            isError={!!postAnalytics.error}
            onRetry={postAnalytics.refetch}
          />
        </Section>

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

        <Section title="Moderation">
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/reports")}>
            <View style={styles.linkLeftContent}>
              <AlertTriangle size={18} color="#EF4444" />
              <Text style={styles.linkText}>User reports</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/appeals")}>
            <View style={styles.linkLeftContent}>
              <Scale size={18} color="#3B82F6" />
              <Text style={styles.linkText}>Suspension appeals</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Section>

        <Section title="Onboarding Roles">
          <TinyBars data={(rolesPie.data ?? []).sort((a, b) => b.count - a.count).slice(0, 6).map((r) => ({ label: r.role, value: r.count }))} />
        </Section>

        <Section title="Profile Professions">
          <TinyBars data={(professionPie.data ?? []).sort((a, b) => b.count - a.count).slice(0, 8).map((r) => ({ label: r.profession, value: r.count }))} />
        </Section>

        <Section title="Funnel">
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/funnel")}>
            <View style={styles.linkLeftContent}>
              <BarChart3 size={18} color="#8B5CF6" />
              <Text style={styles.linkText}>View detailed funnel analytics</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Section>

        <Section title="Behavior Analytics">
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/activity")}>
            <View style={styles.linkLeftContent}>
              <BarChart3 size={18} color="#10B981" />
              <Text style={styles.linkText}>User behavior & search trends</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Section>

        <Section title="Question Analytics">
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push("/admin/question-analytics")}>
            <View style={styles.linkLeftContent}>
              <BarChart3 size={18} color="#22D3EE" />
              <Text style={styles.linkText}>Answers distribution by question</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ title, primary, secondary }: { title: string; primary: number; secondary: string }) {
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
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  return (
    <View style={{ gap: 8 }}>
      {data.map((d) => {
        const widthPct = Math.max(6, Math.round((d.value / max) * 100));
        return (
          <View key={d.label} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {d.label}
            </Text>
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

function SummaryMetric({
  Icon,
  label,
  value,
  meta,
  accent,
  testID,
}: {
  Icon: (props: { size: number; color: string }) => JSX.Element;
  label: string;
  value: string;
  meta: string;
  accent: string;
  testID: string;
}) {
  return (
    <View style={styles.summaryCard} testID={testID}>
      <View style={[styles.summaryIconWrap, { backgroundColor: `${accent}22` }]}> 
        <Icon size={18} color={accent} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryMeta}>{meta}</Text>
    </View>
  );
}

function DistributionCard({
  title,
  Icon,
  accent,
  data,
  testID,
}: {
  title: string;
  Icon: (props: { size: number; color: string }) => JSX.Element;
  accent: string;
  data: ShareSlice[];
  testID: string;
}) {
  const items = data.slice(0, 5);
  return (
    <View style={styles.distributionCard} testID={testID}>
      <View style={styles.distributionHeader}>
        <View style={[styles.distributionIconWrap, { backgroundColor: `${accent}22` }]}> 
          <Icon size={16} color={accent} />
        </View>
        <Text style={styles.distributionTitle}>{title}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyState}>No data yet.</Text>
      ) : (
        <View style={styles.distributionList}>
          {items.map((item) => (
            <View key={item.label} style={styles.distributionItem}>
              <View style={styles.distributionLabelRow}>
                <Text style={styles.distributionLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.distributionPercent}>{item.percent.toFixed(1)}%</Text>
              </View>
              <View style={styles.distributionTrack}>
                <View
                  style={[
                    styles.distributionFill,
                    {
                      width: `${Math.min(100, Math.max(0, item.percent))}%`,
                      backgroundColor: accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.distributionCount}>{item.count.toLocaleString()} posts</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PostAnalyticsSection({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data?: PostAnalyticsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.analyticsLoading} testID="post-analytics-loading">
        <ActivityIndicator color="#8B5CF6" />
        <Text style={styles.analyticsLoadingText}>Loading opportunity analytics…</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.analyticsError} testID="post-analytics-error">
        <Text style={styles.analyticsErrorText}>Unable to load post analytics.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topPoster = data.posterRoleShare[0];
  const topSeeker = data.seekingRoleShare[0];
  const sortedPosts = [...data.posts];
  sortedPosts.sort((a, b) => {
    if (b.applications !== a.applications) return b.applications - a.applications;
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
  const topPosts: PostAnalyticsItem[] = sortedPosts.slice(0, 6);

  const summaryItems = [
    {
      key: "posts",
      label: "Total Posts",
      value: data.totalPosts.toLocaleString(),
      meta: topPoster ? `Top poster • ${topPoster.label}` : "No poster data yet",
      Icon: Layers,
      accent: "#8B5CF6",
    },
    {
      key: "applications",
      label: "Applications",
      value: data.totalApplications.toLocaleString(),
      meta: `Avg per post • ${data.averageApplicationsPerPost.toFixed(2)}`,
      Icon: TrendingUp,
      accent: "#34D399",
    },
    {
      key: "seeker",
      label: "Top Seeking Role",
      value: topSeeker ? topSeeker.label : "—",
      meta: topSeeker ? `${topSeeker.percent.toFixed(1)}% of posts` : "No seeking data yet",
      Icon: Target,
      accent: "#F59E0B",
    },
  ];

  return (
    <View style={styles.analyticsContainer} testID="post-analytics-section">
      <View style={styles.summaryGrid}>
        {summaryItems.map((item) => (
          <SummaryMetric
            key={item.key}
            Icon={item.Icon}
            label={item.label}
            value={item.value}
            meta={item.meta}
            accent={item.accent}
            testID={`analytics-summary-${item.key}`}
          />
        ))}
      </View>

      <View style={styles.distributionGrid}>
        <DistributionCard
          title="Poster Roles"
          Icon={Users}
          accent="#8B5CF6"
          data={data.posterRoleShare}
          testID="analytics-poster-roles"
        />
        <DistributionCard
          title="Roles Being Sought"
          Icon={Target}
          accent="#34D399"
          data={data.seekingRoleShare}
          testID="analytics-seeking-roles"
        />
        <DistributionCard
          title="Posting Locations"
          Icon={MapPin}
          accent="#38BDF8"
          data={data.locationShare}
          testID="analytics-locations"
        />
      </View>

      <View style={styles.postList} testID="post-analytics-list">
        <View style={styles.postListHeader}>
          <Text style={styles.postListHeaderTitle}>Top Posts by Applications</Text>
          <Text style={styles.postListHeaderSub}>Apps</Text>
        </View>
        {topPosts.length === 0 ? (
          <Text style={styles.emptyState} testID="post-analytics-empty">No posts yet.</Text>
        ) : (
          topPosts.map((post) => (
            <View key={post.id} style={styles.postRow} testID={`post-analytics-${post.id}`}>
              <View style={styles.postInfo}>
                <Text style={styles.postTitle} numberOfLines={1}>
                  {post.title}
                </Text>
                <View style={styles.postMetaRow}>
                  <View style={styles.postBadge}>
                    <Users size={12} color="#A855F7" />
                    <Text style={styles.postBadgeText}>{post.posterRole}</Text>
                  </View>
                  <View style={styles.postBadge}>
                    <Target size={12} color="#34D399" />
                    <Text style={styles.postBadgeText}>{post.seekingRole}</Text>
                  </View>
                </View>
                <View style={styles.postMetaRow}>
                  <View style={styles.postBadgeSoft}>
                    <MapPin size={12} color="#6B7280" />
                    <Text style={styles.postBadgeSoftText}>{post.location}</Text>
                  </View>
                  <View style={styles.postBadgeSoft}>
                    <CalendarDays size={12} color="#6B7280" />
                    <Text style={styles.postBadgeSoftText}>{formatShortDate(post.createdAt)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.postApplications}>
                <Text style={styles.postApplicationsValue}>{post.applications.toLocaleString()}</Text>
                <Text style={styles.postApplicationsMeta}>{post.applicationsPercent.toFixed(1)}%</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
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
  analyticsContainer: { gap: 16, backgroundColor: "#111117", borderRadius: 18, borderWidth: 1, borderColor: "#1F2937", padding: 18 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: { flex: 1, minWidth: 160, backgroundColor: "#171724", borderRadius: 16, borderWidth: 1, borderColor: "#24243A", padding: 16 },
  summaryIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  summaryLabel: { color: "#A5B4FC", fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.3 },
  summaryValue: { color: "#F9FAFB", fontSize: 24, fontWeight: "800" as const, marginBottom: 6 },
  summaryMeta: { color: "#9CA3AF", fontSize: 12, fontWeight: "600" as const },
  distributionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  distributionCard: { flex: 1, minWidth: 220, backgroundColor: "#15151F", borderRadius: 16, borderWidth: 1, borderColor: "#23233A", padding: 16 },
  distributionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  distributionIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  distributionTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" as const },
  distributionList: { gap: 10 },
  distributionItem: { gap: 6 },
  distributionLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  distributionLabel: { color: "#D1D5DB", fontSize: 12, fontWeight: "700" as const, flex: 1, marginRight: 12 },
  distributionPercent: { color: "#60A5FA", fontSize: 12, fontWeight: "700" as const },
  distributionTrack: { height: 6, borderRadius: 4, backgroundColor: "#1E293B", overflow: "hidden" },
  distributionFill: { height: 6, borderRadius: 4 },
  distributionCount: { color: "#6B7280", fontSize: 11, fontWeight: "600" as const },
  analyticsLoading: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 12 },
  analyticsLoadingText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" as const },
  analyticsError: { alignItems: "center", gap: 12, paddingVertical: 24 },
  analyticsErrorText: { color: "#F87171", fontSize: 13, fontWeight: "700" as const },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#1F2937" },
  retryBtnText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700" as const },
  postList: { gap: 12 },
  postListHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  postListHeaderTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" as const, letterSpacing: 0.3 },
  postListHeaderSub: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
  postRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#14141C", borderWidth: 1, borderColor: "#222233", borderRadius: 14, padding: 14, gap: 12 },
  postInfo: { flex: 1, gap: 8 },
  postTitle: { color: "#F9FAFB", fontSize: 15, fontWeight: "800" as const },
  postMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  postBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(139, 92, 246, 0.12)" },
  postBadgeText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" as const },
  postBadgeSoft: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#1B1B24" },
  postBadgeSoftText: { color: "#9CA3AF", fontSize: 12, fontWeight: "600" as const },
  postApplications: { alignItems: "flex-end", gap: 4, minWidth: 64 },
  postApplicationsValue: { color: "#FDE68A", fontSize: 18, fontWeight: "800" as const },
  postApplicationsMeta: { color: "#FACC15", fontSize: 12, fontWeight: "700" as const },
  emptyState: { color: "#6B7280", fontSize: 12, fontWeight: "600" as const, textAlign: "center" as const },
});
