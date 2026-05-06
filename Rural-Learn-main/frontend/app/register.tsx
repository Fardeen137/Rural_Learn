import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { t } from "../src/i18n";
import { colors, radius, spacing } from "../src/theme";

export default function Register() {
  const { register, lang } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true); setErr(null);
    try {
      await register(email.trim(), password, name.trim(), role);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Link href="/login" asChild>
            <TouchableOpacity style={styles.backBtn} testID="back-to-login">
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </Link>

          <Text style={styles.title}>{t("signup", lang)}</Text>
          <Text style={styles.subtitle}>{t("tagline", lang)}</Text>

          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t("name", lang)}
                placeholderTextColor={colors.textDisabled}
                value={name} onChangeText={setName}
                testID="register-name-input"
              />
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t("email", lang)}
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none" keyboardType="email-address"
                value={email} onChangeText={setEmail}
                testID="register-email-input"
              />
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t("password", lang)}
                placeholderTextColor={colors.textDisabled}
                secureTextEntry
                value={password} onChangeText={setPassword}
                testID="register-password-input"
              />
            </View>

            <Text style={styles.roleLabel}>{t("role", lang)}</Text>
            <View style={styles.roleRow}>
              {(["student", "teacher"] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => setRole(r)}
                  testID={`role-${r}`}
                >
                  <Ionicons
                    name={r === "student" ? "school-outline" : "ribbon-outline"}
                    size={22}
                    color={role === r ? "#fff" : colors.textPrimary}
                  />
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{t(r, lang)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {err ? <Text style={styles.error} testID="register-error">{err}</Text> : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onSubmit}
              disabled={busy}
              testID="register-submit-button"
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>{t("signup", lang)}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 30, fontWeight: "900", color: colors.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.highlight, borderRadius: radius.md, paddingHorizontal: 12,
    minHeight: 56, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary, paddingVertical: 12 },
  roleLabel: { marginTop: 8, marginBottom: 8, fontWeight: "700", color: colors.textSecondary },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: spacing.md },
  roleBtn: {
    flex: 1, minHeight: 56, borderRadius: radius.lg,
    backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8, borderWidth: 1, borderColor: colors.border,
  },
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontWeight: "700", color: colors.textPrimary, fontSize: 16 },
  roleTextActive: { color: "#fff" },
  primaryBtn: {
    backgroundColor: colors.primary, minHeight: 56,
    borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  error: { color: colors.error, textAlign: "center", marginBottom: 8, fontWeight: "600" },
});
