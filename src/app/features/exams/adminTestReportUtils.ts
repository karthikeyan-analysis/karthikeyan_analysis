import type { Student } from "../../context/DataContext";
import { displayNameForAttempt } from "./participantUtils";
import type { ExamAttempt, ExamTest } from "./types";

export function toIsoOrEmpty(value: unknown) {
  if (!value) return "";
  try {
    return new Date(value as string).toISOString();
  } catch {
    return String(value);
  }
}

export function percentScore(a: ExamAttempt, maxMarks: number) {
  const max = a.maxScore ?? maxMarks;
  const score = a.score;
  if (score == null || !Number.isFinite(max) || max <= 0) return null;
  return Math.round((score / max) * 1000) / 10;
}

export function attemptCompositeKey(testId: string, studentRecordIdOrUid: string) {
  return `${testId}::${studentRecordIdOrUid}`;
}

export function buildAttemptsLookup(pairs: { test: ExamTest; attempts: ExamAttempt[] }[]) {
  const m = new Map<string, ExamAttempt>();
  for (const { test, attempts } of pairs) {
    for (const a of attempts) {
      const sk = (a.studentRecordId || "").trim() || a.uid;
      if (sk) m.set(attemptCompositeKey(test.id, sk), a);
    }
  }
  return m;
}

/** Same rules as exams list for visibility (roster-aligned). */
export function isEligibleForExam(student: Student, test: ExamTest): boolean {
  if (test.visibility === "SELECTIVE") {
    const ids = test.selectedStudentRecordIds;
    return Array.isArray(ids) && ids.includes(student.id);
  }
  return Boolean(student.batchId && student.batchId === test.batchId);
}

export function safeFileName(name: string) {
  return (name || "export").replace(/[\\/:*?"<>|]+/g, "_");
}

export { displayNameForAttempt, resolveAttemptParticipant } from "./participantUtils";
