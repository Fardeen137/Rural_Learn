import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { t } from "../src/i18n";
import { colors, radius, spacing } from "../src/theme";

export default function Admin() {
  const { apiFetch, user, lang } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "ta">("en");
  const [ytId, setYtId] = useState("");
  const [lessons, setLessons] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  if (user?.role !== "teacher") {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.denied}>Teacher role required.</Text>
      </SafeAreaView>
    );
  }

  const addLesson = () => {
    if (!ytId.trim()) return;
    setLessons(prev => [...prev, { title: `Lesson ${prev.length + 1}`, type: "video", youtube_id: ytId.trim(), duration_min: 5 }]);
    setYtId("");
  };

  const save = async () => {
    if (!title || !subject) { Alert.alert("Please fill title and subject"); return; }
    setSaving(true);
    const res = await apiFetch("/api/courses", {
      method: "POST",
      body: JSON.stringify({
        title, description, subject, language,
        thumbnail: "https://images.unsplash.com/photo-1760009229725-7ef1990e585f?w=600&q=60",
        lessons,
        quizzes: [],
      }),
    });
    setSaving(false);
    if (res.ok) {
      Alert.alert("Course created!");
      router.back();
    } else {
      const d = await res.json();
      Alert.alert("Error", typeof d.detail === "string" ? d.detail : "Could not create");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="admin-back">
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>{t("create_course", lang)}</Text>
          </View>

          <Text style={styles.label}>{t("title", lang)}</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} testID="admin-title-input" />

          <Text style={styles.label}>{t("description", lang)}</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            multiline
            value={description}
            onChangeText={setDescription}
            testID="admin-desc-input"
          />

          <Text style={styles.label}>{t("subject", lang)}</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} testID="admin-subject-input" />

          <Text style={styles.label}>{t("language", lang)}</Text>
          <View style={styles.langRow}>
            {(["en", "hi", "ta"] as const).map(l => (
              <TouchableOpacity
                key={l}
                style={[styles.langChip, language === l && styles.langChipActive]}
                onPress={() => setLanguage(l)}
                testID={`admin-lang-${l}`}
              >
                <Text style={[styles.langChipText, language === l && { color: "#fff" }]}>
                  {l === "en" ? "English" : l === "hi" ? "हिंदी" : "தமிழ்"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t("add_lesson", lang)}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="dQw4w9WgXcQ"
              placeholderTextColor={colors.textDisabled}
              value={ytId}
              onChangeText={setYtId}
              testID="admin-yt-input"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addLesson} testID="admin-add-lesson">
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {lessons.map((l, i) => (
            <View key={i} style={styles.lessonRow}>
              <Ionicons name="play-circle" size={22} color={colors.primary} />
              <Text style={styles.lessonText}>{l.title} · {l.youtube_id}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="admin-save">
            <Text style={styles.saveText}>{saving ? "..." : t("save", lang)}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900", color: colors.textPrimary, flex: 1 },
  label: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary, minHeight: 56,
    marginBottom: 8,
  },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addBtn: {
    width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  langRow: { flexDirection: "row", gap: 8 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill,
    backgroundColor: colors.highlight, borderWidth: 1, borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langChipText: { fontWeight: "700", color: colors.textPrimary },
  lessonRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.highlight, padding: 10, borderRadius: radius.md, marginTop: 6,
  },
  lessonText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  saveBtn: {
    backgroundColor: colors.accent, minHeight: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  saveText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  denied: { padding: 20, fontSize: 16, color: colors.error },
});
