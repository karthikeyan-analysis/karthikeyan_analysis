"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCallerAccess = resolveCallerAccess;
/**
 * Single source of truth for "who is this caller relative to this liveClass".
 * Used by realtimeProxy, getRecordingUploadUrl, and getRecordingPlaybackUrl
 * so enrollment/role logic cannot drift between entry points.
 */
async function resolveCallerAccess(db, uid, cls) {
    const [userSnap, adminSnap] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("admins").doc(uid).get(),
    ]);
    const userDoc = userSnap.data();
    const adminDoc = adminSnap.data();
    // Mirror firestore.rules isAdmin(): users.role OR admins profile.
    const isAdminCaller = userDoc?.role === "admin" || adminDoc?.role === "admin";
    if (isAdminCaller) {
        if ((cls.hostUids || []).includes(uid))
            return { kind: "host" };
        if ((cls.coHostUids || []).includes(uid))
            return { kind: "co-host" };
        return { kind: "admin" };
    }
    const studentRecordId = userDoc?.studentRecordId;
    if (!studentRecordId) {
        return { kind: "denied", reason: "This account is not registered as a student." };
    }
    const studentSnap = await db.collection("students").doc(studentRecordId).get();
    const student = studentSnap.data();
    if (!student || student.status !== "active") {
        return { kind: "denied", reason: "Your student account is not active." };
    }
    const studentBatchIds = student.batchIds?.length
        ? student.batchIds
        : student.batchId
            ? [student.batchId]
            : [];
    const classBatchIds = cls.batchIds?.length
        ? cls.batchIds
        : cls.batchId
            ? [cls.batchId]
            : [];
    const enrolled = studentBatchIds.some((b) => classBatchIds.includes(b));
    if (!enrolled) {
        return { kind: "denied", reason: "You are not enrolled in this class." };
    }
    return { kind: "student", studentRecordId };
}
