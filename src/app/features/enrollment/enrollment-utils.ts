import {
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import type {
  BatchEnrollmentConfig,
  EnrollmentForm,
  EnrollmentFormDTO,
  ShareableFormLink,
} from "./enrollment-types";

const ENROLLMENT_FORMS_COLLECTION = "enrollmentForms";
const SHAREABLE_LINKS_COLLECTION = "shareableFormLinks";
const BATCH_ENROLLMENT_CONFIGS_COLLECTION = "batchEnrollmentConfigs";

// ─────────────────────────────────────────────────────────────
// BATCH ENROLLMENT CONFIGURATION (Admin / Editable Box)
// ─────────────────────────────────────────────────────────────

export async function getBatchEnrollmentConfig(
  batchId: string,
): Promise<BatchEnrollmentConfig | null> {
  try {
    const docRef = doc(db, BATCH_ENROLLMENT_CONFIGS_COLLECTION, batchId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return {
        batchId: snap.id,
        ...snap.data(),
      } as BatchEnrollmentConfig;
    }
  } catch (err) {
    console.error("Failed to get batch enrollment config:", err);
  }
  return null;
}

export async function saveBatchEnrollmentConfig(
  config: BatchEnrollmentConfig,
): Promise<void> {
  const docRef = doc(db, BATCH_ENROLLMENT_CONFIGS_COLLECTION, config.batchId);
  await setDoc(
    docRef,
    {
      courseName: config.courseName || "",
      startingDate: config.startingDate || "",
      duration: config.duration || "",
      note: config.note || "",
      isOpen: config.isOpen ?? true,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

// ─────────────────────────────────────────────────────────────
// CREDENTIAL GENERATION UTILITIES
// ─────────────────────────────────────────────────────────────

export function generatePortalCredentials(
  candidateName: string,
  initials: string,
): { username: string; password: string; studentId: string } {
  const year = new Date().getFullYear();
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const randomAlpha = Math.random().toString(36).substring(2, 6).toUpperCase();

  // Clean first letters of name
  const cleanName = candidateName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const prefix = cleanName || "KA";

  // Username: KA-2026-XXXX or prefix-year-XXXX
  const username = `KA-${year}-${random4}`.toLowerCase();

  // Password: Clean, readable, secure passcode e.g. Pass@9281
  const password = `Pass@${random4}`;

  // Student ID: STU-2026-XXXX
  const studentId = `STU-${year}-${random4}`;

  return { username, password, studentId };
}

// ─────────────────────────────────────────────────────────────
// ENROLLMENT FORM OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Submit a new batch enrollment (student side)
 * Automatically generates login credentials and sets approvalStatus to "pending".
 */
export async function submitBatchEnrollment(data: EnrollmentFormDTO): Promise<{
  formId: string;
  username: string;
  password: string;
  studentId: string;
}> {
  const now = Timestamp.now();
  const { username, password, studentId } = generatePortalCredentials(
    data.personalDetails.candidateName || data.personalDetails.studentName,
    data.personalDetails.initials || "",
  );

  const candidateEmail = (data.personalDetails.email || "")
    .trim()
    .toLowerCase();
  const fullName =
    `${(data.personalDetails.candidateName || "").trim()} ${(data.personalDetails.initials || "").trim()}`.trim() ||
    data.personalDetails.studentName;

  const formPayload: Omit<EnrollmentForm, "id"> = {
    batchId: data.batchId,
    batchName: data.batchName || "",
    courseName: data.courseName || "",
    status: "submitted",
    approvalStatus: "pending",
    submittedBy: candidateEmail,
    portalUsername: username,
    portalPassword: password,
    studentId,
    personalDetails: {
      ...data.personalDetails,
      studentName: fullName,
      email: candidateEmail,
    },
    addressDetails: {
      ...data.addressDetails,
      streetNagar:
        data.addressDetails.streetName || data.addressDetails.streetNagar || "",
    },
    educationalDetails: data.educationalDetails,
    demographicDetails: data.demographicDetails,
    otherDetails: data.demographicDetails, // backward compat
    batchDetails: data.batchDetails || {
      batchName: data.batchName || "",
      courseName: data.courseName || "",
    },
    termsAndConditions: data.termsAndConditions,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(db, ENROLLMENT_FORMS_COLLECTION),
    formPayload,
  );

  return {
    formId: docRef.id,
    username,
    password,
    studentId,
  };
}

/**
 * Approve a student's enrollment form.
 * Creates / activates their official student record in the "students" collection,
 * sets approvalStatus = "approved", status = "active", links the batch,
 * and updates batch student count.
 */
export async function approveStudentEnrollment(
  formId: string,
  adminEmail: string = "admin",
): Promise<void> {
  const form = await getEnrollmentFormById(formId);
  if (!form) throw new Error("Enrollment application not found.");

  const email = (form.personalDetails?.email || form.submittedBy || "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("Applicant email is missing.");

  const studentName =
    form.personalDetails?.studentName ||
    `${form.personalDetails?.candidateName || ""} ${form.personalDetails?.initials || ""}`.trim() ||
    "Student";

  const studentId = form.studentId || form.portalUsername;
  const username = form.portalUsername;
  const password = form.portalPassword;
  const targetBatchId = form.batchId;

  // 1. Check if a student doc already exists with this email
  const studentQuery = query(
    collection(db, "students"),
    where("email", "==", email),
  );
  const snap = await getDocs(studentQuery);

  let studentDocId = "";
  if (!snap.empty) {
    // Existing student: add batch and activate
    const existingDoc = snap.docs[0];
    studentDocId = existingDoc.id;
    const existingData = existingDoc.data();
    const currentBatchIds: string[] = Array.isArray(existingData.batchIds)
      ? existingData.batchIds
      : existingData.batchId
        ? [existingData.batchId]
        : [];
    const mergedBatchIds = Array.from(
      new Set([...currentBatchIds, targetBatchId].filter(Boolean)),
    );

    await updateDoc(doc(db, "students", studentDocId), {
      status: "active",
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: adminEmail,
      batchId: targetBatchId,
      batchIds: mergedBatchIds,
      portalUsername: existingData.portalUsername || username,
      portalPassword: existingData.portalPassword || password,
      photoURL: form.personalDetails?.photoURL || existingData.photoURL || "",
      updatedAt: new Date().toISOString(),
    });
  } else {
    // New student: create in "students" collection
    const newStudentData = {
      name: studentName,
      email,
      studentId,
      portalUsername: username,
      portalPassword: password,
      status: "active",
      approvalStatus: "approved",
      batchId: targetBatchId,
      batchIds: [targetBatchId],
      enrolledDate: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: adminEmail,
      photoURL: form.personalDetails?.photoURL || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newDocRef = await addDoc(collection(db, "students"), newStudentData);
    studentDocId = newDocRef.id;
  }

  // 2. Mark enrollment form as approved
  await updateDoc(doc(db, ENROLLMENT_FORMS_COLLECTION, formId), {
    status: "approved",
    approvalStatus: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: adminEmail,
    updatedAt: Timestamp.now(),
  });

  // 3. Increment batch studentCount
  try {
    const batchRef = doc(db, "batches", targetBatchId);
    const batchSnap = await getDoc(batchRef);
    if (batchSnap.exists()) {
      const currentCount = batchSnap.data().studentCount || 0;
      await updateDoc(batchRef, {
        studentCount: currentCount + 1,
      });
    }
  } catch (err) {
    console.warn("Could not update batch student count:", err);
  }
}

/**
 * Reject an enrollment form
 */
export async function rejectStudentEnrollment(
  formId: string,
  reason: string = "Application rejected by admin",
): Promise<void> {
  await updateDoc(doc(db, ENROLLMENT_FORMS_COLLECTION, formId), {
    status: "rejected",
    approvalStatus: "rejected",
    rejectionReason: reason,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Create a new enrollment form submission (Legacy)
 */
export async function createEnrollmentForm(
  data: EnrollmentFormDTO,
  submittedBy: string,
  batchId: string,
): Promise<string> {
  const res = await submitBatchEnrollment({ ...data, batchId });
  return res.formId;
}

/**
 * Update an existing enrollment form
 */
export async function updateEnrollmentForm(
  formId: string,
  updates: Partial<EnrollmentFormDTO>,
): Promise<void> {
  const docRef = doc(db, ENROLLMENT_FORMS_COLLECTION, formId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get all enrollment forms for a batch
 */
export async function getEnrollmentFormsByBatch(
  batchId: string,
): Promise<EnrollmentForm[]> {
  const q = query(
    collection(db, ENROLLMENT_FORMS_COLLECTION),
    where("batchId", "==", batchId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as EnrollmentForm,
  );
}

/**
 * Get a single enrollment form by ID
 */
export async function getEnrollmentFormById(
  formId: string,
): Promise<EnrollmentForm | null> {
  const docRef = doc(db, ENROLLMENT_FORMS_COLLECTION, formId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as EnrollmentForm;
}

/**
 * Delete an enrollment form
 */
export async function deleteEnrollmentForm(formId: string): Promise<void> {
  await deleteDoc(doc(db, ENROLLMENT_FORMS_COLLECTION, formId));
}

/**
 * Get all enrollment forms (admin only)
 */
export async function getAllEnrollmentForms(): Promise<EnrollmentForm[]> {
  const snapshot = await getDocs(collection(db, ENROLLMENT_FORMS_COLLECTION));
  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as EnrollmentForm,
  );
}

// ─────────────────────────────────────────────────────────────
// SHAREABLE LINK OPERATIONS
// ─────────────────────────────────────────────────────────────

export function generateShareableToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createShareableLink(
  batchId: string,
  expirationDays?: number,
): Promise<ShareableFormLink> {
  const token = generateShareableToken();
  const now = Timestamp.now();
  let expiresAt: Timestamp | undefined;

  if (expirationDays) {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + expirationDays);
    expiresAt = Timestamp.fromDate(expireDate);
  }

  const linkData: Omit<ShareableFormLink, "id"> = {
    formId: "",
    batchId,
    token,
    createdAt: now,
    expiresAt,
    clickCount: 0,
    status: "active",
  };

  const docRef = await addDoc(
    collection(db, SHAREABLE_LINKS_COLLECTION),
    linkData,
  );

  return {
    id: docRef.id,
    ...linkData,
  };
}

export async function getShareableLinkByToken(
  token: string,
): Promise<ShareableFormLink | null> {
  const q = query(
    collection(db, SHAREABLE_LINKS_COLLECTION),
    where("token", "==", token),
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const linkData = doc.data() as Omit<ShareableFormLink, "id">;

  if (linkData.expiresAt) {
    const now = new Date();
    const expiryDate = new Date(
      (linkData.expiresAt as Timestamp).toDate?.() ||
        (linkData.expiresAt as Date),
    );
    if (now > expiryDate) {
      return null;
    }
  }

  return {
    id: doc.id,
    ...linkData,
  };
}

export async function recordShareableLinkClick(linkId: string): Promise<void> {
  const docRef = doc(db, SHAREABLE_LINKS_COLLECTION, linkId);
  const currentDoc = await getDoc(docRef);
  const currentClickCount = currentDoc.data()?.clickCount || 0;
  await updateDoc(docRef, {
    clickCount: currentClickCount + 1,
    lastClickedAt: Timestamp.now(),
  });
}

export async function getShareableLinksByBatch(
  batchId: string,
): Promise<ShareableFormLink[]> {
  const q = query(
    collection(db, SHAREABLE_LINKS_COLLECTION),
    where("batchId", "==", batchId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as ShareableFormLink,
  );
}

export async function revokeShareableLink(linkId: string): Promise<void> {
  await updateDoc(doc(db, SHAREABLE_LINKS_COLLECTION, linkId), {
    status: "revoked",
  });
}

export async function getBatchById(batchId: string): Promise<{
  id: string;
  name: string;
  description?: string;
  schedule?: string;
} | null> {
  const docRef = doc(db, "batches", batchId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name || "",
    description: data.description || "",
    schedule: data.schedule || "",
  };
}

export function buildShareableFormUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/enrollment-form/${token}`;
}

export function generateShareableUrl(token: string): string {
  return buildShareableFormUrl(token);
}

/**
 * Direct public enrollment URL for a batch
 */
export function getDirectBatchEnrollmentUrl(batchId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/enroll/${batchId}`;
}
