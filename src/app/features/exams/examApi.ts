import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db } from "../../../config/firebase";
import { storage } from "../../../config/firebase";
import { allowsPasscodeGuestAccess, enrolledStudentsCanAccessTest } from "./settings";
import { examIncludesBatch } from "./examBatchUtils";
import { sha256Base64 } from "./password";
import type {
  ExamAttempt,
  ExamGuestProfile,
  ExamQuestionPrivate,
  ExamQuestionPublic,
  ExamTest,
} from "./types";

const TESTS = "examTests";

export function examTestRef(testId: string) {
  return doc(db, TESTS, testId);
}

export function examQuestionsPublicCol(testId: string) {
  return collection(db, TESTS, testId, "questionsPublic");
}

export function examQuestionsPrivateCol(testId: string) {
  return collection(db, TESTS, testId, "questionsPrivate");
}

export function examAttemptRef(testId: string, uid: string) {
  return doc(db, TESTS, testId, "attempts", uid);
}

export function examAttemptsCol(testId: string) {
  return collection(db, TESTS, testId, "attempts");
}

export function examGuestProfileRef(testId: string, uid: string) {
  return doc(db, TESTS, testId, "guestProfiles", uid);
}

export function examGuestProfilesCol(testId: string) {
  return collection(db, TESTS, testId, "guestProfiles");
}

