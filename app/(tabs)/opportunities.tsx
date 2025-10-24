import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Building2, Filter, MapPin, ThumbsUp } from "lucide-react-native";

interface Opportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  image: string;
  upvotes: number;
}

const MOCK_OPPS: Opportunity[] = [
  {
    id: "o1",
    title: "Lifestyle Shoot for Summer Campaign",
    company: "Bright Studio",
    location: "Los Angeles, CA",
    type: "Contract",
    image:
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&auto=format&fit=crop&q=60",
    upvotes: 128,
  },
  {
    id: "o2",
    title: "Product Photographer (Tech Gadgets)",
    company: "Volt Labs",
    location: "Remote",
    type: "Part-time",
    image:
      "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200&auto=format&fit=crop&q=60",
    upvotes: 64,
  },
  {
    id: "o3",
    title: "Event Videographer for Music Festival",
    company: "Northwave",
    location: "Austin, TX",
    type: "Weekend",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=60",
    upvotes: 203,
  },
];

export default function OpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const container = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  function toggleUpvote(id: string) {
    setLiked((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <View style={container} testID="opportunities-screen">
      <View style={styles.header}>
        <Text style={styles.h1}>Opportunities</Text>
        <Pressable style={styles.filterBtn} onPress={() => {}} testID="opp-filter">
          <Filter color="#E5E7EB" size={18} />
          <Text style={styles.filterText}>Filters</Text>
        </Pressable>
      </View>

      <FlatList
        data={MOCK_OPPS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`opp-${item.id}`}>
            <Image source={{ uri: item.image }} style={styles.cover} resizeMode="cover" />
            <View style={styles.body}>
              <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
              <View style={styles.row}>
                <Building2 color="#9CA3AF" size={14} />
                <Text numberOfLines={1} style={styles.metaText}>{item.company}</Text>
              </View>
              <View style={styles.row}>
                <MapPin color="#9CA3AF" size={14} />
                <Text numberOfLines={1} style={styles.metaText}>{item.location} • {item.type}</Text>
              </View>

              <View style={styles.footerRow}>
                <Pressable style={styles.upvote} onPress={() => toggleUpvote(item.id)} testID={`upvote-${item.id}`}>
                  <ThumbsUp color={liked[item.id] ? "#10B981" : "#E5E7EB"} size={16} />
                  <Text style={[styles.upvoteText, liked[item.id] && styles.upvoteActive]}>{item.upvotes + (liked[item.id] ? 1 : 0)}</Text>
                </Pressable>

                <Pressable style={styles.applyBtn} onPress={() => {}} testID={`apply-${item.id}`}>
                  <Text style={styles.applyText}>Apply</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { color: "#E5E7EB", fontSize: 24, fontWeight: "900" },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700" },
  list: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  cover: { width: "100%", height: 160 },
  body: { padding: 12 },
  title: { color: "#E5E7EB", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaText: { color: "#9CA3AF", fontSize: 12, flexShrink: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  upvote: { flexDirection: "row", alignItems: "center", gap: 6 },
  upvoteText: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },
  upvoteActive: { color: "#10B981" },
  applyBtn: { backgroundColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  applyText: { color: "#0B0B0F", fontSize: 14, fontWeight: "900" },
});
