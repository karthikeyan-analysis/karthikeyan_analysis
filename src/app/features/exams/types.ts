export type ExamVisibility = "BATCH" | "SELECTIVE";

export type ExamShowAnswersAfter = "immediate" | "after_end" | "never";

export type ExamStatus = "draft" | "published";

/** Who can take the test (stored in settings.accessMode). */
export type ExamAccessMode =
  | "batch"
  | "passcode"
  | "both"
  /** @deprecated use `batch` */
  | "anyone"
  /** @deprecated use `batch` — batches are chosen in Basic Settings */
  | "identifier_list"
  /** @deprecated use `batch` */
  | "email_list";

export interface ExamAdvancedSettings {
  colorScheme?: string;
  interfaceLanguage?: string;
  paginationMode?: "all_on_one_page" | "one_per_page";
  randomizeQuestionOrder?: boolean;
  allowBlankAnswers?: boolean;
  negativeMarkingEnabled?: boolean;
  conclusionText?: string;
  showPassFailMessage?: boolean;
  reviewShowScore?: boolean;
  reviewShowOutline?: boolean;
  reviewShowCorrectness?: boolean;
  reviewShowCorrectAnswer?: boolean;
  reviewShowExplanation?: boolean;
  accessMode?: ExamAccessMode;
  passcodeHint?: string;
  allowedIdentifiers?: string[];
  allowedEmails?: string[];
  identityPrompt?: string;
  disableRightClick?: boolean;
  disableCopyPaste?: boolean;
  disableTranslate?: boolean;
  disableAutocomplete?: boolean;
  disableSpellcheck?: boolean;
  disablePrinting?: boolean;
  notifyOnSubmitMode?: "account_default" | "yes" | "no";
  notificationEmails?: string[];
}

export interface ExamTest {
  id: string;
  title: string;
  /** Primary batch (legacy). Same as the first entry in `batchIds` when multiple batches are set. */
  batchId: string;
  /** All batches that can access this test (BATCH visibility). */
  batchIds?: string[];
  subject: string;
  /** How the subject label was assigned while creating the test. */
  subjectMode?: "common" | "per_batch";
  /** Optional per-batch subject labels for shared tests across different batches. */
  subjectByBatchId?: Record<string, string>;
  instructions?: string;
  /**
   * Optional access password hash (SHA-256, base64).
   * If set, students must enter the password before starting.
   */
  accessPasswordHash?: string;
  startAt: string; // ISO
  endAt: string; // ISO
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  /** Default marks applied to new questions (1, 1.5, or 2). */
  defaultMarksPerQuestion?: number;
  negativeMarkPerWrong?: number;
  showAnswersAfter: ExamShowAnswersAfter;
  visibility: ExamVisibility;
  selectedStudentRecordIds?: string[];
  status?: ExamStatus;
  /** When set, the test is closed for new attempts (admin action). */
  manuallyClosedAt?: string;
  /** UIDs of students whose active attempts are temporarily suspended by admin. */
  pausedUids?: string[];
  /** When true, this test is explicitly featured in the Public CBT Mock Test Portal for registered public candidates. */
  isPublicTest?: boolean;
  publishedAt?: string;
  settings?: ExamAdvancedSettings;
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

export interface ExamGuestProfile {
  id: string; // uid
  uid: string;
  testId: string;
  name: string;
  email: string;
  createdAt: string;
  createdAtServer?: any;
}

export interface ExamAttempt {
  id: string; // uid (doc id)
  uid: string;
  studentRecordId?: string;
  /** Guest / passcode participant display name (unenrolled). */
  participantName?: string;
  /** Guest / passcode participant email (unenrolled). */
  participantEmail?: string;
  isGuest?: boolean;
  testId: string;
  batchId: string;
  startedAt: string; // ISO
  startedAtServer?: any;
  hardEndAt?: string; // ISO (immutable per-attempt end time)
  lastSavedAt: string; // ISO
  lastSavedAtServer?: any;
  submittedAt?: string; // ISO
  status: AttemptStatus;
  answers: Record<string, number | null>; // questionId -> selectedIndex
  markedForReview?: string[]; // questionIds
  /** Persisted question order for this attempt (may be shuffled). Used to restore the same order on rejoin. */
  questionIds?: string[];
  /** Student tried to re-enter an in-progress attempt from a new session. */
  rejoinRequestedAt?: string;
  /** Admin-approved rejoin timestamp. */
  rejoinApprovedAt?: string;
  /** Student consumed the latest rejoin approval. */
  rejoinApprovalUsedAt?: string;
  score?: number;
  maxScore?: number;
}
