import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, API_URL } from "../../src/auth";
import { t } from "../../src/i18n";
import { colors, radius, spacing } from "../../src/theme";

export default function Chat() {
  const { token, user, lang } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!token) return;
    const wsUrl = API_URL.replace(/^http/, "ws") + `/api/ws/chat?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "history") setMessages(data.messages);
        else if (data.type === "message") {
          setMessages(prev => [...prev, data.message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        }
      } catch {}
    };
    return () => ws.close();
  }, [token]);

  const send = () => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ text }));
    setText("");
  };

  const renderItem = ({ item }: any) => {
    const mine = item.user_id === user?.id;
    const teacher = item.user_role === "teacher";
    return (
      <View style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
        <View style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          teacher && !mine && styles.bubbleTeacher,
        ]}>
          {!mine && (
            <Text style={[styles.author, teacher && { color: colors.primary }]}>
              {item.user_name}{teacher ? " · Teacher" : ""}
            </Text>
          )}
          <Text style={[styles.msgText, mine && { color: "#fff" }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("global_chat", lang)}</Text>
          <View style={[styles.dot, { backgroundColor: connected ? colors.success : colors.error }]} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          testID="chat-messages-list"
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={t("send_message", lang)}
            placeholderTextColor={colors.textDisabled}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            testID="chat-input"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} testID="chat-send-button">
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.md, flexDirection: "row", alignItems: "center", gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "900", color: colors.textPrimary, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  list: { padding: spacing.md, gap: 6, paddingBottom: 20 },
  bubbleRow: { flexDirection: "row", marginBottom: 6 },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4,
  },
  bubbleTeacher: { backgroundColor: "#FFF4D6", borderColor: colors.secondary },
  author: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, marginBottom: 2 },
  msgText: { fontSize: 15, color: colors.textPrimary },
  inputBar: {
    flexDirection: "row", padding: 10, gap: 8, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, minHeight: 48, backgroundColor: colors.highlight, borderRadius: radius.pill,
    paddingHorizontal: 16, fontSize: 15, color: colors.textPrimary,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: radius.pill,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
});
