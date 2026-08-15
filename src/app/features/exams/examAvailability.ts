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

export function isExamScheduledToday(
  test: Pick<ExamTest, "startAt">,
  nowMs = Date.now(),
): boolean {
  const start = new Date(test.startAt);
  const today = new Date(nowMs);
  if (Number.isNaN(start.getTime())) return false;
  return (
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth() &&
    start.getDate() === today.getDate()
  );
}

export function canStartNewExamAttempt(
  test: Pick<ExamTest, "startAt" | "endAt" | "manuallyClosedAt" | "status">,
  nowMs = Date.now(),
  isLiveTestActive = false,
): boolean {
  if (isLiveTestActive) return true;
  if (isExamManuallyClosed(test)) return false;
  if (test.status === "draft") return false;
  if (test.status === "published") return true;
  return getExamWindowStatus(test, nowMs) === "active";
}

export function canShowExamToStudentToday(
  test: Pick<ExamTest, "startAt" | "endAt" | "manuallyClosedAt" | "status">,
  nowMs = Date.now(),
): boolean {
  return isExamScheduledToday(test, nowMs) && canStartNewExamAttempt(test, nowMs);
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
