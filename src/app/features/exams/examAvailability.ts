import type { ExamTest } from "./types";

export type ExamWindowStatus = "upcoming" | "active" | "closed";

export function isExamManuallyClosed(test: Pick<ExamTest, "manuallyClosedAt">): boolean {
  return Boolean(test.manuallyClosedAt);
}

/** Schedule + admin manual close (used for badges, schedule, guest access). */
export function getExamWindowStatus(
  test: Pick<ExamTest, "startAt" | "endAt" | "manuallyClosedAt">,
  nowMs = Date.now(),
): ExamWindowStatus {
  if (isExamManuallyClosed(test)) return "closed";
  const start = new Date(test.startAt).getTime();
  const end = new Date(test.endAt).getTime();
  if (nowMs < start) return "upcoming";
  if (nowMs > end) return "closed";
  return "active";
}

/** New attempts only — in-progress students may continue until their timer ends. */
export function canStartNewExamAttempt(
  test: Pick<ExamTest, "startAt" | "endAt" | "manuallyClosedAt" | "status">,
  nowMs = Date.now(),
): boolean {
  if (test.status && test.status !== "published") return false;
  if (isExamManuallyClosed(test)) return false;
  return getExamWindowStatus(test, nowMs) === "active";
}

export function examWindowStatusLabel(
  test: Pick<ExamTest, "startAt" | "endAt" | "manuallyClosedAt">,
  nowMs = Date.now(),
): string {
  if (isExamManuallyClosed(test)) return "Ended by admin";
  const s = getExamWindowStatus(test, nowMs);
  if (s === "active") return "Active";
  if (s === "upcoming") return "Upcoming";
  return "Closed";
}
