import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

export { realtimeProxy } from "./liveClasses/realtimeProxy";
export { getRecordingUploadUrl } from "./liveClasses/getRecordingUploadUrl";
export { getRecordingPlaybackUrl } from "./liveClasses/getRecordingPlaybackUrl";
export { createCoHost, deleteCoHost, resetCoHostPassword } from "./liveClasses/coHostAccounts";

/**
 * studentPortalLogin — username + password sign-in for students who cannot use Google.
 *
 * Accepts { username, password } from the client.
 * Looks up the student record in Firestore by portalUsername, validates the password,
 * then mints a custom Firebase Auth token signed with the student's Firestore doc ID as uid.
 * The client signs in with signInWithCustomToken() which triggers onAuthStateChanged.
 */
export const studentPortalLogin = onCall(
  { cors: true },
  async (request) => {
    const username = ((request.data?.username as string) || "").trim().toLowerCase();
    const password = ((request.data?.password as string) || "").trim();

    if (!username || !password) {
      throw new HttpsError("invalid-argument", "Username and password are required.");
    }

    const db = admin.firestore();

    // Find student by portalUsername (case-insensitive — stored lowercase)
    const snap = await db
      .collection("students")
      .where("portalUsername", "==", username)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new HttpsError("not-found", "Invalid username or password.");
    }

    const studentDoc = snap.docs[0];
    const studentData = studentDoc.data() as {
      portalPassword?: string;
      status?: string;
      name?: string;
    };

    // Check status
    if (studentData.status === "inactive") {
      throw new HttpsError("permission-denied", "Your account is inactive. Contact your admin.");
    }

    // Validate password (stored as plaintext admin-generated code)
    const storedPassword = (studentData.portalPassword || "").trim();
    if (!storedPassword || storedPassword !== password) {
      throw new HttpsError("not-found", "Invalid username or password.");
    }

    // Mint a custom token. Use the student Firestore doc ID as the Firebase Auth UID.
    // The onAuthStateChanged handler → fetchUserData will then load the full student profile.
    const customUid = `portal_${studentDoc.id}`;
    const customToken = await admin.auth().createCustomToken(customUid, {
      studentRecordId: studentDoc.id,
      role: "student",
    });

    // Ensure a users/{uid} doc exists so fetchUserData can hydrate the student profile.
    const userDocRef = db.collection("users").doc(customUid);
    const userSnap = await userDocRef.get();
    if (!userSnap.exists) {
      await userDocRef.set(
        {
          role: "student",
          name: studentData.name || "",
          email: (studentDoc.data().email as string | undefined) || "",
          studentRecordId: studentDoc.id,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    return { customToken };
  },
);

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

