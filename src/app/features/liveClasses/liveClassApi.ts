import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import { normalizeLiveClassBatchFields } from "./liveClassBatchUtils";
import type {
  LiveClass,
  LiveClassAttendance,
  LiveClassDoubt,
  LiveClassPresence,
  ParticipantRole,
  PublishedTrack,
} from "./types";

const LIVE_CLASSES = "liveClasses";

export function liveClassRef(id: string) {
  return doc(db, LIVE_CLASSES, id);
}

export function liveClassAttendanceCol(classId: string) {
  return collection(db, LIVE_CLASSES, classId, "attendance");
}

export function liveClassAttendanceRef(classId: string, studentRecordId: string) {
  return doc(liveClassAttendanceCol(classId), studentRecordId);
}

export function liveClassDoubtsCol(classId: string) {
  return collection(db, LIVE_CLASSES, classId, "doubts");
}

export function liveClassPresenceCol(classId: string) {
  return collection(db, LIVE_CLASSES, classId, "presence");
}

export function liveClassPresenceRef(classId: string, uid: string) {
  return doc(liveClassPresenceCol(classId), uid);
}

// ── Class CRUD ────────────────────────────────────────────────────────────

export async function createLiveClass(data: {
  name: string;
  subject: string;
  batchIds: string[];
  hostUids: string[];
  coHostUids?: string[];
  scheduledAt?: string;
  createdBy: string;
}): Promise<string> {
  const { batchId, batchIds } = normalizeLiveClassBatchFields(data.batchIds);
  if (!data.hostUids.length) throw new Error("At least one host is required.");
  const coHostUids = (data.coHostUids || []).filter((id) => !data.hostUids.includes(id));
  const docRef = await addDoc(collection(db, LIVE_CLASSES), {
    name: data.name.trim(),
    subject: data.subject.trim(),
    batchId,
    batchIds,
    hostUids: data.hostUids,
    coHostUids,
    status: "scheduled",
    ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  });
  return docRef.id;
}

export async function listLiveClassesForAdmin(): Promise<LiveClass[]> {
  const snap = await getDocs(query(collection(db, LIVE_CLASSES), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClass[];
}

export function subscribeToLiveClassesForAdmin(
  onChange: (classes: LiveClass[]) => void,
): () => void {
  return onSnapshot(query(collection(db, LIVE_CLASSES), orderBy("createdAt", "desc")), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClass[]);
  });
}

