import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { t } from "../../src/i18n";
import { colors, radius, spacing } from "../../src/theme";

export default function Progress() {
  const { apiFetch, lang } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/progress/me");
    setData(await res.json());
    setLoading(false); setRefreshing(false);
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  const stats = data?.stats || {};
  const coursesProg = data?.courses || [];
  const attempts = data?.quiz_attempts || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.title}>{t("progress", lang)}</Text>

        <View style={styles.statsRow}>
          <Stat icon="book" label={t("courses_started", lang)} value={stats.courses_started || 0} color={colors.primary} />
          <Stat icon="checkmark-done" label={t("lessons_done", lang)} value={stats.lessons_completed || 0} color={colors.accent} />
          <Stat icon="clipboard" label={t("quizzes_taken", lang)} value={stats.quizzes_taken || 0} color={colors.secondary} />
          <Stat icon="trophy" label={t("avg_score", lang)} value={`${stats.avg_quiz_score || 0}%`} color={colors.error} />
        </View>

        <Text style={styles.section}>{t("continue_learning", lang)}</Text>
        {coursesProg.length === 0 ? (
          <Text style={styles.empty}>{t("no_data", lang)}</Text>
        ) : (
          coursesProg.map((c: any) => (
            <View key={c.course_id} style={styles.progCard} testID={`progress-course-${c.course_id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.progTitle}>{c.title}</Text>
                <Text style={styles.progMeta}>{c.completed_lessons}/{c.total_lessons} {t("lessons", lang)}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${c.percent}%` }]} />
                </View>
              </View>
              <Text style={styles.percent}>{c.percent}%</Text>
            </View>
          ))
        )}

        <Text style={styles.section}>{t("quizzes", lang)}</Text>
        {attempts.length === 0 ? (
          <Text style={styles.empty}>{t("no_data", lang)}</Text>
        ) : (
          attempts.slice().reverse().slice(0, 10).map((a: any) => (
            <View key={a.id} style={styles.attemptCard}>
              <Ionicons name="ribbon" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.attemptTitle}>{a.quiz_title}</Text>
                <Text style={styles.attemptMeta}>{a.correct}/{a.total} {t("correct", lang)}</Text>
              </View>
              <Text style={[styles.score, { color: a.score_percent >= 60 ? colors.success : colors.error }]}>
                {a.score_percent}%
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, color }: any) {
  return (
    <View style={[statStyles.card, { borderColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card: {
    width: "48%", backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, marginBottom: 10, borderWidth: 2, gap: 4,
  },
  value: { fontSize: 22, fontWeight: "900", color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 80 },
  title: { fontSize: 24, fontWeight: "900", color: colors.textPrimary, marginBottom: spacing.md },
  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  section: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.md, marginBottom: 8 },
  empty: { color: colors.textSecondary, textAlign: "center", marginVertical: 20 },
  progCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border,
  },
  progTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  progMeta: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  barTrack: { height: 8, backgroundColor: colors.highlight, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.accent },
  percent: { fontSize: 18, fontWeight: "900", color: colors.accent },
  attemptCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8,
    flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border,
  },
  attemptTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  attemptMeta: { fontSize: 12, color: colors.textSecondary },
  score: { fontSize: 18, fontWeight: "900" },
});
