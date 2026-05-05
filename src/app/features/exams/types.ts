export type ExamVisibility = "BATCH" | "SELECTIVE";

export type ExamShowAnswersAfter = "immediate" | "after_end" | "never";

export interface ExamTest {
  id: string;
  title: string;
  batchId: string;
  subject: string;
  instructions?: string;
  startAt: string; // ISO
  endAt: string; // ISO
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  negativeMarkPerWrong?: number;
  showAnswersAfter: ExamShowAnswersAfter;
  visibility: ExamVisibility;
  selectedStudentRecordIds?: string[];
  createdAt: string; // ISO
  updatedAt?: string; // ISO
}

export interface ExamQuestionPublic {
  id: string;
  questionNo: number;
  text: string;
  imageUrl?: string;
  options: string[];
  marks: number;
}

export interface ExamQuestionPrivate {
  id: string;
  correctIndex: number;
}

export type AttemptStatus = "in_progress" | "submitted";

export interface ExamAttempt {
  id: string; // uid (doc id)
  uid: string;
  studentRecordId?: string;
  testId: string;
  batchId: string;
  startedAt: string; // ISO
  hardEndAt?: string; // ISO (immutable per-attempt end time)
  lastSavedAt: string; // ISO
  submittedAt?: string; // ISO
  status: AttemptStatus;
  answers: Record<string, number | null>; // questionId -> selectedIndex
  markedForReview?: string[]; // questionIds
  score?: number;
  maxScore?: number;
}

