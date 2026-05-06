import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { t, languageOptions, Lang } from "../../src/i18n";
import { colors, radius, spacing } from "../../src/theme";
import { CourseCard } from "../../src/CourseCard";

export default function Courses() {
  const { apiFetch, lang, setLang } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Lang | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/courses`);
    const data = await res.json();
    setCourses(Array.isArray(data) ? data : []);
    setLoading(false); setRefreshing(false);
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? courses : courses.filter(c => c.language === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("all_courses", lang)}</Text>
        <View style={styles.langRow}>
          {languageOptions.map(l => (
            <TouchableOpacity
              key={l.code}
              onPress={() => setLang(l.code as Lang)}
              style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
              testID={`courses-lang-${l.code}`}
            >
              <Text style={[styles.langSymbol, lang === l.code && styles.langSymbolActive]}>{l.symbol}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.filterRow}>
        {(["all", "en", "hi", "ta"] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
            testID={`filter-${f}`}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === "all" ? "All" : f === "en" ? "EN" : f === "hi" ? "हिं" : "த"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /> :
          filtered.length === 0 ? (
            <Text style={styles.empty}>{t("no_courses", lang)}</Text>
          ) : (
            filtered.map(c => <CourseCard key={c.id} course={c} lang={lang} />)
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "900", color: colors.textPrimary },
  langRow: { flexDirection: "row", gap: 6 },
  langBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langSymbol: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  langSymbolActive: { color: "#fff" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.md, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  chipText: { fontWeight: "700", color: colors.textPrimary },
  chipTextActive: { color: "#fff" },
  list: { padding: spacing.md, paddingBottom: 80 },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 40 },
});
