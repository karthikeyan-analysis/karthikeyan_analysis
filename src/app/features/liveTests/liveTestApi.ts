import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { LiveTestPresence, LiveTestSession, ProctoringSettings } from "./liveTestTypes";

export async function createLiveTestSession(params: {
  testId: string;
  testTitle: string;
  subject: string;
  batchId?: string;
  batchIds?: string[];
  durationMinutes: number;
  adminUid: string;
  adminName: string;
  coHostId?: string;
  coHostEmail?: string;
  coHostName?: string;
  proctoringSettings?: Partial<ProctoringSettings>;
}): Promise<string> {
  const sessionId = doc(collection(db, "liveTestSessions")).id;
  const now = new Date().toISOString();

  const sessionData: LiveTestSession = {
    id: sessionId,
    testId: params.testId,
    testTitle: params.testTitle,
    subject: params.subject,
    batchId: params.batchId || "",
    batchIds: params.batchIds || (params.batchId ? [params.batchId] : []),
    status: "active",
    startedAt: now,
    startedByUid: params.adminUid,
    adminName: params.adminName,
    coHostId: params.coHostId,
    coHostEmail: params.coHostEmail,
    coHostName: params.coHostName,
    durationMinutes: params.durationMinutes,
    proctoringSettings: {
      enableStudentCamera: true,
      enableAdminVideo: true,
      maxTabSwitchWarnings: 3,
      autoSubmitOnViolationLimit: false,
      lockFullScreen: false,
      ...params.proctoringSettings,
    },
    createdAt: now,
  };

  await setDoc(doc(db, "liveTestSessions", sessionId), sessionData);
  return sessionId;
}

export async function endLiveTestSession(sessionId: string): Promise<void> {
  const ref = doc(db, "liveTestSessions", sessionId);
  await updateDoc(ref, {
    status: "ended",
    endedAt: new Date().toISOString(),
  });
}

export function subscribeToLiveTestSession(
  sessionId: string,
  onData: (session: LiveTestSession | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, "liveTestSessions", sessionId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() } as LiveTestSession);
    },
    (err) => {
      console.error("[liveTest] Session subscribe error", err);
      onError?.(err);
    },
  );
}

export function subscribeToActiveLiveTestForTest(
  testId: string,
  onData: (session: LiveTestSession | null) => void,
): () => void {
  const q = query(
    collection(db, "liveTestSessions"),
    where("status", "==", "active"),
  );

  return onSnapshot(q, (snap) => {
    const found = snap.docs.find((d) => {
      const data = d.data();
      return d.id === testId || data.testId === testId || data.id === testId;
    });
    if (found) {
      onData({ id: found.id, ...found.data() } as LiveTestSession);
    } else {
      onData(null);
    }
  });
}

export function subscribeAllActiveLiveTestSessions(
  onData: (sessions: LiveTestSession[]) => void,
): () => void {
  const q = query(collection(db, "liveTestSessions"), where("status", "==", "active"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LiveTestSession);
    onData(list);
  });
}

export function subscribeAllScheduledLiveTestSessions(
  onData: (sessions: LiveTestSession[]) => void,
): () => void {
  const q = query(collection(db, "liveTestSessions"), where("status", "==", "scheduled"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LiveTestSession);
    onData(list);
  });
}

export function subscribeAllLiveTestSessions(
  onData: (sessions: LiveTestSession[]) => void,
): () => void {
  const col = collection(db, "liveTestSessions");
  return onSnapshot(col, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LiveTestSession);
    onData(list);
  });
}

