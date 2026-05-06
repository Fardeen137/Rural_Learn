import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { t, languageOptions, Lang } from "../../src/i18n";
import { colors, radius, spacing } from "../../src/theme";
import { CourseCard } from "../../src/CourseCard";

export default function Home() {
  const { user, lang, setLang, apiFetch } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/courses?language=${lang}`);
      const data = await res.json();
      setCourses(Array.isArray(data) ? data : []);
    } finally { setLoading(false); setRefreshing(false); }
  }, [apiFetch, lang]);

  useEffect(() => { load(); }, [load]);

  const featured = courses.slice(0, 3);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>नमस्ते, {user?.name?.split(" ")[0]} 👋</Text>
            <Text style={styles.heroTitle}>{t("tagline", lang)}</Text>
          </View>
          <View style={styles.langBar}>
            {languageOptions.map(l => (
              <TouchableOpacity
                key={l.code}
                onPress={() => setLang(l.code as Lang)}
                style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
                testID={`home-lang-${l.code}`}
              >
                <Text style={[styles.langSymbol, lang === l.code && styles.langSymbolActive]}>{l.symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.banner}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1692269725911-87697c558be1?w=600&q=60" }}
            style={styles.bannerImg}
          />
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerText}>{t("continue_learning", lang)}</Text>
            <TouchableOpacity
              style={styles.bannerBtn}
              onPress={() => router.push("/(tabs)/courses")}
              testID="home-browse-courses"
            >
              <Text style={styles.bannerBtnText}>{t("all_courses", lang)}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("all_courses", lang)}</Text>
        {loading ? <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} /> :
          featured.length === 0 ? (
            <Text style={styles.empty}>{t("no_courses", lang)}</Text>
          ) : (
            featured.map(c => <CourseCard key={c.id} course={c} lang={lang} />)
          )
        }

        {user?.role === "teacher" && (
          <TouchableOpacity
            style={styles.teacherCta}
            onPress={() => router.push("/admin")}
            testID="home-admin-panel"
          >
            <Ionicons name="add-circle" size={26} color="#fff" />
            <Text style={styles.teacherCtaText}>{t("admin_panel", lang)}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 80 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  hello: { fontSize: 15, color: colors.textSecondary, fontWeight: "600" },
  heroTitle: { fontSize: 22, fontWeight: "900", color: colors.textPrimary, marginTop: 4 },
  langBar: { flexDirection: "row", gap: 6 },
  langBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langSymbol: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  langSymbolActive: { color: "#fff" },
  banner: {
    borderRadius: radius.xl, overflow: "hidden", marginBottom: spacing.lg, position: "relative",
    height: 160, backgroundColor: colors.highlight,
  },
  bannerImg: { width: "100%", height: "100%" },
  bannerOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.md,
    backgroundColor: "rgba(2,48,71,0.55)",
  },
  bannerText: { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  bannerBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill,
  },
  bannerBtnText: { color: "#fff", fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 30 },
  teacherCta: {
    flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accent, padding: 16, borderRadius: radius.xl, marginTop: 8,
  },
  teacherCtaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
