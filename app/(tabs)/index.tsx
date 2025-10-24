import React, { useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Bookmark, ChevronDown, CircleUserRound, Filter, Search, Send, Shapes, Check } from "lucide-react-native";

interface FeedItem {
  id: string;
  user: string;
  avatar: string;
  ago: string;
  media: string;
}

const MOCK_FEED: FeedItem[] = [
  {
    id: "1",
    user: "thebrxnd",
    avatar: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=128&auto=format&fit=crop&q=60",
    ago: "42d ago",
    media: "https://images.unsplash.com/photo-1520975693410-001e27b7d8f9?w=1080&auto=format&fit=crop&q=60",
  },
  {
    id: "2",
    user: "alessia",
    avatar: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=128&auto=format&fit=crop&q=60",
    ago: "12d ago",
    media: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1080&auto=format&fit=crop&q=60",
  },
];

const FILTER_ROLE_GROUPS = [
  {
    label: "Creatives",
    items: ["Photographer", "Model", "Videographer", "Content Creator", "Stylist", "Designer", "Creative Director"],
  },
  {
    label: "Clients",
    items: ["Brand", "Agency", "Producer", "Casting"],
  },
] as const;

export default function OpportunitiesScreen() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [selectedView, setSelectedView] = useState<"all" | "applied" | "mine" | "saved">("all");
  const [selectedRole, setSelectedRole] = useState<string>("All Roles");

  const containerStyle = useMemo(() => [styles.container], []);

  return (
    <View style={containerStyle} testID="opportunities-screen">
      <SafeAreaView edges={["top"]}>
        <View style={styles.topBar}>
          <Pressable style={styles.profile} testID="top-profile" onPress={() => console.log("profile") }>
            <Image source={{ uri: MOCK_FEED[0].avatar }} style={styles.avatar} />
            <Text style={styles.profileText}>test</Text>
          </Pressable>

          <View style={styles.topIcons}>
            <Pressable onPress={() => console.log("search") } style={styles.iconBtn} testID="top-search">
              <Search color="#E5E7EB" size={20} />
            </Pressable>
            <Pressable onPress={() => console.log("bell") } style={styles.iconBtn} testID="top-bell">
              <Bell color="#E5E7EB" size={20} />
            </Pressable>
            <Pressable onPress={() => console.log("create") } style={styles.iconBtn} testID="top-plus">
              <Send color="#E5E7EB" size={20} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} testID="feed-scroll">
        <View style={styles.selectorWrap}>
          <Pressable style={styles.selector} onPress={() => setMenuOpen((s) => !s)} testID="view-selector">
            <Shapes color="#E5E7EB" size={18} />
            <Text style={styles.selectorText}>{
              selectedView === "all" ? "All Opportunities" :
              selectedView === "applied" ? "Applied" :
              selectedView === "mine" ? "Posted by Me" : "Saved"
            }</Text>
            <ChevronDown color="#E5E7EB" size={18} />
          </Pressable>
          <Pressable style={styles.filterBtn} onPress={() => setFilterOpen((s) => !s)} testID="filter-toggle">
            <Filter color="#E5E7EB" size={16} />
            <Text style={styles.filterText}>Filter Opportunities</Text>
            <ChevronDown color="#E5E7EB" size={16} />
          </Pressable>
        </View>

        {menuOpen && (
          <View style={styles.menu} testID="view-menu">
            {(
              [
                { key: "all" as const, icon: <Shapes color="#E5E7EB" size={18} /> , label: "All Opportunities" },
                { key: "applied" as const, icon: <Check color="#E5E7EB" size={18} />, label: "Applied" },
                { key: "mine" as const, icon: <Send color="#E5E7EB" size={18} />, label: "Posted by Me" },
                { key: "saved" as const, icon: <Bookmark color="#E5E7EB" size={18} />, label: "Saved" },
              ]
            ).map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.menuItem, selectedView === opt.key && styles.menuItemActive]}
                onPress={() => { setSelectedView(opt.key); setMenuOpen(false); }}
                testID={`menu-${opt.key}`}
              >
                <View style={{ width: 22, alignItems: "center" }}>{opt.icon}</View>
                <Text style={styles.menuLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {filterOpen && (
          <View style={styles.filterPanel} testID="filter-panel">
            <Text style={styles.filterHeader}>Location</Text>
            <Pressable style={styles.input} testID="filter-location"><Text style={styles.inputPlaceholder}>Enter city name</Text></Pressable>

            <Text style={[styles.filterHeader, { marginTop: 16 }]}>Seeking a</Text>
            <Pressable style={styles.selector} onPress={() => {}} testID="role-selector">
              <CircleUserRound color="#E5E7EB" size={18} />
              <Text style={styles.selectorText}>{selectedRole}</Text>
              <ChevronDown color="#E5E7EB" size={18} />
            </Pressable>

            <View style={styles.roleMenu}>
              {FILTER_ROLE_GROUPS.map((group) => (
                <View key={group.label} style={{ marginBottom: 10 }}>
                  <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
                  {group.items.map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.roleItem, selectedRole === r && styles.menuItemActive]}
                      onPress={() => setSelectedRole(r)}
                      testID={`role-${r}`}
                    >
                      <Text style={styles.menuLabel}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {MOCK_FEED.map((item) => (
          <View key={item.id} style={styles.card} testID={`feed-${item.id}`}>
            <View style={styles.cardHeader}>
              <Image source={{ uri: item.avatar }} style={styles.cardAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardUser}>{item.user}</Text>
                <Text style={styles.cardMeta}>{item.ago} • </Text>
              </View>
              <Image
                source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" }}
                style={{ width: 22, height: 22, borderRadius: 11 }}
              />
            </View>
            <Image source={{ uri: item.media }} style={styles.media} resizeMode="cover" />
          </View>
        ))}
      </ScrollView>

      {Platform.OS !== "web" && (
        <View style={styles.tabBar} testID="bottom-tabs">
          {[
            { key: "opportunities", label: "Opportunities" },
            { key: "network", label: "Network" },
            { key: "messages", label: "Messages" },
          ].map((t) => (
            <Pressable key={t.key} style={styles.tabBtn} onPress={() => console.log("tab", t.key)}>
              <Text style={[styles.tabLabel, t.key === "opportunities" && styles.tabActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profile: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  profileText: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" },
  topIcons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8, borderRadius: 999 },

  scroll: { paddingHorizontal: 12, paddingBottom: 80 },

  selectorWrap: { gap: 10, marginBottom: 10 },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  selectorText: { color: "#E5E7EB", fontSize: 15, fontWeight: "600", flex: 1 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterText: { color: "#E5E7EB", fontSize: 16, fontWeight: "700", flex: 1 },

  menu: {
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  menuItemActive: { backgroundColor: "#1A1A22" },
  menuLabel: { color: "#E5E7EB", fontSize: 15, fontWeight: "600" },

  filterPanel: {
    backgroundColor: "#0F0F14",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  filterHeader: { color: "#E5E7EB", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputPlaceholder: { color: "#9CA3AF", fontSize: 14 },

  roleMenu: { marginTop: 6 },
  groupLabel: { color: "#9CA3AF", fontSize: 12, marginBottom: 6 },
  roleItem: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10 },

  card: { backgroundColor: "#121218", borderRadius: 14, overflow: "hidden", marginBottom: 14, borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  cardAvatar: { width: 36, height: 36, borderRadius: 18 },
  cardUser: { color: "#E5E7EB", fontSize: 15, fontWeight: "800" },
  cardMeta: { color: "#A1A1AA", fontSize: 12 },
  media: { width: "100%", height: 260 },

  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#0C0C12",
    borderTopColor: "#23232B",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  tabBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  tabLabel: { color: "#9CA3AF", fontWeight: "700", fontSize: 12 },
  tabActive: { color: "#FFFFFF" },
});
