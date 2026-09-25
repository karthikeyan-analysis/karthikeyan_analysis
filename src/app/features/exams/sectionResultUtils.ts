import type {
  ExamAttempt,
  ExamPart,
  ExamQuestionPublic,
  ExamTest,
} from "./types";
import { formatPartLabel } from "./examScoring";

export interface SectionSummary {
  key: "partA" | "partB" | "partC";
  label: string; // e.g. "PART-A (MATHS)"
  fullTitle: string; // e.g. "Part A: Mathematics"
  subject: string; // e.g. "Mathematics"
  totalQuestions: number; // e.g. 35
  maxMarks: number; // e.g. 52.5
}

export interface StudentSectionResult {
  correct: number;
  wrong: number;
  unanswered: number;
  attempted: number;
  marks: number; // correct * 1.5
  totalQuestions: number;
}

export interface StudentThreeSectionBreakdown {
  sNo: number;
  rank: number | string;
  studentName: string;
  studentId: string;
  studentEmail: string;
  partA: StudentSectionResult;
  partB: StudentSectionResult;
  partC: StudentSectionResult;
  totalCorrect: number;
  totalWrong: number;
  totalUnanswered: number;
  totalAttempted: number;
  grandTotalMarks: number;
  status: string;
  submittedAt: string;
  timeTakenSeconds: number | string;
  rawAttempt: ExamAttempt;
}

/**
 * Segregates test questions into the 3 canonical subjects:
 * - Part A: Mathematics (Maths)
 * - Part B: Statistics (Stat)
 * - Part C: Economics (Eco)
 */
