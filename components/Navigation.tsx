import React, { memo, useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, Image } from "react-native";
import { ArrowLeft, Bell, LogOut, Plus, Search, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";

export type AppView = "home" | "jobs" | "profile" | "messages" | "applicants" | "analytics" | "network" | "mynetwork";

interface ProfileData {
  profile_picture?: string;
  full_name?: string;
}

interface NavigationProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onCreateOpportunity?: () => void;
  showUserProfile?: string | null;
  setShowUserProfile?: (userId: string | null) => void;
  profileData?: ProfileData | null;
  disableScrollHide?: boolean;
  hideNavigation?: boolean;
  unreadCount?: number;
  alertCount?: number;
  onBellPress?: () => void;
  onLogout?: () => void;
}

const AVATAR_PLACEHOLDER = "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=256&auto=format&fit=crop&q=60";

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second || first || "U").toUpperCase();
}

const Navigation: React.FC<NavigationProps> = ({
  currentView,
  setCurrentView,
  showBackButton = false,
  onBackClick,
  searchQuery = "",
  onSearchChange,
  onCreateOpportunity,
  showUserProfile,
  setShowUserProfile,
  profileData,
  hideNavigation = false,
  unreadCount = 0,
  alertCount = 0,
  onBellPress,
  onLogout,
}) => {
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);
  const router = useRouter();

  const name = profileData?.full_name ?? "User";
  const avatarUri = profileData?.profile_picture || AVATAR_PLACEHOLDER;
  const initials = useMemo(() => getInitials(name), [name]);

  const canSearch = currentView === "jobs" || currentView === "applicants";

  const handleAvatarPress = useCallback(() => {
    console.log("Navigation: avatar pressed");
    try {
      router.push("/profile/edit");
    } catch (e) {
      setCurrentView("profile");
    }
  }, [router, setCurrentView]);

  const handleBellPress = useCallback(() => {
    console.log("Navigation: bell pressed");
    if (onBellPress) onBellPress();
    else setCurrentView("applicants");
  }, [onBellPress, setCurrentView]);

  const handleLogoutPress = useCallback(() => {
    console.log("Navigation: logout pressed");
    onLogout?.();
  }, [onLogout]);

  if (hideNavigation) return null;

  return (
    <View style={styles.container} testID="nav-container">
      <View style={styles.bar}>
        <View style={styles.left}>
          {showBackButton && (
            <Pressable
              onPress={onBackClick}
              style={styles.iconBtn}
              testID="nav-back"
              android_ripple={{ color: "#00000022", borderless: true }}
            >
              <ArrowLeft color={Colors.light.text} size={20} />
            </Pressable>
          )}

          <Pressable
            onPress={handleAvatarPress}
            style={styles.profileBtn}
            testID="nav-profile"
          >
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <User color="#666" size={16} />
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={styles.profileName}>
              {name}
            </Text>
          </Pressable>
        </View>

        <View style={styles.right}>
          {canSearch && (
            <Pressable
              onPress={() => setShowSearchInput((s) => !s)}
              style={styles.iconBtn}
              testID="nav-search"
              android_ripple={{ color: "#00000022", borderless: true }}
            >
              <Search color={Colors.light.text} size={20} />
            </Pressable>
          )}

          <View style={styles.iconBadgeWrap}>
            <Pressable
              onPress={handleBellPress}
              style={styles.iconBtn}
              testID="nav-bell"
              android_ripple={{ color: "#00000022", borderless: true }}
            >
              <Bell color={currentView === "applicants" ? Colors.light.tint : Colors.light.text} size={20} />
            </Pressable>
            {alertCount > 0 && (
              <View style={styles.badge} testID="badge-alerts">
                <Text style={styles.badgeText}>{alertCount > 99 ? "99+" : String(alertCount)}</Text>
              </View>
            )}
          </View>

          {currentView === "jobs" && onCreateOpportunity && (
            <Pressable
              onPress={onCreateOpportunity}
              style={styles.iconBtn}
              testID="nav-plus"
              android_ripple={{ color: "#00000022", borderless: true }}
            >
              <Plus color={Colors.light.text} size={20} />
            </Pressable>
          )}

          <Pressable
            onPress={handleLogoutPress}
            style={styles.iconBtn}
            testID="nav-logout"
            android_ripple={{ color: "#00000022", borderless: true }}
          >
            <LogOut color={Colors.light.text} size={20} />
          </Pressable>
        </View>
      </View>

      {showSearchInput && canSearch && (
        <View style={styles.searchRow}>
          <Search color="#8A8A8E" size={16} />
          <Pressable
            onPress={() => {}}
            style={styles.searchField}
            testID="nav-search-field"
          >
            <Text style={styles.searchPlaceholder}>
              {currentView === "jobs" ? "Search opportunities..." : "Search applicants..."}
            </Text>
          </Pressable>
        </View>
      )}

      {Platform.OS !== "web" && !showUserProfile && (
        <View style={styles.bottomBar} testID="bottom-nav">
          {(
            [
              { key: "home" as const, label: "Home" },
              { key: "jobs" as const, label: "Jobs" },
              { key: "network" as const, label: "Network" },
              { key: "messages" as const, label: "Messages" },
              { key: "profile" as const, label: "Profile" },
            ]
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setCurrentView(t.key)}
              style={styles.tabBtn}
              testID={`tab-${t.key}`}
            >
              <Text style={[styles.tabLabel, currentView === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {t.key === "messages" && unreadCount > 0 && (
                <View style={styles.smallBadge} testID="badge-unread">
                  <Text style={styles.smallBadgeText}>{unreadCount > 99 ? "99+" : String(unreadCount)}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

export default memo(Navigation);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: Colors.light.background,
    borderBottomColor: Colors.light.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    padding: 8,
    borderRadius: 999,
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    borderColor: Colors.light.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 32,
    height: 32,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    maxWidth: 140,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchField: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    borderColor: Colors.light.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchPlaceholder: {
    color: "#8A8A8E",
    fontSize: 14,
  },
  iconBadgeWrap: {
    marginRight: 4,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 3,
  },
  bottomBar: {
    borderTopColor: Colors.light.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  tabLabelActive: {
    color: Colors.light.tint,
  },
  smallBadge: {
    position: "absolute",
    top: -2,
    right: -6,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  smallBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
