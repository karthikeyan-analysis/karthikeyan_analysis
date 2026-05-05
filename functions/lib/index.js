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
exports.submitExamAttempt = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
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
