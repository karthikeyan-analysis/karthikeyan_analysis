import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

export const submitExamAttempt = onCall(
  {
    // Allow callable invocation from browsers (local dev + production).
    cors: true,
  },
  async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }
  const uid = request.auth.uid;
  const testId = (request.data?.testId as string) || "";
  if (!testId) {
    throw new HttpsError("invalid-argument", "testId required");
  }

  const db = admin.firestore();
  const testRef = db.collection("examTests").doc(testId);
  const attemptRef = testRef.collection("attempts").doc(uid);

  const [testSnap, attemptSnap] = await Promise.all([testRef.get(), attemptRef.get()]);
  if (!testSnap.exists) {
    throw new HttpsError("not-found", "Exam not found");
  }
  if (!attemptSnap.exists) {
    throw new HttpsError("failed-precondition", "Attempt not started");
  }

  const test = testSnap.data() as any;
  const attempt = attemptSnap.data() as any;

  const endAt = new Date(test.endAt).getTime();
  const startedAt = new Date(attempt.startedAt).getTime();
  const durationMs = (Number(test.durationMinutes) || 0) * 60 * 1000;
  const hardEnd = Math.min(startedAt + durationMs, endAt);

  // Prevent re-submission
  if (attempt.status === "submitted") {
    // If previously submitted when scoring logic was outdated, allow recompute after timer end.
    const force = !!request.data?.forceRecompute;
    const hasScore = typeof attempt.score === "number" && typeof attempt.maxScore === "number";
    if (!force || Date.now() < hardEnd) {
      return {
        attemptId: uid,
        score: attempt.score ?? 0,
        maxScore: attempt.maxScore ?? test.totalMarks ?? 0,
        submittedAt: attempt.submittedAt ?? new Date().toISOString(),
      };
    }
  }

  // Enforce time window end: only submit after the exam timer should have ended
  if (Date.now() < hardEnd) {
    throw new HttpsError(
      "failed-precondition",
      "Exam is still running; cannot submit before timer ends",
    );
  }

  const [publicQsSnap, privateQsSnap] = await Promise.all([
    testRef.collection("questionsPublic").get(),
    testRef.collection("questionsPrivate").get(),
  ]);

  const publicById = new Map<string, any>();
  publicQsSnap.forEach((d) => publicById.set(d.id, d.data()));
  const privateById = new Map<string, any>();
  privateQsSnap.forEach((d) => privateById.set(d.id, d.data()));

  const neg = Number(test.negativeMarkPerWrong) || 0;
  const answers = (attempt.answers || {}) as Record<string, number | null>;

  let score = 0;
  let maxScore = 0;

  for (const [qid, qpub] of publicById.entries()) {
    const marks = Number(qpub.marks) || 0;
    maxScore += marks;
    const selected = answers[qid];
    if (selected == null) continue;
    const key = privateById.get(qid);
    const correct = key?.correctIndex;
    if (typeof correct !== "number") continue;
    if (selected === correct) score += marks;
    else score -= neg;
  }

  if (score < 0) score = 0;

  const submittedAt = attempt.submittedAt || new Date().toISOString();
  await attemptRef.set(
    {
      status: "submitted",
      submittedAt,
      score,
      maxScore,
      submittedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { attemptId: uid, score, maxScore, submittedAt };
  },
);