export async function listExamTestsForAdmin(): Promise<ExamTest[]> {
  const snap = await getDocs(query(collection(db, TESTS), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamTest[];
}

export async function listExamTestsForStudent(params: {
  batchId: string;
  studentRecordId?: string;
}): Promise<ExamTest[]> {
  // Legacy single-batch field + multi-batch array (dedupe).
  const [legacySnap, multiSnap] = await Promise.all([
    getDocs(query(collection(db, TESTS), where("batchId", "==", params.batchId))),
    getDocs(query(collection(db, TESTS), where("batchIds", "array-contains", params.batchId))),
  ]);
  const byId = new Map<string, ExamTest>();
  for (const d of [...legacySnap.docs, ...multiSnap.docs]) {
    byId.set(d.id, { id: d.id, ...(d.data() as object) } as ExamTest);
  }
  const tests = [...byId.values()];
  const visible = tests.filter((t) => {
    if (!examIncludesBatch(t, params.batchId)) return false;
    if (!enrolledStudentsCanAccessTest(t)) return false;
    if (t.visibility === "SELECTIVE" && params.studentRecordId) {
      return (t.selectedStudentRecordIds || []).includes(params.studentRecordId);
    }
    return true;
  });
  return visible.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

/** Published passcode tests open to unenrolled guests. */
export async function listPasscodeGuestExamTests(): Promise<ExamTest[]> {
  const snap = await getDocs(query(collection(db, TESTS), orderBy("createdAt", "desc")));
  const tests = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamTest[];
  return tests.filter((t) => allowsPasscodeGuestAccess(t) && !t.manuallyClosedAt);
}

export async function verifyExamPasscode(test: ExamTest, passcode: string): Promise<boolean> {
  if (!test.accessPasswordHash) return false;
  const h = await sha256Base64(passcode.trim());
  return h === test.accessPasswordHash;
}

export async function getGuestProfile(testId: string, uid: string): Promise<ExamGuestProfile | null> {
  const snap = await getDoc(examGuestProfileRef(testId, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as ExamGuestProfile;
}

export async function saveGuestProfile(params: {
  testId: string;
  uid: string;
  name: string;
  email: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const name = params.name.trim();
  const now = new Date().toISOString();
  await setDoc(
    examGuestProfileRef(params.testId, params.uid),
    {
      uid: params.uid,
      testId: params.testId,
      name,
      email,
      createdAt: now,
      createdAtServer: serverTimestamp(),
    } satisfies Omit<ExamGuestProfile, "id"> as any,
    { merge: true },
  );
}

export async function createExamTest(
  test: Omit<ExamTest, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const batchIds = test.batchIds?.length ? test.batchIds : test.batchId ? [test.batchId] : [];
  const docRef = await addDoc(collection(db, TESTS), {
    ...test,
    ...(batchIds.length
      ? { batchId: batchIds[0], batchIds: [...new Set(batchIds)] }
      : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateExamTest(testId: string, updates: Partial<ExamTest>) {
  const u = updates as Partial<ExamTest> & {
    accessPasswordHash?: string | null;
    manuallyClosedAt?: string | null;
  };
  const payload: Record<string, any> = {
    ...u,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  };
  if (u.batchIds?.length) {
    const unique = [...new Set(u.batchIds.filter(Boolean))];
    payload.batchIds = unique;
    payload.batchId = unique[0];
  }
  if (u.accessPasswordHash === null) payload.accessPasswordHash = deleteField();
  if (u.manuallyClosedAt === null) payload.manuallyClosedAt = deleteField();
  await updateDoc(examTestRef(testId), payload as any);
}

export async function setExamManuallyClosed(testId: string, closed: boolean): Promise<void> {
  await updateExamTest(testId, {
    manuallyClosedAt: closed ? new Date().toISOString() : (null as unknown as string),
  } as Partial<ExamTest> & { manuallyClosedAt: string | null });
}

export async function deleteExamTest(testId: string) {
  await deleteDoc(examTestRef(testId));
  // Note: subcollections require Firebase CLI recursive delete or extension.
}

export async function getExamTest(testId: string): Promise<ExamTest | null> {
  const snap = await getDoc(examTestRef(testId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as ExamTest;
}

export async function listPublicQuestions(testId: string): Promise<ExamQuestionPublic[]> {
  const snap = await getDocs(
    query(examQuestionsPublicCol(testId), orderBy("questionNo", "asc"), limit(500)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamQuestionPublic[];
}

export async function listPrivateQuestions(testId: string): Promise<ExamQuestionPrivate[]> {
  // Private docs only store the answer key; no questionNo field to order by.
  const snap = await getDocs(query(examQuestionsPrivateCol(testId), limit(500)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamQuestionPrivate[];
}

export async function upsertQuestion(params: {
  testId: string;
  questionId?: string;
  publicData: Omit<ExamQuestionPublic, "id">;
  privateData: Omit<ExamQuestionPrivate, "id">;
}): Promise<string> {
  const id = params.questionId || doc(examQuestionsPublicCol(params.testId)).id;
  await Promise.all([
    setDoc(doc(examQuestionsPublicCol(params.testId), id), params.publicData, { merge: true }),
    setDoc(doc(examQuestionsPrivateCol(params.testId), id), params.privateData, { merge: true }),
  ]);
  return id;
}

export async function uploadQuestionImage(params: {
  testId: string;
  questionId: string;
  file: File;
}): Promise<string> {
  const safeName = params.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `examTests/${params.testId}/questions/${params.questionId}/${Date.now()}_${safeName}`;
  const r = ref(storage, path);
  await uploadBytes(r, params.file, {
    contentType: params.file.type || "image/png",
    cacheControl: "public,max-age=31536000",
  });
  return await getDownloadURL(r);
}

export async function deleteQuestion(testId: string, questionId: string) {
  await Promise.all([
    deleteDoc(doc(examQuestionsPublicCol(testId), questionId)),
    deleteDoc(doc(examQuestionsPrivateCol(testId), questionId)),
  ]);
}

export async function getAttempt(testId: string, uid: string): Promise<ExamAttempt | null> {
  const snap = await getDoc(examAttemptRef(testId, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as ExamAttempt;
}

export async function startAttempt(params: {
  testId: string;
  uid: string;
  batchId: string;
  studentRecordId?: string;
  participantName?: string;
  participantEmail?: string;
  isGuest?: boolean;
  questionIds: string[];
  hardEndAt?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const answers: Record<string, number | null> = {};
  params.questionIds.forEach((id) => (answers[id] = null));

  if (params.studentRecordId) {
    const existingForStudent = await getDocs(
      query(
        examAttemptsCol(params.testId),
        where("studentRecordId", "==", params.studentRecordId),
        limit(1),
      ),
    );
    const duplicate = existingForStudent.docs.find((attemptDoc) => attemptDoc.id !== params.uid);
    if (duplicate) {
      throw new Error("This student ID already has an attempt for this test.");
    }
  }

  await setDoc(
    examAttemptRef(params.testId, params.uid),
    {
      uid: params.uid,
      studentRecordId: params.studentRecordId || null,
      participantName: params.participantName?.trim() || null,
      participantEmail: params.participantEmail?.trim().toLowerCase() || null,
      isGuest: params.isGuest === true,
      testId: params.testId,
      batchId: params.batchId,
      startedAt: now,
      hardEndAt: params.hardEndAt || null,
      lastSavedAt: now,
      status: "in_progress",
      answers,
      // Persist the question order so a rejoin restores the exact same sequence
      // (critical when randomizeQuestionOrder is enabled).
      questionIds: params.questionIds,
      markedForReview: [],
      startedAtServer: serverTimestamp(),
      lastSavedAtServer: serverTimestamp(),
    } satisfies Omit<ExamAttempt, "id"> as any,
    { merge: true },
  );
}

export async function requestRejoinApproval(testId: string, uid: string): Promise<void> {
  await updateDoc(examAttemptRef(testId, uid), {
    rejoinRequestedAt: new Date().toISOString(),
    rejoinRequestedAtServer: serverTimestamp(),
  } as any);
}

export async function approveRejoinForAdmin(testId: string, uid: string): Promise<void> {
  await updateDoc(examAttemptRef(testId, uid), {
    rejoinApprovedAt: new Date().toISOString(),
    rejoinApprovedAtServer: serverTimestamp(),
  } as any);
}

export async function markRejoinApprovalUsed(testId: string, uid: string): Promise<void> {
  await updateDoc(examAttemptRef(testId, uid), {
    rejoinApprovalUsedAt: new Date().toISOString(),
    rejoinApprovalUsedAtServer: serverTimestamp(),
  } as any);
}

export async function saveAttemptProgress(params: {
  testId: string;
  uid: string;
  answers: Record<string, number | null>;
  markedForReview: string[];
}) {
  await setDoc(
    examAttemptRef(params.testId, params.uid),
    {
      answers: params.answers,
      markedForReview: params.markedForReview,
      lastSavedAt: new Date().toISOString(),
      lastSavedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function submitAttempt(params: {
  testId: string;
  uid: string;
  score: number;
  maxScore: number;
}) {
  await updateDoc(examAttemptRef(params.testId, params.uid), {
    status: "submitted",
    submittedAt: new Date().toISOString(),
    submittedAtServer: serverTimestamp(),
    score: params.score,
    maxScore: params.maxScore,
  } as any);
}

export async function listAttemptsForAdmin(testId: string): Promise<ExamAttempt[]> {
  const snap = await getDocs(query(examAttemptsCol(testId), orderBy("startedAt", "desc"), limit(2000)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamAttempt[];
}

export async function deleteAttemptsForAdmin(testId: string): Promise<number> {
  let deleted = 0;

  while (true) {
    const snap = await getDocs(query(examAttemptsCol(testId), limit(500)));
    if (snap.empty) return deleted;

    const batch = writeBatch(db);
    snap.docs.forEach((attemptDoc) => {
      batch.delete(attemptDoc.ref);
    });
    await batch.commit();
    deleted += snap.size;
  }
}

/**
 * Admin-triggered force submit: reads the student's current saved answers, calculates the score
 * against private keys, then marks the attempt as submitted. Safe to call on any in-progress attempt.
 */
export async function forceSubmitAttemptForAdmin(params: {
  testId: string;
  uid: string;
  negativeMarkPerWrong?: number;
}): Promise<{ score: number; maxScore: number }> {
  const [attempt, questions, keys] = await Promise.all([
    getAttempt(params.testId, params.uid),
    listPublicQuestions(params.testId),
    listPrivateQuestions(params.testId),
  ]);
  if (!attempt) throw new Error("No attempt found for this student");
  if (attempt.status === "submitted") throw new Error("Attempt is already submitted");

  const keyById = new Map(keys.map((k) => [k.id, k.correctIndex]));
  const neg = params.negativeMarkPerWrong ?? 0;
  let s = 0;
  let max = 0;
  questions.forEach((q) => {
    max += q.marks;
    const selected = (attempt.answers ?? {})[q.id];
    if (selected == null) return;
    const correct = keyById.get(q.id);
    if (correct == null) return;
    if (selected === correct) s += q.marks;
    else s -= neg;
  });
  s = Math.max(0, s);

  await submitAttempt({ testId: params.testId, uid: params.uid, score: s, maxScore: max });
  return { score: s, maxScore: max };
}

/** Loads every test and its attempts (one Firestore read per test for attempts). */
export async function listAllTestsWithAttemptsForAdmin(): Promise<
  { test: ExamTest; attempts: ExamAttempt[] }[]
> {
  const tests = await listExamTestsForAdmin();
  const pairs = await Promise.all(
    tests.map(async (test) => ({
      test,
      attempts: await listAttemptsForAdmin(test.id),
    })),
  );
  return pairs;
}

