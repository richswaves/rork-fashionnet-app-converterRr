import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import PieChart, { PieLegend } from "@/components/admin/PieChart";
import { trpc } from "@/lib/trpc";

export default function OnboardingQuestionAnalytics() {
  const query = trpc.admin.getFunnelData.useQuery(undefined, { staleTime: 30000 });

  const grouped = useMemo(() => {
    const map = new Map<string, { question: string; answers: { label: string; value: number }[] }[]>();
    (query.data ?? []).forEach(item => {
      const role = item.role ?? "unknown";
      const answers = (item.answers ?? []).map(a => ({ label: a.option, value: a.count }));
      const arr = map.get(role) ?? [];
      arr.push({ question: item.question, answers });
      map.set(role, arr);
    });
    return Array.from(map.entries()).map(([role, items]) => ({ role, items }));
  }, [query.data]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor="#fff" />}
      testID="question-analytics-scroll"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Question Analytics</Text>
        <Text style={styles.subtitle}>Distribution of answers per question</Text>
      </View>

      {(grouped.length === 0 && !query.isLoading) ? (
        <View style={styles.empty} testID="qa-empty">
          <Text style={styles.emptyText}>No analytics available</Text>
        </View>
      ) : null}

      {grouped.map(section => (
        <View key={section.role} style={styles.section} testID={`role-${section.role}`}>
          <Text style={styles.sectionTitle}>{section.role}</Text>
          <View style={styles.grid}>
            {section.items.map((q, idx) => (
              <View key={`${section.role}-${idx}`} style={styles.card} testID={`question-card-${idx}`}>
                <Text style={styles.question} numberOfLines={2}>{q.question}</Text>
                <PieChart data={q.answers} size={160} innerRadius={48} />
                <PieLegend data={q.answers} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  headerRow: { gap: 4 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" as const },
  subtitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
  empty: { backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
  section: { gap: 10 },
  sectionTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" as const },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "48%", backgroundColor: "#15151A", borderColor: "#2A2A33", borderWidth: 1, borderRadius: 14, padding: 12 },
  question: { color: "#E5E7EB", fontSize: 13, fontWeight: "800" as const, marginBottom: 10 },
});
