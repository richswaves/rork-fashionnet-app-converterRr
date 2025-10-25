import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send, Users, Search, MessageCircle } from "lucide-react-native";
import { getSupabase } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id?: string;
  group_conversation_id?: string;
  created_at: string;
  read_at?: string | null;
  sender?: {
    user_id: string;
    full_name?: string;
    username?: string;
    profile_picture?: string;
  };
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  updated_at: string;
  lastMessage?: Message;
  otherUser?: {
    user_id: string;
    full_name?: string;
    username?: string;
    profile_picture?: string;
  };
  unreadCount?: number;
  isGroup?: boolean;
}

interface GroupConversation {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  created_by: string;
  updated_at: string;
  lastMessage?: Message;
  unreadCount?: number;
  isGroup: true;
}

type ConversationItem = Conversation | GroupConversation;

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUserId, getDisplayForProfile } = useProfile();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const flatListRef = useRef<FlatList>(null);

  const supabase = getSupabase();

  const loadConversations = useCallback(async () => {
    if (!supabase || !currentUserId) {
      setLoading(false);
      return;
    }

    try {
      console.log("[Messages] Loading conversations for user:", currentUserId);

      const { data: individualConvs, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_1.eq.${currentUserId},participant_2.eq.${currentUserId}`)
        .order("updated_at", { ascending: false });

      if (convError) {
        console.error("[Messages] Error loading individual conversations:", convError);
      }

      const { data: groupParticipants, error: groupError } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          group_conversations!inner(id, name, description, image_url, created_by, updated_at)
        `)
        .eq("user_id", currentUserId);

      if (groupError) {
        console.error("[Messages] Error loading group conversations:", groupError);
      }

      const allConvs: ConversationItem[] = [];

      if (individualConvs && individualConvs.length > 0) {
        const otherUserIds = individualConvs.map((conv) =>
          conv.participant_1 === currentUserId ? conv.participant_2 : conv.participant_1
        );

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, username, profile_picture")
          .in("user_id", otherUserIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

        for (const conv of individualConvs) {
          const otherUserId = conv.participant_1 === currentUserId ? conv.participant_2 : conv.participant_1;
          const otherUser = profileMap.get(otherUserId);

          const { data: lastMsg } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const { count: unreadCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("sender_id", currentUserId)
            .is("read_at", null);

          allConvs.push({
            ...conv,
            otherUser,
            lastMessage: lastMsg || undefined,
            unreadCount: unreadCount || 0,
            isGroup: false,
          });
        }
      }

      if (groupParticipants && groupParticipants.length > 0) {
        for (const gp of groupParticipants) {
          const gc = (gp as any).group_conversations;
          if (!gc) continue;

          const { data: lastMsg } = await supabase
            .from("messages")
            .select("*")
            .eq("group_conversation_id", gc.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const { count: unreadCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("group_conversation_id", gc.id)
            .neq("sender_id", currentUserId)
            .is("read_at", null);

          allConvs.push({
            id: gc.id,
            name: gc.name,
            description: gc.description,
            image_url: gc.image_url,
            created_by: gc.created_by,
            updated_at: gc.updated_at,
            lastMessage: lastMsg || undefined,
            unreadCount: unreadCount || 0,
            isGroup: true,
          } as GroupConversation);
        }
      }

      allConvs.sort((a, b) => {
        const aTime = a.lastMessage?.created_at || a.updated_at;
        const bTime = b.lastMessage?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      console.log("[Messages] Loaded conversations:", allConvs.length);
      setConversations(allConvs);
    } catch (error) {
      console.error("[Messages] Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUserId]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!supabase || !currentUserId) return;

      try {
        console.log("[Messages] Loading messages for conversation:", conversationId);

        const selectedConv = conversations.find((c) => c.id === conversationId);
        const isGroup = selectedConv?.isGroup;

        const query = supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: true });

        if (isGroup) {
          query.eq("group_conversation_id", conversationId);
        } else {
          query.eq("conversation_id", conversationId);
        }

        const { data: msgs, error } = await query;

        if (error) {
          console.error("[Messages] Error loading messages:", error);
          return;
        }

        const senderIds = [...new Set(msgs?.map((m) => m.sender_id) ?? [])];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, username, profile_picture")
          .in("user_id", senderIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

        const messagesWithSenders: Message[] = (msgs ?? []).map((msg) => ({
          ...msg,
          sender: profileMap.get(msg.sender_id),
        }));

        console.log("[Messages] Loaded messages:", messagesWithSenders.length);
        setMessages(messagesWithSenders);

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        await markMessagesAsRead(conversationId, isGroup);
      } catch (error) {
        console.error("[Messages] Error loading messages:", error);
      }
    },
    [supabase, currentUserId, conversations]
  );

  const markMessagesAsRead = useCallback(
    async (conversationId: string, isGroup?: boolean) => {
      if (!supabase || !currentUserId) return;

      try {
        const updateData = { read_at: new Date().toISOString() };
        const query = supabase
          .from("messages")
          .update(updateData)
          .neq("sender_id", currentUserId)
          .is("read_at", null);

        if (isGroup) {
          query.eq("group_conversation_id", conversationId);
        } else {
          query.eq("conversation_id", conversationId);
        }

        const { error } = await query;

        if (error) {
          console.error("[Messages] Error marking messages as read:", error);
        } else {
          console.log("[Messages] Messages marked as read");
        }
      } catch (error) {
        console.error("[Messages] Error marking messages as read:", error);
      }
    },
    [supabase, currentUserId]
  );

  const sendMessage = useCallback(async () => {
    if (!supabase || !currentUserId || !selectedConversation || !newMessage.trim()) return;

    setSendingMessage(true);

    try {
      console.log("[Messages] Sending message to conversation:", selectedConversation);

      const selectedConv = conversations.find((c) => c.id === selectedConversation);
      const isGroup = selectedConv?.isGroup;

      const messageData: any = {
        sender_id: currentUserId,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
      };

      if (isGroup) {
        messageData.group_conversation_id = selectedConversation;
      } else {
        messageData.conversation_id = selectedConversation;
      }

      const { data: insertedMsg, error: msgError } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (msgError) {
        console.error("[Messages] Error sending message:", msgError);
        return;
      }

      const updateData = { updated_at: new Date().toISOString() };
      if (isGroup) {
        await supabase.from("group_conversations").update(updateData).eq("id", selectedConversation);
      } else {
        await supabase.from("conversations").update(updateData).eq("id", selectedConversation);
      }

      console.log("[Messages] Message sent successfully");
      setNewMessage("");

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, username, profile_picture")
        .eq("user_id", currentUserId)
        .single();

      const newMsg: Message = {
        ...insertedMsg,
        sender: profiles || undefined,
      };

      setMessages((prev) => [...prev, newMsg]);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("[Messages] Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  }, [supabase, currentUserId, selectedConversation, newMessage, conversations]);

  useEffect(() => {
    if (currentUserId) {
      loadConversations();
    }
  }, [currentUserId, loadConversations]);

  useEffect(() => {
    if (!supabase || !selectedConversation) return;

    const selectedConv = conversations.find((c) => c.id === selectedConversation);
    const isGroup = selectedConv?.isGroup;

    const channel = supabase
      .channel(`messages:${selectedConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: isGroup
            ? `group_conversation_id=eq.${selectedConversation}`
            : `conversation_id=eq.${selectedConversation}`,
        },
        async (payload) => {
          console.log("[Messages] New message received:", payload.new);

          const newMsg = payload.new as Message;

          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, username, profile_picture")
            .eq("user_id", newMsg.sender_id)
            .single();

          const msgWithSender: Message = {
            ...newMsg,
            sender: profiles || undefined,
          };

          setMessages((prev) => {
            const exists = prev.some((m) => m.id === msgWithSender.id);
            if (exists) return prev;
            return [...prev, msgWithSender];
          });

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);

          if (newMsg.sender_id !== currentUserId) {
            await markMessagesAsRead(selectedConversation, isGroup);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selectedConversation, currentUserId, conversations, markMessagesAsRead]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation, loadMessages]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      if (conv.isGroup) {
        const gc = conv as GroupConversation;
        return gc.name.toLowerCase().includes(query);
      } else {
        const c = conv as Conversation;
        const display = getDisplayForProfile(c.otherUser);
        return (
          display.displayName.toLowerCase().includes(query) ||
          display.username.toLowerCase().includes(query)
        );
      }
    });
  }, [conversations, searchQuery, getDisplayForProfile]);

  const renderConversationItem = useCallback(
    ({ item }: { item: ConversationItem }) => {
      const isGroup = item.isGroup;
      const name = isGroup
        ? (item as GroupConversation).name
        : getDisplayForProfile((item as Conversation).otherUser).displayName;
      const avatar = isGroup
        ? (item as GroupConversation).image_url ||
          "https://ui-avatars.com/api/?name=Group&background=6366f1&color=ffffff&size=256"
        : getDisplayForProfile((item as Conversation).otherUser).avatarUrl;
      const lastMessage = item.lastMessage?.content || "No messages yet";
      const unreadCount = item.unreadCount || 0;
      const time = item.lastMessage?.created_at
        ? new Date(item.lastMessage.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      return (
        <TouchableOpacity
          style={[
            styles.conversationItem,
            selectedConversation === item.id && styles.conversationItemSelected,
          ]}
          onPress={() => setSelectedConversation(item.id)}
        >
          <View style={styles.conversationAvatar}>
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
            {isGroup && (
              <View style={styles.groupBadge}>
                <Users size={12} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.conversationName} numberOfLines={1}>
                {name}
              </Text>
              {time && <Text style={styles.conversationTime}>{time}</Text>}
            </View>
            <View style={styles.conversationFooter}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {lastMessage}
              </Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [selectedConversation, getDisplayForProfile]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isOwn = item.sender_id === currentUserId;
      const senderDisplay = getDisplayForProfile(item.sender);
      const time = new Date(item.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
        <View style={[styles.messageWrapper, isOwn && styles.messageWrapperOwn]}>
          {!isOwn && (
            <Image source={{ uri: senderDisplay.avatarUrl }} style={styles.messageAvatar} />
          )}
          <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
            {!isOwn && (
              <Text style={styles.messageSender}>{senderDisplay.displayName}</Text>
            )}
            <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>{time}</Text>
          </View>
        </View>
      );
    },
    [currentUserId, getDisplayForProfile]
  );

  const currentConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversation);
  }, [conversations, selectedConversation]);

  const conversationTitle = useMemo(() => {
    if (!currentConversation) return "";
    if (currentConversation.isGroup) {
      return (currentConversation as GroupConversation).name;
    }
    return getDisplayForProfile((currentConversation as Conversation).otherUser).displayName;
  }, [currentConversation, getDisplayForProfile]);

  if (!currentUserId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Please log in to view messages</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!selectedConversation) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {filteredConversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageCircle size={64} color="#4B5563" />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation to see it here</Text>
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.conversationsList}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedConversation(null);
            setMessages([]);
            loadConversations();
          }}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.chatHeaderTitle} numberOfLines={1}>
          {conversationTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messagesList, { paddingBottom: insets.bottom + 80 }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#6B7280"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sendingMessage}
        >
          {sendingMessage ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
  },
  conversationsList: {
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  conversationItemSelected: {
    backgroundColor: "#1F2937",
  },
  conversationAvatar: {
    marginRight: 16,
    position: "relative",
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#374151",
  },
  groupBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6366f1",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0B0B0F",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  conversationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: "#9CA3AF",
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  chatHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  messagesList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
  },
  messageWrapperOwn: {
    flexDirection: "row-reverse",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "#374151",
  },
  messageBubble: {
    maxWidth: "70%",
    backgroundColor: "#1F2937",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageBubbleOwn: {
    backgroundColor: "#6366f1",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: "#fff",
    lineHeight: 22,
  },
  messageTextOwn: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  messageTimeOwn: {
    color: "#E0E7FF",
  },
  inputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#0B0B0F",
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
  },
  input: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: "#fff",
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
