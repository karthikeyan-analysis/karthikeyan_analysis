/** Allowed default / per-question marks in admin authoring. */
export const QUESTION_MARK_OPTIONS = [1, 1.5, 2] as const;

export type QuestionMarkOption = (typeof QUESTION_MARK_OPTIONS)[number];

export const DEFAULT_MARKS_PER_QUESTION: QuestionMarkOption = 1;

export function isQuestionMarkOption(value: number): value is QuestionMarkOption {
  return value === 1 || value === 1.5 || value === 2;
}

export function normalizeQuestionMarks(
  value: unknown,
  fallback: QuestionMarkOption = DEFAULT_MARKS_PER_QUESTION,
): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").trim());
  if (isQuestionMarkOption(n)) return n;
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

export function formatMarksLabel(marks: number): string {
  return marks === 1.5 ? "1.5" : String(marks);
}

export function marksSelectValue(marks: number): string {
  return formatMarksLabel(normalizeQuestionMarks(marks));
}