/** Legacy single-batch field + multi-batch array (dedupe) — mirrors listExamTestsForStudent. */
export async function listLiveClassesForStudentBatch(batchId: string): Promise<LiveClass[]> {
  const [legacySnap, multiSnap] = await Promise.all([
    getDocs(query(collection(db, LIVE_CLASSES), where("batchId", "==", batchId))),
    getDocs(query(collection(db, LIVE_CLASSES), where("batchIds", "array-contains", batchId))),
  ]);
  const byId = new Map<string, LiveClass>();
  for (const d of [...legacySnap.docs, ...multiSnap.docs]) {
    byId.set(d.id, { id: d.id, ...(d.data() as any) } as LiveClass);
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function subscribeToLiveClassesForStudentBatch(
  batchId: string,
  onChange: (classes: LiveClass[]) => void,
): () => void {
  // Keep separate maps per query so a doc that stops matching one query is
  // removed (unless the other query still matches).
  const legacy = new Map<string, LiveClass>();
  const multi = new Map<string, LiveClass>();
  const emit = () => {
    const merged = new Map<string, LiveClass>([...legacy, ...multi]);
    onChange(
      [...merged.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    );
  };

  const unsubLegacy = onSnapshot(
    query(collection(db, LIVE_CLASSES), where("batchId", "==", batchId)),
    (snap) => {
      legacy.clear();
      for (const d of snap.docs) {
        legacy.set(d.id, { id: d.id, ...(d.data() as any) } as LiveClass);
      }
      emit();
    },
  );
  const unsubMulti = onSnapshot(
    query(collection(db, LIVE_CLASSES), where("batchIds", "array-contains", batchId)),
    (snap) => {
      multi.clear();
      for (const d of snap.docs) {
        multi.set(d.id, { id: d.id, ...(d.data() as any) } as LiveClass);
      }
      emit();
    },
  );
  return () => {
    unsubLegacy();
    unsubMulti();
  };
}

export async function getLiveClass(id: string): Promise<LiveClass | null> {
  const snap = await getDoc(liveClassRef(id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as LiveClass;
}

export function subscribeToLiveClass(
  id: string,
  onChange: (cls: LiveClass | null) => void,
): () => void {
  return onSnapshot(liveClassRef(id), (snap) => {
    onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as LiveClass) : null);
  });
}

export async function updateLiveClass(id: string, updates: Partial<LiveClass>): Promise<void> {
  const u = updates as Partial<LiveClass> & { batchIds?: string[] };
  const payload: Record<string, any> = { ...u, updatedAt: new Date().toISOString() };
  if (u.batchIds?.length) {
    const fields = normalizeLiveClassBatchFields(u.batchIds);
    payload.batchId = fields.batchId;
    payload.batchIds = fields.batchIds;
  }
  await updateDoc(liveClassRef(id), payload);
}

export async function endLiveClass(id: string): Promise<void> {
  await updateDoc(liveClassRef(id), {
    status: "ended",
    endedAt: new Date().toISOString(),
    spotlightUid: deleteField(),
    liveTestId: deleteField(),
    liveTestStartedAt: deleteField(),
  } as any);
}

/**
 * Revert an active class to "scheduled" when the last host/co-host leaves
 * without ending it — students must not be able to join an empty room.
 */
export async function deactivateLiveClass(id: string): Promise<void> {
  await updateDoc(liveClassRef(id), {
    status: "scheduled",
    activeSince: deleteField(),
    spotlightUid: deleteField(),
    liveTestId: deleteField(),
    liveTestStartedAt: deleteField(),
  } as any);
}

export async function deleteLiveClass(id: string): Promise<void> {
  await deleteDoc(liveClassRef(id));
  // Note: attendance/doubts subcollections require a recursive delete (Firebase CLI/extension) to fully clean up.
}

export async function setSpotlight(id: string, uid: string | null): Promise<void> {
  await updateDoc(liveClassRef(id), { spotlightUid: uid ?? deleteField() } as any);
}

export async function launchLiveTest(id: string, examTestId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(liveClassRef(id), {
    liveTestId: examTestId,
    liveTestStartedAt: now,
    liveTestActive: true,
  } as any);

  try {
    const testSnap = await getDoc(doc(db, "examTests", examTestId));
    if (testSnap.exists()) {
      const testData = testSnap.data();
      const q = query(
        collection(db, "liveTestSessions"),
        where("testId", "==", examTestId),
        where("status", "==", "active"),
      );
      const activeSnaps = await getDocs(q);
      if (activeSnaps.empty) {
        await setDoc(doc(db, "liveTestSessions", examTestId), {
          id: examTestId,
          testId: examTestId,
          testTitle: testData.title || "Live Class Test",
          subject: testData.subject || "",
          batchId: testData.batchId || "",
          batchIds: testData.batchIds || (testData.batchId ? [testData.batchId] : []),
          status: "active",
          startedAt: now,
          startedByUid: "live_class_host",
          adminName: "Live Class Host",
          durationMinutes: testData.durationMinutes || 60,
          createdAt: now,
        });
      }
    }
  } catch (err) {
    console.warn("Could not create liveTestSession on launchLiveTest", err);
  }
}

export async function stopLiveTest(id: string): Promise<void> {
  const classSnap = await getDoc(liveClassRef(id));
  const liveTestId = classSnap.exists() ? classSnap.data()?.liveTestId : null;

  await updateDoc(liveClassRef(id), {
    liveTestId: deleteField(),
    liveTestStartedAt: deleteField(),
    liveTestActive: deleteField(),
  } as any);

  if (liveTestId) {
    try {
      const sessionRef = doc(db, "liveTestSessions", liveTestId);
      const snap = await getDoc(sessionRef);
      if (snap.exists() && snap.data()?.status === "active") {
        await updateDoc(sessionRef, { status: "ended", endedAt: new Date().toISOString() });
      }
    } catch (e) {
      console.warn("Could not stop liveTestSession", e);
    }
  }
}

// ── Attendance ────────────────────────────────────────────────────────────

export async function recordAttendanceJoin(params: {
  classId: string;
  studentRecordId: string;
  studentUid: string;
  name: string;
  email?: string;
  studentId?: string;
}): Promise<void> {
  const ref = liveClassAttendanceRef(params.classId, params.studentRecordId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const now = new Date().toISOString();
    if (!snap.exists()) {
      tx.set(ref, {
        studentRecordId: params.studentRecordId,
        studentUid: params.studentUid,
        name: params.name,
        email: params.email || "",
        studentId: params.studentId || "",
        sessions: [],
        totalDurationSec: 0,
        currentSessionJoinedAt: now,
        firstJoinedAt: now,
        lastJoinedAt: now,
      });
      return;
    }
    const data = snap.data() as any;
    const updates: Record<string, any> = {
      name: params.name || data.name,
      lastJoinedAt: now,
    };
    if (!data.firstJoinedAt) updates.firstJoinedAt = now;
    if (params.email && !data.email) updates.email = params.email;
    if (params.studentId && !data.studentId) updates.studentId = params.studentId;

    // Reconnect while a session is already open — leave currentSessionJoinedAt as-is
    if (!data.currentSessionJoinedAt) {
      updates.currentSessionJoinedAt = now;
    }
    tx.update(ref, updates);
  });
}

export async function recordAttendanceLeave(params: {
  classId: string;
  studentRecordId: string;
}): Promise<void> {
  const ref = liveClassAttendanceRef(params.classId, params.studentRecordId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const joinedAt = data.currentSessionJoinedAt as string | undefined;
    if (!joinedAt) return;
    const now = new Date().toISOString();
    const durationSec = Math.max(0, Math.round((Date.parse(now) - Date.parse(joinedAt)) / 1000));
    tx.update(ref, {
      sessions: arrayUnion({ joinedAt, leftAt: now }),
      totalDurationSec: (data.totalDurationSec || 0) + durationSec,
      currentSessionJoinedAt: deleteField(),
      lastLeftAt: now,
    });
  });
}

function processAttendanceRows(rows: LiveClassAttendance[]): LiveClassAttendance[] {
  return rows.map((d) => {
    const joined = d.firstJoinedAt || d.lastJoinedAt || d.currentSessionJoinedAt || (d.sessions && d.sessions[0]?.joinedAt);
    return {
      ...d,
      firstJoinedAt: joined || d.firstJoinedAt,
    };
  });
}

export async function listAttendanceForAdmin(classId: string): Promise<LiveClassAttendance[]> {
  const snap = await getDocs(liveClassAttendanceCol(classId));
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClassAttendance[];
  
  try {
    const missingInfo = docs.some((d) => !d.email || !d.studentId);
    if (missingInfo) {
      const studentSnaps = await getDocs(collection(db, "students"));
      const studentMap = new Map<string, any>();
      studentSnaps.docs.forEach((sDoc) => {
        studentMap.set(sDoc.id, sDoc.data());
      });
      docs.forEach((d) => {
        const info = studentMap.get(d.studentRecordId) || studentMap.get(d.id);
        if (info) {
          if (!d.email && info.email) d.email = info.email;
          if (!d.studentId && info.studentId) d.studentId = info.studentId;
        }
      });
    }
  } catch (err) {
    console.warn("Could not enrich student attendance details", err);
  }

  return processAttendanceRows(docs);
}

export function subscribeToAttendance(
  classId: string,
  onChange: (rows: LiveClassAttendance[]) => void,
): () => void {
  return onSnapshot(liveClassAttendanceCol(classId), (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClassAttendance[];
    onChange(processAttendanceRows(docs));
  });
}

// ── Doubts ────────────────────────────────────────────────────────────────

export async function addDoubt(params: {
  classId: string;
  studentRecordId: string;
  studentUid: string;
  studentName: string;
  text: string;
}): Promise<void> {
  const text = params.text.trim();
  if (!text) throw new Error("Doubt text is required.");
  await addDoc(liveClassDoubtsCol(params.classId), {
    studentRecordId: params.studentRecordId,
    studentUid: params.studentUid,
    studentName: params.studentName,
    text,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    resolved: false,
  });
}

export function subscribeToDoubts(
  classId: string,
  onChange: (doubts: LiveClassDoubt[]) => void,
): () => void {
  return onSnapshot(query(liveClassDoubtsCol(classId), orderBy("createdAt", "asc")), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClassDoubt[]);
  });
}

