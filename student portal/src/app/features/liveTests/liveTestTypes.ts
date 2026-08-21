import type { PublishedTrack } from "../liveClasses/types";

export type LiveTestSessionStatus = "scheduled" | "active" | "ended";

export interface ProctoringSettings {
  enableStudentCamera: boolean;
  enableAdminVideo: boolean;
  maxTabSwitchWarnings: number;
  autoSubmitOnViolationLimit: boolean;
  lockFullScreen: boolean;
}

export interface LiveTestSession {
  id: string; // Document ID (session ID or testId)
  testId: string;
  testTitle: string;
  subject: string;
  batchId?: string;
  batchIds?: string[];
  status: LiveTestSessionStatus;
  startedAt?: string; // ISO String
  startedByUid?: string;
  adminName?: string;
  durationMinutes: number;
  proctoringSettings: ProctoringSettings;
  announcement?: string;
  announcementAt?: string;
  createdAt: string;
  endedAt?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledByUid?: string;
  scheduledByName?: string;
  coHostId?: string;
  coHostEmail?: string;
  coHostName?: string;
}

export interface LiveTestPresence {
  id: string; // uid
  uid: string;
  name: string;
  email?: string;
  role: "admin" | "student";
  sessionId: string;
  batchId?: string;
  batchName?: string;
  audioTrack?: PublishedTrack | null;
  videoTrack?: PublishedTrack | null;
  cameraStatus: "active" | "disabled" | "permission_denied";
  tabSwitchCount: number;
  isTabActive: boolean;
  currentQuestionIndex: number;
  totalAnswered: number;
  totalQuestions: number;
  isSubmitted: boolean;
  submittedAt?: string;
  warningMessage?: string;
  forceSubmittedByAdmin?: boolean;
  updatedAt: string;
}

export interface LiveTestAnnouncement {
  id: string;
  text: string;
  createdAt: string;
  sentBy: string;
}
