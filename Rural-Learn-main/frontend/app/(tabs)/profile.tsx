import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "../../src/auth";
import { t, languageOptions, Lang } from "../../src/i18n";
import { colors, radius, spacing } from "../../src/theme";
import { getDownloadedIds, getOfflineCourse, deleteCourse, formatBytes } from "../../src/offline";

export default function Profile() {
  const { user, logout, lang, setLang } = useAuth();
  const router = useRouter();
  const [downloaded, setDownloaded] = useState<any[]>([]);

  const loadDownloaded = useCallback(async () => {
    const ids = await getDownloadedIds();
    const items: any[] = [];
    for (const id of ids) {
      const c = await getOfflineCourse(id);
      if (c) items.push(c);
    }
    setDownloaded(items);
  }, []);

  useFocusEffect(useCallback(() => { loadDownloaded(); }, [loadDownloaded]));

  const onRemove = async (id: string, title: string) => {
    const confirmed = Platform.OS === "web"
      ? (typeof window !== "undefined" && window.confirm(`Delete "${title}" from device?`))
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Remove Offline Copy", `Delete "${title}" from device?`, [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Delete", style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    await deleteCourse(id);
    loadDownloaded();
  };

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleChip}>
            <Ionicons name={user?.role === "teacher" ? "ribbon" : "school"} size={14} color={colors.primary} />
            <Text style={styles.roleText}>{t(user?.role || "student", lang)}</Text>
          </View>
        </View>

        <Text style={styles.section}>
          <Ionicons name="cloud-done" size={16} color={colors.textPrimary} /> Offline Library
        </Text>
        {downloaded.length === 0 ? (
          <View style={styles.offlineEmpty}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.offlineEmptyText}>{t("no_data", lang)}</Text>
          </View>
        ) : (
          downloaded.map(c => (
            <View key={c.id} style={styles.dlItem} testID={`offline-item-${c.id}`}>
              <Ionicons name="book" size={22} color={colors.primary} />
              <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/course/${c.id}`)}>
                <Text style={styles.dlTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.dlMeta}>
                  {c.lessons?.length || 0} {t("lessons", lang)}
                  {c.bytes ? ` · ${formatBytes(c.bytes)}` : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemove(c.id, c.title)} testID={`offline-remove-${c.id}`}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.section}>{t("language", lang)}</Text>
        <View style={styles.langList}>
          {languageOptions.map(l => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langRow, lang === l.code && styles.langRowActive]}
              onPress={() => setLang(l.code as Lang)}
              testID={`profile-lang-${l.code}`}
            >
              <View style={styles.langIcon}>
                <Text style={styles.langIconText}>{l.symbol}</Text>
              </View>
              <Text style={styles.langLabel}>{l.label}</Text>
              {lang === l.code && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          ))}
        </View>

        {user?.role === "teacher" && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push("/admin")}
            testID="profile-admin-btn"
          >
            <Ionicons name="construct" size={22} color="#fff" />
            <Text style={styles.adminText}>{t("admin_panel", lang)}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} testID="profile-logout-button">
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>{t("logout", lang)}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 80 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    alignItems: "center", borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  avatarText: { fontSize: 34, fontWeight: "900", color: "#fff" },
  name: { fontSize: 22, fontWeight: "900", color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textSecondary },
  roleChip: {
    marginTop: 6, flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: colors.highlight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  roleText: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
  section: { fontSize: 16, fontWeight: "800", marginTop: spacing.lg, marginBottom: 8, color: colors.textPrimary },
  offlineEmpty: {
    backgroundColor: colors.surface, padding: 20, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 6,
  },
  offlineEmptyText: { color: colors.textSecondary, fontSize: 13 },
  dlItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8, minHeight: 56,
  },
  dlTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  dlMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  langList: { gap: 8 },
  langRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, minHeight: 56,
  },
  langRowActive: { borderColor: colors.accent, backgroundColor: "#E8F5F3" },
  langIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.highlight,
    alignItems: "center", justifyContent: "center",
  },
  langIconText: { fontSize: 18, fontWeight: "900", color: colors.textPrimary },
  langLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  adminBtn: {
    flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accent, padding: 16, borderRadius: radius.pill, marginTop: spacing.md, minHeight: 56,
  },
  adminText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  logoutBtn: {
    flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, padding: 16, borderRadius: radius.pill, marginTop: spacing.md,
    borderWidth: 2, borderColor: colors.error, minHeight: 56,
  },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: 16 },
});