export async function scheduleLiveTestSession(params: {
  testId: string;
  testTitle: string;
  subject: string;
  batchId?: string;
  batchIds?: string[];
  durationMinutes: number;
  scheduledStartTime: string;
  scheduledEndTime: string;
  adminUid: string;
  adminName: string;
  coHostId?: string;
  coHostEmail?: string;
  coHostName?: string;
  proctoringSettings?: Partial<ProctoringSettings>;
}): Promise<string> {
  const sessionId = doc(collection(db, "liveTestSessions")).id;
  const now = new Date().toISOString();

  const sessionData: LiveTestSession = {
    id: sessionId,
    testId: params.testId,
    testTitle: params.testTitle,
    subject: params.subject,
    batchId: params.batchId || "",
    batchIds: params.batchIds || (params.batchId ? [params.batchId] : []),
    status: "scheduled",
    scheduledStartTime: params.scheduledStartTime,
    scheduledEndTime: params.scheduledEndTime,
    scheduledByUid: params.adminUid,
    scheduledByName: params.adminName,
    adminName: params.adminName,
    coHostId: params.coHostId,
    coHostEmail: params.coHostEmail,
    coHostName: params.coHostName,
    durationMinutes: params.durationMinutes,
    proctoringSettings: {
      enableStudentCamera: true,
      enableAdminVideo: true,
      maxTabSwitchWarnings: 3,
      autoSubmitOnViolationLimit: false,
      lockFullScreen: false,
      ...params.proctoringSettings,
    },
    createdAt: now,
  };

  await setDoc(doc(db, "liveTestSessions", sessionId), sessionData);
  return sessionId;
}

export async function startScheduledTestNow(
  sessionId: string,
  adminUid?: string,
  adminName?: string,
): Promise<void> {
  const ref = doc(db, "liveTestSessions", sessionId);
  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: "active",
    startedAt: now,
    ...(adminUid ? { startedByUid: adminUid } : {}),
    ...(adminName ? { adminName } : {}),
  });
}

export async function deleteLiveTestSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, "liveTestSessions", sessionId));
}

export async function sendLiveTestAnnouncement(
  sessionId: string,
  text: string,
): Promise<void> {
  const ref = doc(db, "liveTestSessions", sessionId);
  await updateDoc(ref, {
    announcement: text,
    announcementAt: new Date().toISOString(),
  });
}

// ── Presence Management ────────────────────────────────────────────────────────

export async function upsertLiveTestPresence(
  sessionId: string,
  uid: string,
  data: Partial<LiveTestPresence> & { name: string; role: "admin" | "cohost" | "student" },
): Promise<void> {
  const ref = doc(db, "liveTestSessions", sessionId, "presence", uid);
  const snap = await getDoc(ref);
  const now = new Date().toISOString();

  if (!snap.exists()) {
    const newDoc: LiveTestPresence = {
      id: uid,
      uid,
      name: data.name,
      role: data.role,
      sessionId,
      cameraStatus: data.cameraStatus || "active",
      tabSwitchCount: data.tabSwitchCount || 0,
      isTabActive: true,
      currentQuestionIndex: data.currentQuestionIndex || 0,
      totalAnswered: data.totalAnswered || 0,
      totalQuestions: data.totalQuestions || 0,
      isSubmitted: false,
      updatedAt: now,
      ...data,
    };
    await setDoc(ref, newDoc);
  } else {
    await updateDoc(ref, {
      ...data,
      updatedAt: now,
    });
  }
}

export async function deleteLiveTestPresence(sessionId: string, uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "liveTestSessions", sessionId, "presence", uid));
  } catch (err) {
    console.warn("Could not delete live test presence", err);
  }
}

export function subscribeToLiveTestPresence(
  sessionId: string,
  onData: (presenceList: LiveTestPresence[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const col = collection(db, "liveTestSessions", sessionId, "presence");
  return onSnapshot(
    col,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LiveTestPresence);
      onData(list);
    },
    (err) => {
      console.error("[liveTest] Presence subscribe error", err);
      onError?.(err);
    },
  );
}

export async function sendStudentWarningMessage(
  sessionId: string,
  studentUid: string,
  message: string,
): Promise<void> {
  const ref = doc(db, "liveTestSessions", sessionId, "presence", studentUid);
  await updateDoc(ref, {
    warningMessage: message,
    updatedAt: new Date().toISOString(),
  });
}

export async function forceSubmitStudentAttempt(
  sessionId: string,
  studentUid: string,
): Promise<void> {
  const ref = doc(db, "liveTestSessions", sessionId, "presence", studentUid);
  await updateDoc(ref, {
    forceSubmittedByAdmin: true,
    updatedAt: new Date().toISOString(),
  });
}
