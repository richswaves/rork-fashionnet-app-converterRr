import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import GrainTexture from "@/components/GrainTexture";
import { ArrowLeft } from "lucide-react-native";

const questionLabels: Record<string, string> = {
  shoot_types: "What types of shoots do you focus on?",
  showcase_where: "Where do you showcase most of your work?",
  connect_with: "Who are you most interested in connecting with?",
  audience_size: "Roughly how many followers / audience reach do you have?",
  what_you_want: "What do you want most from your connections here?",
  what_matters_most: "What matters most to you when choosing who to collaborate with?",
  primarily_shoot: "What do you primarily shoot?",
  aesthetic: "How would you describe your aesthetic?",
  projects_per_month: "Average number of projects per month?",
  video_work: "What type of video work do you create most often?",
  approach: "What best describes your approach?",
  prefer_collab: "Who do you prefer collaborating with?",
  monthly_output: "Average monthly content output?",
  content_kind: "What kind of content do you create most?",
  audience_strongest: "Where is your audience strongest?",
  collab_with: "Who do you want to collaborate with here?",
  follower_range: "Follower range / audience size?",
  style_for: "You mainly style for…",
  top_collaborators: "Who are your top collaborators?",
  design_focus: "Your design focus is…",
  release_where: "Where do you release?",
  ideal_collaborators: "Who are your ideal collaborators?",
  pieces_per_year: "How many pieces or collections do you produce per year?",
  direct_mainly: "You mainly direct…",
  strongest_contrib: "What is your strongest contribution?",
  partnerships_prioritize: "What types of partnerships do you prioritize?",
  team_size: "Approximate team size you manage or lead?",
  what_make: "What do you make or sell?",
  who_need: "Who do you need to work with?",
  most_help_with: "What do you most need help with?",
  drop_frequency: "How often do you drop?",
  drop_frequency_followup: "How often do you drop (collections)?",
  specialize_in: "What does your agency specialize in?",
  typical_clients: "Who are your typical clients?",
  work_with_most: "What types of creatives do you work with most?",
  monthly_projects: "Average monthly projects?",
  business_offer: "What does your business offer?",
  primarily_serve: "Who do you primarily serve?",
  open_collaborations: "What types of collaborations are you open to?",
  shoots_per_month: "Average shoots per month?",
  publication_kind: "What kind of publication do you run?",
  editorial_focus: "What is your main editorial focus?",
  publish_how_often: "How often do you publish?",
  feature_collab_with: "Who do you typically feature or collaborate with?",
  business_desc: "What best describes your business?",
  need_connect_with: "Who do you need to connect with?",
  primary_goals: "What are your primary business goals?",
};

export default function FunnelPage() {
  const router = useRouter();
  const funnelQuery = trpc.admin.getFunnelData.useQuery();

  type FunnelDataItem = NonNullable<typeof funnelQuery.data>[number];

  const groupedByRole = useMemo(() => {
    if (!funnelQuery.data) return new Map<string, FunnelDataItem[]>();
    
    const map = new Map<string, FunnelDataItem[]>();
    
    for (const item of funnelQuery.data) {
      if (!map.has(item.role)) {
        map.set(item.role, []);
      }
      map.get(item.role)!.push(item);
    }
    
    return map;
  }, [funnelQuery.data]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Funnel Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={funnelQuery.isRefetching}
            onRefresh={() => funnelQuery.refetch()}
            tintColor="#fff"
          />
        }
      >
        {funnelQuery.isLoading && (
          <View style={styles.center}>
            <Text style={styles.loadingText}>Loading funnel data...</Text>
          </View>
        )}

        {funnelQuery.error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Error: {funnelQuery.error.message}</Text>
            <Text style={[styles.errorText, { fontSize: 12, marginTop: 8 }]}>
              {JSON.stringify(funnelQuery.error, null, 2)}
            </Text>
          </View>
        )}

        {funnelQuery.data && (
          <>
            {Array.from(groupedByRole.entries()).map(([role, questions]) => (
              <View key={role} style={styles.roleSection}>
                <Text style={styles.roleTitle}>{role.replace(/_/g, " ")}</Text>
                
                {questions.map((q: FunnelDataItem) => {
                  const maxCount = Math.max(1, ...q.answers.map((a: { option: string; count: number }) => a.count));
                  const questionLabel = questionLabels[q.question] || q.question;
                  
                  return (
                    <View key={q.question} style={styles.questionCard}>
                      <Text style={styles.questionTitle}>{questionLabel}</Text>
                      <View style={styles.answersContainer}>
                        {q.answers.map((ans: { option: string; count: number }) => {
                          const widthPct = Math.max(6, Math.round((ans.count / maxCount) * 100));
                          return (
                            <View key={ans.option} style={styles.answerRow}>
                              <Text style={styles.answerLabel} numberOfLines={2}>
                                {ans.option}
                              </Text>
                              <View style={styles.answerBarContainer}>
                                <View style={[styles.answerBar, { width: `${widthPct}%` }]} />
                              </View>
                              <Text style={styles.answerCount}>{ans.count}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" as const },
  content: { padding: 16, gap: 24, paddingBottom: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  loadingText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600" as const },
  errorText: { color: "#EF4444", fontSize: 14, fontWeight: "600" as const },
  roleSection: {
    gap: 16,
    marginBottom: 20,
  },
  roleTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800" as const,
    textTransform: "capitalize" as const,
    marginBottom: 8,
  },
  questionCard: {
    backgroundColor: "#15151A",
    borderColor: "#2A2A33",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  questionTitle: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  answersContainer: { gap: 10 },
  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  answerLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600" as const,
    flex: 1.2,
  },
  answerBarContainer: {
    flex: 2,
    height: 24,
    backgroundColor: "#1F2937",
    borderRadius: 8,
    overflow: "hidden" as const,
  },
  answerBar: {
    height: 24,
    backgroundColor: "#8B5CF6",
    borderRadius: 8,
  },
  answerCount: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700" as const,
    width: 40,
    textAlign: "right" as const,
  },
});