/** Student-side: only their own doubts (matches the Firestore rule so it works before/after resolution). */
export function subscribeToOwnDoubts(
  classId: string,
  studentUid: string,
  onChange: (doubts: LiveClassDoubt[]) => void,
): () => void {
  return onSnapshot(
    query(liveClassDoubtsCol(classId), where("studentUid", "==", studentUid), orderBy("createdAt", "asc")),
    (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClassDoubt[]);
    },
  );
}

export async function resolveDoubt(classId: string, doubtId: string, resolvedBy: string): Promise<void> {
  await updateDoc(doc(liveClassDoubtsCol(classId), doubtId), {
    resolved: true,
    resolvedBy,
    resolvedAt: new Date().toISOString(),
  } as any);
}

// ── Presence (live roster) ──────────────────────────────────────────────────
// Ephemeral — one doc per currently-connected participant, doc id === uid.
// Distinct from the `attendance` subcollection above, which is the durable
// historical record. Written by the owner of the doc except for the three
// host-control flags, which is enforced by the Firestore rule, not here.

export async function upsertOwnPresence(params: {
  classId: string;
  uid: string;
  role: ParticipantRole;
  name: string;
  sessionId: string;
  audioTrack?: PublishedTrack | null;
  videoTrack?: PublishedTrack | null;
  screenshareVideoTrack?: PublishedTrack | null;
}): Promise<void> {
  await setDoc(
    liveClassPresenceRef(params.classId, params.uid),
    {
      role: params.role,
      name: params.name,
      sessionId: params.sessionId,
      ...(params.audioTrack !== undefined
        ? { audioTrack: params.audioTrack ?? deleteField() }
        : {}),
      ...(params.videoTrack !== undefined
        ? { videoTrack: params.videoTrack ?? deleteField() }
        : {}),
      ...(params.screenshareVideoTrack !== undefined
        ? { screenshareVideoTrack: params.screenshareVideoTrack ?? deleteField() }
        : {}),
      updatedAt: new Date().toISOString(),
    } as any,
    { merge: true },
  );
}

export async function deleteOwnPresence(classId: string, uid: string): Promise<void> {
  await deleteDoc(liveClassPresenceRef(classId, uid));
}

export function subscribeToPresence(
  classId: string,
  onChange: (rows: LiveClassPresence[]) => void,
): () => void {
  return onSnapshot(liveClassPresenceCol(classId), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LiveClassPresence[]);
  });
}

/** Host/co-host only (enforced by Firestore rule) — the three cooperative control flags. */
export async function setHostControlFlag(
  classId: string,
  targetUid: string,
  flag: "mutedByHost" | "videoDisabledByHost" | "kicked",
  value: boolean,
): Promise<void> {
  await updateDoc(liveClassPresenceRef(classId, targetUid), {
    [flag]: value,
    updatedAt: new Date().toISOString(),
  } as any);
}
