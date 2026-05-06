import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "./theme";
import { t, Lang } from "./i18n";
import { isDownloaded } from "./offline";

export function CourseCard({ course, lang }: { course: any; lang: Lang }) {
  const router = useRouter();
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let active = true;
    isDownloaded(course.id).then(v => { if (active) setDownloaded(v); });
    return () => { active = false; };
  }, [course.id]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/course/${course.id}`)}
      testID={`course-card-${course.id}`}
      accessibilityLabel={course.title}
    >
      <Image
        source={{ uri: course.thumbnail || "https://images.unsplash.com/photo-1760009229725-7ef1990e585f?w=600&q=60" }}
        style={styles.thumb}
      />
      <View style={styles.body}>
        <View style={styles.subjectRow}>
          <Text style={styles.subject}>{course.subject}</Text>
          {downloaded ? (
            <View style={[styles.badge, { backgroundColor: colors.success }]} testID={`card-downloaded-${course.id}`}>
              <Ionicons name="cloud-done" size={12} color="#fff" />
              <Text style={styles.badgeText}>{t("downloaded", lang)}</Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Ionicons name="cloud-download-outline" size={12} color="#fff" />
              <Text style={styles.badgeText}>{t("offline_ready", lang)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>{course.title}</Text>
        <Text style={styles.meta}>
          {course.lessons?.length || 0} {t("lessons", lang)} · {course.quizzes?.length || 0} {t("quizzes", lang)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: 140, backgroundColor: colors.highlight },
  body: { padding: spacing.md, gap: 6 },
  subjectRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subject: {
    fontSize: 12, fontWeight: "800", color: colors.accent, letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.textPrimary, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  title: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginTop: 2 },
  meta: { fontSize: 13, color: colors.textSecondary },
});
