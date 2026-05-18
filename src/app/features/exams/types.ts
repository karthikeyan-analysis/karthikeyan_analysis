export type ExamVisibility = "BATCH" | "SELECTIVE";

export type ExamShowAnswersAfter = "immediate" | "after_end" | "never";

export type ExamStatus = "draft" | "published";

export type ExamAccessMode =
  | "anyone"
  | "passcode"
  | "identifier_list"
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
  batchId: string;
  subject: string;
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
  negativeMarkPerWrong?: number;
  showAnswersAfter: ExamShowAnswersAfter;
  visibility: ExamVisibility;
  selectedStudentRecordIds?: string[];
  status?: ExamStatus;
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

