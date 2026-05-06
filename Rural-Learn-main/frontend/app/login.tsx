import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { t, languageOptions, Lang } from "../src/i18n";
import { colors, radius, spacing } from "../src/theme";

export default function Login() {
  const { login, lang, setLang } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("student@learn.in");
  const [password, setPassword] = useState("student123");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true); setErr(null);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(e.message || t("error_login", lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.langBar}>
            {languageOptions.map(l => (
              <TouchableOpacity
                key={l.code}
                onPress={() => setLang(l.code as Lang)}
                style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
                testID={`lang-${l.code}`}
              >
                <Text style={[styles.langSymbol, lang === l.code && styles.langSymbolActive]}>{l.symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.hero}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1692269725911-87697c558be1?crop=entropy&cs=srgb&fm=jpg&w=600&q=60" }}
              style={styles.heroImg}
            />
          </View>

          <Text style={styles.title} testID="app-title">{t("app_name", lang)}</Text>
          <Text style={styles.subtitle}>{t("tagline", lang)}</Text>

          <View style={styles.card}>
            <Text style={styles.welcome}>{t("welcome_back", lang)}</Text>

            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t("email", lang)}
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                testID="login-email-input"
              />
            </View>

            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t("password", lang)}
                placeholderTextColor={colors.textDisabled}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                testID="login-password-input"
              />
            </View>

            {err ? <Text style={styles.error} testID="login-error">{err}</Text> : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onSubmit}
              disabled={busy}
              testID="login-submit-button"
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>{t("login", lang)}</Text>
              )}
            </TouchableOpacity>

            <Link href="/register" asChild>
              <TouchableOpacity style={styles.linkRow} testID="goto-register-link">
                <Text style={styles.linkText}>{t("get_started", lang)} · {t("signup", lang)}</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  langBar: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginBottom: spacing.sm },
  langBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langSymbol: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  langSymbolActive: { color: "#fff" },
  hero: { alignItems: "center", marginVertical: spacing.md },
  heroImg: { width: 220, height: 140, borderRadius: radius.xl },
  title: { fontSize: 32, fontWeight: "900", color: colors.textPrimary, textAlign: "center" },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: 4, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.textPrimary, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  welcome: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.md },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.highlight, borderRadius: radius.md, paddingHorizontal: 12,
    minHeight: 56, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary, paddingVertical: 12 },
  primaryBtn: {
    marginTop: spacing.sm, backgroundColor: colors.primary, minHeight: 56,
    borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  linkRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: spacing.md },
  linkText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  error: { color: colors.error, marginBottom: 8, textAlign: "center", fontWeight: "600" },
});