export function resolveThreeSections(
  test: ExamTest | null | undefined,
  questions: ExamQuestionPublic[],
): {
  partAQuestions: ExamQuestionPublic[];
  partBQuestions: ExamQuestionPublic[];
  partCQuestions: ExamQuestionPublic[];
  sectionInfo: {
    partA: SectionSummary;
    partB: SectionSummary;
    partC: SectionSummary;
  };
} {
  const parts: ExamPart[] = (test?.parts || [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const findPart = (pattern: RegExp) =>
    parts.find(
      (p) => pattern.test(p.subject || "") || pattern.test(p.label || ""),
    );

  const partAMatch = findPart(/math/i) || parts[0];
  const partBMatch = findPart(/stat/i) || parts[1];
  const partCMatch = findPart(/eco/i) || parts[2];

  let partAQuestions: ExamQuestionPublic[] = [];
  let partBQuestions: ExamQuestionPublic[] = [];
  let partCQuestions: ExamQuestionPublic[] = [];

  const hasPartIds = questions.some((q) => Boolean(q.partId));

  if (hasPartIds && (partAMatch || partBMatch || partCMatch)) {
    partAQuestions = partAMatch
      ? questions.filter((q) => q.partId === partAMatch.id)
      : [];
    partBQuestions = partBMatch
      ? questions.filter((q) => q.partId === partBMatch.id)
      : [];
    partCQuestions = partCMatch
      ? questions.filter((q) => q.partId === partCMatch.id)
      : [];
  }

  // Fallback: If questions are not tagged with partIds or parts didn't catch them,
  // partition them by canonical test sequence (35 questions each for standard 105/100 tests)
  if (
    partAQuestions.length === 0 &&
    partBQuestions.length === 0 &&
    partCQuestions.length === 0 &&
    questions.length > 0
  ) {
    if (questions.length >= 70) {
      partAQuestions = questions.slice(0, 35);
      partBQuestions = questions.slice(35, 70);
      partCQuestions = questions.slice(70, Math.min(105, questions.length));
    } else {
      const chunkSize = Math.max(1, Math.ceil(questions.length / 3));
      partAQuestions = questions.slice(0, chunkSize);
      partBQuestions = questions.slice(chunkSize, chunkSize * 2);
      partCQuestions = questions.slice(chunkSize * 2);
    }
  }

  const countA = partAQuestions.length || 35;
  const countB = partBQuestions.length || 35;
  const countC = partCQuestions.length || 35;

  return {
    partAQuestions,
    partBQuestions,
    partCQuestions,
    sectionInfo: {
      partA: {
        key: "partA",
        label: "PART-A (MATHS)",
        fullTitle: "Part A: Mathematics",
        subject: "Mathematics",
        totalQuestions: countA,
        maxMarks: countA * 1.5,
      },
      partB: {
        key: "partB",
        label: "PART-B (STAT)",
        fullTitle: "Part B: Statistics",
        subject: "Statistics",
        totalQuestions: countB,
        maxMarks: countB * 1.5,
      },
      partC: {
        key: "partC",
        label: "PART-C (ECO)",
        fullTitle: "Part C: Economics",
        subject: "Economics",
        totalQuestions: countC,
        maxMarks: countC * 1.5,
      },
    },
  };
}

/**
 * Computes the 3-section results (Part A: Mathematics, Part B: Statistics, Part C: Economics)
 * for a list of student attempts, ranked by final marks.
 */
export function computeThreeSectionBreakdown(params: {
  test: ExamTest | null | undefined;
  questions: ExamQuestionPublic[];
  keys: { id: string; correctIndex: number }[] | null | undefined;
  attempts: ExamAttempt[];
  students: any[];
  resolveParticipant: (
    attempt: ExamAttempt,
    students: any[],
  ) => {
    name: string;
    studentId: string;
    email: string;
  };
}): {
  sectionInfo: {
    partA: SectionSummary;
    partB: SectionSummary;
    partC: SectionSummary;
  };
  rows: StudentThreeSectionBreakdown[];
} {
  const { test, questions, keys, attempts, students, resolveParticipant } =
    params;
  const { partAQuestions, partBQuestions, partCQuestions, sectionInfo } =
    resolveThreeSections(test, questions);

  const correctIndexById = new Map<string, number>(
    (keys || []).map((k) => [k.id, k.correctIndex]),
  );

  const evaluateSection = (
    qList: ExamQuestionPublic[],
    answers: Record<string, number | null | undefined>,
  ): StudentSectionResult => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let attempted = 0;

    for (const q of qList) {
      const selected = answers[q.id];
      if (selected == null) {
        unanswered++;
        continue;
      }
      attempted++;
      const correctIdx = correctIndexById.get(q.id);
      if (correctIdx == null) continue;
      if (selected === correctIdx) {
        correct++;
      } else {
        wrong++;
      }
    }

    const marks = Math.round(correct * 1.5 * 100) / 100;
    return {
      correct,
      wrong,
      unanswered,
      attempted,
      marks,
      totalQuestions: qList.length,
    };
  };

  // Pre-calculate section results for each attempt
  const calculated = attempts.map((a) => {
    const participant = resolveParticipant(a, students);
    const answers = a.answers || {};

    const partA = evaluateSection(partAQuestions, answers);
    const partB = evaluateSection(partBQuestions, answers);
    const partC = evaluateSection(partCQuestions, answers);

    const totalCorrect = partA.correct + partB.correct + partC.correct;
    const totalWrong = partA.wrong + partB.wrong + partC.wrong;
    const totalUnanswered =
      partA.unanswered + partB.unanswered + partC.unanswered;
    const totalAttempted = partA.attempted + partB.attempted + partC.attempted;

    // Each correct question carries 1.5 marks
    const grandTotalMarks =
      Math.round((partA.marks + partB.marks + partC.marks) * 100) / 100;

    const startedMs = a.startedAt ? new Date(a.startedAt).getTime() : null;
    const subMs = a.submittedAt ? new Date(a.submittedAt).getTime() : null;
    const timeTakenSeconds =
      startedMs != null && subMs != null
        ? Math.max(0, Math.round((subMs - startedMs) / 1000))
        : "";

    return {
      attempt: a,
      participant,
      partA,
      partB,
      partC,
      totalCorrect,
      totalWrong,
      totalUnanswered,
      totalAttempted,
      grandTotalMarks,
      timeTakenSeconds,
    };
  });

  // Sort: submitted attempts first, ranked by grandTotalMarks (descending), then name
  const submitted = calculated.filter((c) => c.attempt.status === "submitted");
  const inProgress = calculated.filter((c) => c.attempt.status !== "submitted");

  submitted.sort((a, b) => {
    if (b.grandTotalMarks !== a.grandTotalMarks) {
      return b.grandTotalMarks - a.grandTotalMarks;
    }
    return (a.participant.name || "").localeCompare(b.participant.name || "");
  });

  inProgress.sort((a, b) =>
    (a.participant.name || "").localeCompare(b.participant.name || ""),
  );

  let denseRank = 0;
  let lastScore: number | undefined = undefined;

  const rows: StudentThreeSectionBreakdown[] = [
    ...submitted,
    ...inProgress,
  ].map((c, index) => {
    let rank: number | string = "—";
    if (c.attempt.status === "submitted") {
      if (lastScore !== c.grandTotalMarks) {
        denseRank++;
        lastScore = c.grandTotalMarks;
      }
      rank = denseRank;
    }

    return {
      sNo: index + 1,
      rank,
      studentName: c.participant.name || "Unknown",
      studentId: c.participant.studentId || "",
      studentEmail: c.participant.email || "",
      partA: c.partA,
      partB: c.partB,
      partC: c.partC,
      totalCorrect: c.totalCorrect,
      totalWrong: c.totalWrong,
      totalUnanswered: c.totalUnanswered,
      totalAttempted: c.totalAttempted,
      grandTotalMarks: c.grandTotalMarks,
      status: c.attempt.status,
      submittedAt: c.attempt.submittedAt || "",
      timeTakenSeconds: c.timeTakenSeconds,
      rawAttempt: c.attempt,
    };
  });

  return {
    sectionInfo,
    rows,
  };
}
