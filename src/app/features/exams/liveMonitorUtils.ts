import type { ExamAttempt, ExamTest } from "./types";
import { resolveAttemptParticipant } from "./participantUtils";
import type { Student } from "../../context/DataContext";

export type LiveUrgency = "ok" | "warning" | "critical";

export type LiveAttemptRow = {
  key: string;
  attempt: ExamAttempt;
  testId: string;
  testTitle: string;
  testSubject: string;
  batchName: string;
  participantName: string;
  studentId: string;
  email: string;
  isGuest: boolean;
  joinedAt: string;
  hardEndAt: string;
  lastActiveAt: string;
  remainingSeconds: number;
  elapsedSeconds: number;
  answeredCount: number;
  unansweredCount: number;
  markedCount: number;
  totalQuestions: number;
  progressPercent: number;
  urgency: LiveUrgency;
};

export function formatLiveDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatClockTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export function computeAttemptProgress(
  attempt: ExamAttempt,
  totalQuestions: number,
  nowMs: number,
): Pick<
  LiveAttemptRow,
  | "remainingSeconds"
  | "elapsedSeconds"
  | "answeredCount"
  | "unansweredCount"
  | "markedCount"
  | "totalQuestions"
  | "progressPercent"
  | "urgency"
> {
  const answers = attempt.answers || {};
  const answerKeys = Object.keys(answers);
  const total = totalQuestions > 0 ? totalQuestions : answerKeys.length;
  const answeredCount = Object.values(answers).filter((v) => v != null).length;
  const unansweredCount = Math.max(0, total - answeredCount);
  const markedCount = (attempt.markedForReview || []).length;

  const startedMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : nowMs;
  const hardEndMs = attempt.hardEndAt ? new Date(attempt.hardEndAt).getTime() : 0;
  const remainingSeconds = hardEndMs ? Math.max(0, Math.floor((hardEndMs - nowMs) / 1000)) : 0;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));

  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  let urgency: LiveUrgency = "ok";
  if (remainingSeconds <= 60) urgency = "critical";
  else if (remainingSeconds <= 300) urgency = "warning";

  return {
    remainingSeconds,
    elapsedSeconds,
    answeredCount,
    unansweredCount,
    markedCount,
    totalQuestions: total,
    progressPercent,
    urgency,
  };
}

export function buildLiveAttemptRow(params: {
  attempt: ExamAttempt;
  testId: string;
  test?: ExamTest | null;
  batchName: string;
  students: Pick<Student, "id" | "name" | "email" | "studentId">[];
  nowMs: number;
}): LiveAttemptRow {
  const { attempt, testId, test, batchName, students, nowMs } = params;
  const p = resolveAttemptParticipant(attempt, students);
  const progress = computeAttemptProgress(attempt, test?.totalQuestions || 0, nowMs);

  return {
    key: `${testId}::${attempt.uid}`,
    attempt,
    testId,
    testTitle: test?.title || testId,
    testSubject: test?.subject || "",
    batchName,
    participantName: p.name || p.email || attempt.uid.slice(0, 8),
    studentId: p.studentId || "—",
    email: p.email || "",
    isGuest: p.isGuest,
    joinedAt: attempt.startedAt,
    hardEndAt: attempt.hardEndAt || "",
    lastActiveAt: attempt.lastSavedAt || attempt.startedAt,
    ...progress,
  };
}

export type LiveTestSummary = {
  testId: string;
  title: string;
  subject: string;
  batchName: string;
  liveCount: number;
  avgProgress: number;
  expiringSoon: number;
};

export function summarizeByTest(rows: LiveAttemptRow[]): LiveTestSummary[] {
  const map = new Map<string, LiveTestSummary & { progressSum: number }>();
  for (const r of rows) {
    let s = map.get(r.testId);
    if (!s) {
      s = {
        testId: r.testId,
        title: r.testTitle,
        subject: r.testSubject,
        batchName: r.batchName,
        liveCount: 0,
        avgProgress: 0,
        expiringSoon: 0,
        progressSum: 0,
      };
      map.set(r.testId, s);
    }
    s.liveCount += 1;
    s.progressSum += r.progressPercent;
    if (r.urgency === "critical" || r.urgency === "warning") s.expiringSoon += 1;
  }
  return Array.from(map.values())
    .map(({ progressSum, ...rest }) => ({
      ...rest,
      avgProgress: rest.liveCount > 0 ? Math.round(progressSum / rest.liveCount) : 0,
    }))
    .sort((a, b) => b.liveCount - a.liveCount || a.title.localeCompare(b.title));
}
