"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitExamAttempt = exports.studentPortalLogin = exports.resetCoHostPassword = exports.deleteCoHost = exports.createCoHost = exports.getRecordingPlaybackUrl = exports.getRecordingUploadUrl = exports.realtimeProxy = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
var realtimeProxy_1 = require("./liveClasses/realtimeProxy");
Object.defineProperty(exports, "realtimeProxy", { enumerable: true, get: function () { return realtimeProxy_1.realtimeProxy; } });
var getRecordingUploadUrl_1 = require("./liveClasses/getRecordingUploadUrl");
Object.defineProperty(exports, "getRecordingUploadUrl", { enumerable: true, get: function () { return getRecordingUploadUrl_1.getRecordingUploadUrl; } });
var getRecordingPlaybackUrl_1 = require("./liveClasses/getRecordingPlaybackUrl");
Object.defineProperty(exports, "getRecordingPlaybackUrl", { enumerable: true, get: function () { return getRecordingPlaybackUrl_1.getRecordingPlaybackUrl; } });
var coHostAccounts_1 = require("./liveClasses/coHostAccounts");
Object.defineProperty(exports, "createCoHost", { enumerable: true, get: function () { return coHostAccounts_1.createCoHost; } });
Object.defineProperty(exports, "deleteCoHost", { enumerable: true, get: function () { return coHostAccounts_1.deleteCoHost; } });
Object.defineProperty(exports, "resetCoHostPassword", { enumerable: true, get: function () { return coHostAccounts_1.resetCoHostPassword; } });
/**
 * studentPortalLogin — username + password sign-in for students who cannot use Google.
 *
 * Accepts { username, password } from the client.
 * Looks up the student record in Firestore by portalUsername, validates the password,
 * then mints a custom Firebase Auth token signed with the student's Firestore doc ID as uid.
 * The client signs in with signInWithCustomToken() which triggers onAuthStateChanged.
 */
exports.studentPortalLogin = (0, https_1.onCall)({ cors: true }, async (request) => {
    const rawInput = (request.data?.username || "").trim();
    const username = rawInput.toLowerCase();
    const password = (request.data?.password || "").trim();
    console.log(`[FUNCTION_AUTH] studentPortalLogin triggered with input: '${rawInput}'`);
    if (!rawInput || !password) {
        console.warn("[FUNCTION_AUTH] Missing username or password in request");
        throw new https_1.HttpsError("invalid-argument", "Username and password are required.");
    }
    const db = admin.firestore();
    // 1. Try finding student by portalUsername
    console.log(`[FUNCTION_AUTH] 1. Searching students where portalUsername == '${username}'`);
    let snap = await db
        .collection("students")
        .where("portalUsername", "==", username)
        .limit(1)
        .get();
    // 2. If not found by portalUsername, try matching email
    if (snap.empty) {
        console.log(`[FUNCTION_AUTH] 2. Searching students where email == '${username}'`);
        snap = await db
            .collection("students")
            .where("email", "==", username)
            .limit(1)
            .get();
    }
    // 3. If not found by email, try matching studentId
    if (snap.empty) {
        console.log(`[FUNCTION_AUTH] 3. Searching students where studentId == '${rawInput}'`);
        snap = await db
            .collection("students")
            .where("studentId", "==", rawInput)
            .limit(1)
            .get();
    }
    if (snap.empty) {
        console.error(`[FUNCTION_AUTH] Student record NOT FOUND for input: '${rawInput}'`);
        throw new https_1.HttpsError("unauthenticated", "Invalid username or password.");
    }
    const studentDoc = snap.docs[0];
    const studentData = studentDoc.data();
    console.log(`[FUNCTION_AUTH] Found student record. DocId: ${studentDoc.id}, Name: '${studentData.name}', Email: '${studentData.email}', PortalUsername: '${studentData.portalUsername}', Status: '${studentData.status}'`);
    // Check status
    if (studentData.status === "inactive") {
        console.warn(`[FUNCTION_AUTH] Account is INACTIVE for student: ${studentDoc.id}`);
        throw new https_1.HttpsError("permission-denied", "Your account is inactive. Contact your admin.");
    }
    // Validate password (stored as plaintext admin-generated code)
    const storedPassword = (studentData.portalPassword || "").trim();
    if (!storedPassword || storedPassword !== password) {
        console.error(`[FUNCTION_AUTH] Password mismatch for student: ${studentDoc.id}. Provided length: ${password.length}, Stored exists: ${Boolean(storedPassword)}`);
        throw new https_1.HttpsError("unauthenticated", "Invalid username or password.");
    }
    console.log(`[FUNCTION_AUTH] Password verified! Minting custom token for docId: ${studentDoc.id}`);
    // Mint a custom token. Use the student Firestore doc ID as the Firebase Auth UID.
    // The onAuthStateChanged handler → fetchUserData will then load the full student profile.
    const customUid = `portal_${studentDoc.id}`;
    const customToken = await admin.auth().createCustomToken(customUid, {
        studentRecordId: studentDoc.id,
        role: "student",
    });
    // Always write/refresh the users/{uid} doc so fetchUserData always has
    // up-to-date role, name, email, and studentRecordId — even on repeated logins.
    const userDocRef = db.collection("users").doc(customUid);
    await userDocRef.set({
        role: "student",
        name: studentData.name || "",
        email: studentDoc.data().email || "",
        studentRecordId: studentDoc.id,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { customToken };
});
exports.submitExamAttempt = (0, https_1.onCall)({
    // Allow callable invocation from browsers (local dev + production).
    cors: true,
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Login required");
    }
    const uid = request.auth.uid;
    const testId = request.data?.testId || "";
    if (!testId) {
        throw new https_1.HttpsError("invalid-argument", "testId required");
    }
    const db = admin.firestore();
    const testRef = db.collection("examTests").doc(testId);
    const attemptRef = testRef.collection("attempts").doc(uid);
    const [testSnap, attemptSnap] = await Promise.all([testRef.get(), attemptRef.get()]);
    if (!testSnap.exists) {
        throw new https_1.HttpsError("not-found", "Exam not found");
    }
    if (!attemptSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Attempt not started");
    }
    const test = testSnap.data();
    const attempt = attemptSnap.data();
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
        throw new https_1.HttpsError("failed-precondition", "Exam is still running; cannot submit before timer ends");
    }
    const [publicQsSnap, privateQsSnap] = await Promise.all([
        testRef.collection("questionsPublic").get(),
        testRef.collection("questionsPrivate").get(),
    ]);
    const publicById = new Map();
    publicQsSnap.forEach((d) => publicById.set(d.id, d.data()));
    const privateById = new Map();
    privateQsSnap.forEach((d) => privateById.set(d.id, d.data()));
    const neg = Number(test.negativeMarkPerWrong) || 0;
    const answers = (attempt.answers || {});
    let score = 0;
    let maxScore = 0;
    for (const [qid, qpub] of publicById.entries()) {
        const marks = Number(qpub.marks) || 0;
        maxScore += marks;
        const selected = answers[qid];
        if (selected == null)
            continue;
        const key = privateById.get(qid);
        const correct = key?.correctIndex;
        if (typeof correct !== "number")
            continue;
        if (selected === correct)
            score += marks;
        else
            score -= neg;
    }
    if (score < 0)
        score = 0;
    const submittedAt = attempt.submittedAt || new Date().toISOString();
    await attemptRef.set({
        status: "submitted",
        submittedAt,
        score,
        maxScore,
        submittedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { attemptId: uid, score, maxScore, submittedAt };
});
