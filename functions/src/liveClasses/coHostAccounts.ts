import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

async function assertFullAdmin(uid: string) {
  const db = admin.firestore();
  const [userSnap, adminSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("admins").doc(uid).get(),
  ]);
  const user = userSnap.data() as Record<string, any> | undefined;
  const adm = adminSnap.data() as Record<string, any> | undefined;
  const isAdmin = user?.role === "admin" || adm?.role === "admin";
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Only admins can manage co-hosts.");
  }
  // Co-host accounts cannot create/delete other co-hosts.
  if (adm?.kind === "cohost" || user?.adminKind === "cohost") {
    throw new HttpsError("permission-denied", "Co-hosts cannot manage other co-host accounts.");
  }
}

function validateCredentials(name: string, email: string, password: string) {
  if (!name.trim()) throw new HttpsError("invalid-argument", "Name is required.");
  if (!email.trim() || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  if (!password || password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }
}

/**
 * Full admin creates a co-host login (email + password) without signing out.
 * Writes users/{uid} + admins/{uid} with kind:"cohost" so they can log in at
 * /admin/login and be selected as Host/Co-Host on live classes.
 */
export const createCoHost = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  await assertFullAdmin(request.auth.uid);

  const name = String(request.data?.name || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const password = String(request.data?.password || "");
  validateCredentials(name, email, password);

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already registered.");
    }
    if (err?.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password is too weak.");
    }
    throw new HttpsError("internal", err?.message || "Could not create co-host account.");
  }

  const db = admin.firestore();
  const now = new Date().toISOString();
  const profile = {
    uid: userRecord.uid,
    name,
    email,
    role: "admin",
    kind: "cohost",
    adminKind: "cohost",
    createdAt: now,
    createdBy: request.auth.uid,
    status: "active",
  };

  try {
    await Promise.all([
      db.collection("users").doc(userRecord.uid).set({
        role: "admin",
        adminKind: "cohost",
        name,
        email,
        createdAt: now,
        createdBy: request.auth.uid,
      }),
      db.collection("admins").doc(userRecord.uid).set(profile),
    ]);
  } catch (err) {
    // Roll back Auth user if Firestore write fails.
    await admin.auth().deleteUser(userRecord.uid).catch(() => {});
    throw new HttpsError("internal", "Account created in Auth but profile save failed. Please retry.");
  }

  return {
    uid: userRecord.uid,
    name,
    email,
    // Echo password once so the admin UI can show a "share credentials" card.
    // It is not stored anywhere on the server.
    password,
  };
});

/** Soft-disable + delete Auth user for a co-host account only. */
export const deleteCoHost = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  await assertFullAdmin(request.auth.uid);

  const uid = String(request.data?.uid || "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "uid required");
  if (uid === request.auth.uid) {
    throw new HttpsError("invalid-argument", "You cannot delete your own account here.");
  }

  const db = admin.firestore();
  const adminSnap = await db.collection("admins").doc(uid).get();
  if (!adminSnap.exists) throw new HttpsError("not-found", "Co-host not found.");
  const data = adminSnap.data() as Record<string, any>;
  if (data.kind !== "cohost") {
    throw new HttpsError("failed-precondition", "Only co-host accounts can be deleted from this page.");
  }

  await admin.auth().deleteUser(uid).catch((err: any) => {
    if (err?.code !== "auth/user-not-found") throw err;
  });
  await Promise.all([
    db.collection("admins").doc(uid).delete(),
    db.collection("users").doc(uid).delete(),
  ]);

  return { ok: true };
});

/** Set a new password so the admin can re-share login details. */
export const resetCoHostPassword = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  await assertFullAdmin(request.auth.uid);

  const uid = String(request.data?.uid || "").trim();
  const password = String(request.data?.password || "");
  if (!uid) throw new HttpsError("invalid-argument", "uid required");
  if (!password || password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  const db = admin.firestore();
  const adminSnap = await db.collection("admins").doc(uid).get();
  if (!adminSnap.exists) throw new HttpsError("not-found", "Co-host not found.");
  const data = adminSnap.data() as Record<string, any>;
  if (data.kind !== "cohost") {
    throw new HttpsError("failed-precondition", "Only co-host passwords can be reset here.");
  }

  await admin.auth().updateUser(uid, { password });
  await db.collection("admins").doc(uid).update({
    passwordUpdatedAt: new Date().toISOString(),
    passwordUpdatedBy: request.auth.uid,
  });

  return {
    uid,
    name: data.name || "",
    email: data.email || "",
    password,
  };
});
