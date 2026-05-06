import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/auth";
import { t } from "../../../src/i18n";
import { colors, radius, spacing } from "../../../src/theme";

export default function Quiz() {
  const { courseId, quizId } = useLocalSearchParams<{ courseId: string; quizId: string }>();
  const { apiFetch, lang } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/courses/${courseId}`);
    const course = await res.json();
    const q = course.quizzes?.find((x: any) => x.id === quizId);
    setQuiz(q);
    if (q) setAnswers(new Array(q.questions.length).fill(-1));
  }, [apiFetch, courseId, quizId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSubmitting(true);
    const res = await apiFetch("/api/quiz/attempt", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, quiz_id: quizId, answers }),
    });
    const data = await res.json();
    setResult(data);
    setSubmitting(false);
  };

  if (!quiz) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.resultCard}>
            <Ionicons
              name={result.score_percent >= 60 ? "trophy" : "reload"}
              size={64}
              color={result.score_percent >= 60 ? colors.secondary : colors.primary}
            />
            <Text style={styles.resultLabel}>{t("score", lang)}</Text>
            <Text style={styles.resultScore}>{result.score_percent}%</Text>
            <Text style={styles.resultMeta}>
              {result.correct} / {result.total} {t("correct", lang)}
            </Text>
          </View>

          {result.results.map((r: any, idx: number) => (
            <View key={idx} style={[styles.reviewItem, { borderColor: r.is_correct ? colors.success : colors.error }]}>
              <Text style={styles.reviewQ}>{idx + 1}. {r.question}</Text>
              <Text style={[styles.reviewA, { color: r.is_correct ? colors.success : colors.error }]}>
                {r.is_correct ? `✓ ${t("correct", lang)}` : `✗ ${t("incorrect", lang)}`}
              </Text>
            </View>
          ))}

          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} testID="quiz-done">
            <Text style={styles.doneText}>{t("back", lang)}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const allAnswered = answers.every(a => a !== -1);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{quiz.title}</Text>
        </View>

        {quiz.questions.map((q: any, qi: number) => (
          <View key={q.id || qi} style={styles.qCard}>
            <Text style={styles.qText}>{qi + 1}. {q.question}</Text>
            {q.options.map((opt: string, oi: number) => {
              const selected = answers[qi] === oi;
              return (
                <TouchableOpacity
                  key={oi}
                  style={[styles.opt, selected && styles.optSelected]}
                  onPress={() => {
                    const copy = [...answers];
                    copy[qi] = oi;
                    setAnswers(copy);
                  }}
                  testID={`quiz-q${qi}-opt${oi}`}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.optText, selected && { color: colors.textPrimary, fontWeight: "700" }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitBtn, !allAnswered && { opacity: 0.5 }]}
          disabled={!allAnswered || submitting}
          onPress={submit}
          testID="quiz-submit"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t("submit", lang)}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 22, fontWeight: "900", color: colors.textPrimary },
  qCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  qText: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, marginBottom: 12 },
  opt: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 6,
    backgroundColor: colors.highlight, borderRadius: radius.lg, minHeight: 56, borderWidth: 2, borderColor: "transparent",
  },
  optSelected: { backgroundColor: "#FFF1E8", borderColor: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textSecondary, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optText: { flex: 1, fontSize: 15, color: colors.textSecondary },
  submitBtn: {
    backgroundColor: colors.primary, minHeight: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  submitText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  resultCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 30,
    alignItems: "center", borderWidth: 2, borderColor: colors.secondary, marginBottom: spacing.md,
  },
  resultLabel: { fontSize: 14, color: colors.textSecondary, marginTop: 8, fontWeight: "700" },
  resultScore: { fontSize: 48, fontWeight: "900", color: colors.primary, marginTop: 4 },
  resultMeta: { fontSize: 16, color: colors.textPrimary, marginTop: 4 },
  reviewItem: {
    backgroundColor: colors.surface, padding: 14, marginBottom: 8,
    borderRadius: radius.lg, borderLeftWidth: 4,
  },
  reviewQ: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  reviewA: { fontSize: 13, marginTop: 4, fontWeight: "700" },
  doneBtn: {
    backgroundColor: colors.textPrimary, minHeight: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: spacing.md,
  },
  doneText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
