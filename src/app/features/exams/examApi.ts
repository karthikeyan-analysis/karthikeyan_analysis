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
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db } from "../../../config/firebase";
import { storage } from "../../../config/firebase";
import type {
  ExamAttempt,
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

export async function listExamTestsForAdmin(): Promise<ExamTest[]> {
  const snap = await getDocs(query(collection(db, TESTS), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamTest[];
}

export async function listExamTestsForStudent(params: {
  batchId: string;
  studentRecordId?: string;
}): Promise<ExamTest[]> {
  // Avoid composite-index requirement by sorting client-side.
  const snap = await getDocs(query(collection(db, TESTS), where("batchId", "==", params.batchId)));

  const tests = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamTest[];
  const visible = tests.filter((t) => {
    if (t.visibility === "BATCH") return true;
    if (!params.studentRecordId) return false;
    return (t.selectedStudentRecordIds || []).includes(params.studentRecordId);
  });
  return visible.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

export async function createExamTest(
  test: Omit<ExamTest, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const docRef = await addDoc(collection(db, TESTS), {
    ...test,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateExamTest(testId: string, updates: Partial<ExamTest>) {
  const u = updates as Partial<ExamTest> & { accessPasswordHash?: string | null };
  const payload: Record<string, any> = {
    ...u,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  };
  if (u.accessPasswordHash === null) payload.accessPasswordHash = deleteField();
  await updateDoc(examTestRef(testId), payload as any);
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
  questionIds: string[];
  hardEndAt?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const answers: Record<string, number | null> = {};
  params.questionIds.forEach((id) => (answers[id] = null));

  await setDoc(
    examAttemptRef(params.testId, params.uid),
    {
      uid: params.uid,
      studentRecordId: params.studentRecordId || null,
      testId: params.testId,
      batchId: params.batchId,
      startedAt: now,
      hardEndAt: params.hardEndAt || null,
      lastSavedAt: now,
      status: "in_progress",
      answers,
      markedForReview: [],
      startedAtServer: serverTimestamp(),
      lastSavedAtServer: serverTimestamp(),
    } satisfies Omit<ExamAttempt, "id"> as any,
    { merge: true },
  );
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

