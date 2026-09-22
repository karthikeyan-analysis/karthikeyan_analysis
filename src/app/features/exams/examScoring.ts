import type {
  ExamAttemptPartResult,
  ExamPart,
  ExamQuestionPublic,
} from "./types";

export interface ScoredAttempt {
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  /** Present only when `parts` was passed in (multi-part test). */
  partResults?: Record<string, ExamAttemptPartResult>;
}

/**
 * Single source of truth for scoring an attempt. Used by both the student's
 * self-scored submit (TakeExam.tsx) and the admin force-submit path
 * (examApi.forceSubmitAttemptForAdmin) so the two never disagree.
 */
export function computeAttemptScore(params: {
  questions: ExamQuestionPublic[];
  correctIndexById: Map<string, number>;
  answers: Record<string, number | null | undefined>;
  negativeMarkPerWrong?: number;
  parts?: ExamPart[];
}): ScoredAttempt {
  const neg = params.negativeMarkPerWrong || 0;
  let s = 0;
  let max = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const partResults: Record<string, ExamAttemptPartResult> | undefined =
    params.parts?.length
      ? Object.fromEntries(
          params.parts.map((p) => [
            p.id,
            {
              attempted: 0,
              correct: 0,
              wrong: 0,
              unanswered: 0,
              marksObtained: 0,
              maxMarks: 0,
            } as ExamAttemptPartResult,
          ]),
        )
      : undefined;

  params.questions.forEach((q) => {
    max += q.marks;
    const part = partResults && q.partId ? partResults[q.partId] : undefined;
    if (part) part.maxMarks += q.marks;

    const selected = params.answers[q.id];
    if (selected == null) {
      unansweredCount++;
      if (part) part.unanswered++;
      return;
    }
    const correct = params.correctIndexById.get(q.id);
    if (correct == null) return;
    if (selected === correct) {
      s += q.marks;
      correctCount++;
      if (part) {
        part.attempted++;
        part.correct++;
        part.marksObtained += q.marks;
      }
    } else {
      s -= neg;
      wrongCount++;
      if (part) {
        part.attempted++;
        part.wrong++;
        part.marksObtained -= neg;
      }
    }
  });

  s = Math.max(0, s);
  if (partResults) {
    for (const part of Object.values(partResults)) {
      part.marksObtained = Math.max(0, part.marksObtained);
    }
  }

  return {
    score: s,
    maxScore: max,
    correctCount,
    wrongCount,
    unansweredCount,
    partResults,
  };
}

/** Sync `ExamPart.totalQuestions`/`totalMarks` from the current question list. Pure, no I/O. */
export function recomputePartTotals(
  parts: ExamPart[],
  questions: Pick<ExamQuestionPublic, "partId" | "marks">[],
): ExamPart[] {
  return parts.map((part) => {
    const own = questions.filter((q) => q.partId === part.id);
    return {
      ...part,
      totalQuestions: own.length,
      totalMarks: own.reduce((sum, q) => sum + (q.marks || 0), 0),
    };
  });
}

/** "Part A" + subject "Mathematics" -> "Part A (Mathematics)" for display. */
export function formatPartLabel(part: Pick<ExamPart, "label" | "subject">): string {
  return part.subject?.trim() ? `${part.label} (${part.subject.trim()})` : part.label;
}
