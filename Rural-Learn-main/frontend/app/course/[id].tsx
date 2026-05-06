import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useAuth } from "../../src/auth";
import { t } from "../../src/i18n";
import { colors, radius, spacing } from "../../src/theme";
import {
  downloadCourse, isDownloaded, getOfflineCourse, deleteCourse, formatBytes,
} from "../../src/offline";

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch, lang } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [doneLessons, setDoneLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState<{ pct: number; label: string }>({ pct: 0, label: "" });

  const load = useCallback(async () => {
    // Try network first; fall back to offline cache
    try {
      const res = await apiFetch(`/api/courses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data);
        if (data.lessons?.length) setActiveLesson(data.lessons[0]);
        const cached = await isDownloaded(id as string);
        setOffline(cached);
        // If cached, prefer cached version to get localUris
        if (cached) {
          const c = await getOfflineCourse(id as string);
          if (c) { setCourse(c); setActiveLesson(c.lessons[0]); }
        }
      } else {
        throw new Error("net");
      }
    } catch {
      const c = await getOfflineCourse(id as string);
      if (c) { setCourse(c); setActiveLesson(c.lessons[0]); setOffline(true); }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  const loadComments = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/comments/${id}`);
      if (res.ok) setComments(await res.json());
    } catch {}
  }, [apiFetch, id]);

  useEffect(() => { load(); loadComments(); }, [load, loadComments]);

  const onDownload = async () => {
    if (!course) return;
    setDownloading(true);
    try {
      await downloadCourse(course, (pct, label) => setDlProgress({ pct, label }));
      setOffline(true);
      Alert.alert("Ready offline", "This course is now available without internet.");
    } catch (e: any) {
      Alert.alert("Download failed", e?.message || "Please try again");
    } finally {
      setDownloading(false);
    }
  };

  const onRemoveDownload = async () => {
    await deleteCourse(id as string);
    setOffline(false);
    Alert.alert("Removed", "Offline copy deleted.");
  };

  const markComplete = async (lessonId: string) => {
    try {
      await apiFetch("/api/progress", {
        method: "POST",
        body: JSON.stringify({ course_id: id, lesson_id: lessonId, completed: true }),
      });
    } catch {}
    setDoneLessons(prev => new Set(prev).add(lessonId));
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    try {
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({ course_id: id, text: commentText }),
      });
      setCommentText("");
      loadComments();
    } catch {
      Alert.alert("Offline", "Comments require internet.");
    }
  };

  if (loading || !course) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  const renderPlayer = () => {
    if (!activeLesson) return null;
    // Text lesson
    if (activeLesson.type === "text") {
      return (
        <View style={styles.textLesson}>
          <Text style={styles.lessonTitle}>{activeLesson.title}</Text>
          <Text style={styles.lessonContent}>{activeLesson.content}</Text>
        </View>
      );
    }
    // PDF lesson - use local file if available, else remote (via Google Docs viewer for reliable mobile rendering)
    if (activeLesson.type === "pdf") {
      const pdfSrc = activeLesson.localUri || activeLesson.pdf_url;
      if (!pdfSrc) return null;
      const viewerUri = Platform.OS === "web"
        ? pdfSrc
        : activeLesson.localUri
          ? activeLesson.localUri
          : `https://docs.google.com/viewer?url=${encodeURIComponent(pdfSrc)}&embedded=true`;
      return (
        <View style={styles.playerWrap}>
          <WebView
            source={{ uri: viewerUri }}
            style={{ flex: 1 }}
            javaScriptEnabled
            originWhitelist={["*"]}
          />
        </View>
      );
    }
    // Video: local file OR YouTube embed
    if (activeLesson.type === "video") {
      if (activeLesson.localUri) {
        const videoHtml = `<html><body style="margin:0;background:#000;"><video src="${activeLesson.localUri}" controls playsinline style="width:100%;height:100%;object-fit:contain"></video></body></html>`;
        return (
          <View style={styles.playerWrap}>
            <WebView source={{ html: videoHtml, baseUrl: "" }} style={{ flex: 1 }} allowsFullscreenVideo />
          </View>
        );
      }
      if (activeLesson.youtube_id) {
        return (
          <View style={styles.playerWrap}>
            <WebView
              source={{ uri: `https://www.youtube.com/embed/${activeLesson.youtube_id}?rel=0` }}
              style={{ flex: 1 }}
              javaScriptEnabled
              allowsFullscreenVideo
            />
          </View>
        );
      }
    }
    return <Image source={{ uri: course.thumbnail }} style={styles.coverImg} />;
  };

  const lessonIcon = (l: any) => {
    if (l.type === "video") return "play-circle";
    if (l.type === "pdf") return "document-text";
    return "reader";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="course-back">
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{course.title}</Text>
            {offline && (
              <View style={styles.offlinePill} testID="offline-badge">
                <Ionicons name="cloud-done" size={14} color="#fff" />
                <Text style={styles.offlinePillText}>{t("downloaded", lang)}</Text>
              </View>
            )}
          </View>

          {renderPlayer()}

          <View style={styles.infoBlock}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <Text style={styles.courseDesc}>{course.description}</Text>

            {/* Download / Remove button */}
            {!offline ? (
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={onDownload}
                disabled={downloading}
                testID="download-course-btn"
              >
                {downloading ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.downloadText}>{dlProgress.label} {dlProgress.pct}%</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-download" size={22} color="#fff" />
                    <Text style={styles.downloadText}>{t("download", lang)}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.downloadedRow}>
                <View style={styles.downloadedInfo}>
                  <Ionicons name="cloud-done" size={18} color={colors.success} />
                  <Text style={styles.downloadedText}>
                    {t("offline_ready", lang)}{course.bytes ? ` · ${formatBytes(course.bytes)}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={onRemoveDownload} testID="remove-download-btn">
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            {activeLesson && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => markComplete(activeLesson.id)}
                testID="mark-complete-btn"
              >
                <Ionicons
                  name={doneLessons.has(activeLesson.id) ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={22} color="#fff"
                />
                <Text style={styles.completeText}>
                  {doneLessons.has(activeLesson.id) ? t("completed", lang) : t("mark_complete", lang)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.section}>{t("lessons", lang)}</Text>
          {course.lessons.map((l: any, idx: number) => (
            <TouchableOpacity
              key={l.id}
              style={[styles.lessonItem, activeLesson?.id === l.id && styles.lessonItemActive]}
              onPress={() => setActiveLesson(l)}
              testID={`lesson-${idx}`}
            >
              <Ionicons name={lessonIcon(l) as any} size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonItemTitle}>{l.title}</Text>
                <Text style={styles.lessonItemMeta}>
                  {l.duration_min} min · {l.type.toUpperCase()}{l.localUri ? " · ⬇" : ""}
                </Text>
              </View>
              {doneLessons.has(l.id) && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
            </TouchableOpacity>
          ))}

          {course.quizzes?.length > 0 && (
            <>
              <Text style={styles.section}>{t("quizzes", lang)}</Text>
              {course.quizzes.map((q: any) => (
                <TouchableOpacity
                  key={q.id}
                  style={styles.quizCard}
                  onPress={() => router.push(`/quiz/${course.id}/${q.id}`)}
                  testID={`quiz-${q.id}`}
                >
                  <Ionicons name="clipboard" size={24} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quizTitle}>{q.title}</Text>
                    <Text style={styles.quizMeta}>{q.questions.length} questions</Text>
                  </View>
                  <View style={styles.startBtn}>
                    <Text style={styles.startBtnText}>{t("start_quiz", lang)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={styles.section}>{t("discussion", lang)}</Text>
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={t("add_comment", lang)}
              placeholderTextColor={colors.textDisabled}
              value={commentText}
              onChangeText={setCommentText}
              testID="comment-input"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={postComment} testID="comment-send">
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {comments.length === 0 ? (
            <Text style={styles.empty}>{t("no_data", lang)}</Text>
          ) : comments.map(c => (
            <View key={c.id} style={[styles.comment, c.user_role === "teacher" && styles.teacherComment]}>
              <Text style={[styles.commentAuthor, c.user_role === "teacher" && { color: colors.primary }]}>
                {c.user_name}{c.user_role === "teacher" ? " · Teacher" : ""}
              </Text>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  headerBar: {
    flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  offlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  offlinePillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  playerWrap: { height: 260, backgroundColor: "#000" },
  textLesson: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  lessonTitle: { fontSize: 20, fontWeight: "900", color: colors.textPrimary, marginBottom: 8 },
  lessonContent: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  coverImg: { width: "100%", height: 180 },
  infoBlock: { padding: spacing.md },
  courseTitle: { fontSize: 22, fontWeight: "900", color: colors.textPrimary },
  courseDesc: { fontSize: 15, color: colors.textSecondary, marginTop: 6, lineHeight: 22 },
  downloadBtn: {
    marginTop: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.textPrimary, paddingVertical: 14, borderRadius: radius.pill, minHeight: 56,
  },
  downloadText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  downloadedRow: {
    marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#E8F5F3", padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.success,
  },
  downloadedInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  downloadedText: { fontWeight: "700", color: colors.textPrimary, fontSize: 14 },
  completeBtn: {
    marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.success, paddingVertical: 14, borderRadius: radius.pill, minHeight: 56,
  },
  completeText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  section: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: 8 },
  lessonItem: {
    marginHorizontal: spacing.md, marginBottom: 8, padding: 14, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  lessonItemActive: { borderColor: colors.primary, backgroundColor: "#FFF1E8" },
  lessonItemTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  lessonItemMeta: { fontSize: 12, color: colors.textSecondary },
  quizCard: {
    marginHorizontal: spacing.md, marginBottom: 8, padding: 14, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 2, borderColor: colors.accent,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  quizTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  quizMeta: { fontSize: 12, color: colors.textSecondary },
  startBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  startBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  commentInputRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.md, marginBottom: 10 },
  commentInput: {
    flex: 1, minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  empty: { color: colors.textSecondary, textAlign: "center", marginVertical: 12 },
  comment: {
    marginHorizontal: spacing.md, marginBottom: 8, padding: 12, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  teacherComment: { backgroundColor: "#FFF4D6", borderColor: colors.secondary },
  commentAuthor: { fontSize: 12, fontWeight: "800", color: colors.textSecondary, marginBottom: 4 },
  commentText: { fontSize: 14, color: colors.textPrimary },
});
