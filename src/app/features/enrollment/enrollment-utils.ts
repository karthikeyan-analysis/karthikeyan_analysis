import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import type {
  EnrollmentForm,
  EnrollmentFormDTO,
  ShareableFormLink,
} from "./enrollment-types";

const ENROLLMENT_FORMS_COLLECTION = "enrollmentForms";
const SHAREABLE_LINKS_COLLECTION = "shareableFormLinks";

// ─────────────────────────────────────────────────────────────
// ENROLLMENT FORM OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new enrollment form submission
 */
export async function createEnrollmentForm(
  data: EnrollmentFormDTO,
  submittedBy: string,
  batchId: string,
): Promise<string> {
  const now = Timestamp.now();
  const form: Omit<EnrollmentForm, "id"> = {
    ...data,
    createdAt: now,
    updatedAt: now,
    status: "submitted",
    submittedBy,
    batchId,
  };

  const docRef = await addDoc(
    collection(db, ENROLLMENT_FORMS_COLLECTION),
    form,
  );
  return docRef.id;
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

/**
 * Generate a unique token for shareable links
 */
export function generateShareableToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create a shareable link for a batch enrollment form
 */
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
    formId: "", // Will be populated on form submission
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

/**
 * Get a shareable link by token
 */
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

  // Check if expired
  if (linkData.expiresAt) {
    const now = new Date();
    const expiryDate = new Date(
      (linkData.expiresAt as Timestamp).toDate?.() ||
        (linkData.expiresAt as Date),
    );
    if (now > expiryDate) {
      return null; // Link expired
    }
  }

  return {
    id: doc.id,
    ...linkData,
  };
}

/**
 * Increment click count on shareable link
 */
export async function recordShareableLinkClick(linkId: string): Promise<void> {
  const docRef = doc(db, SHAREABLE_LINKS_COLLECTION, linkId);
  await updateDoc(docRef, {
    clickCount: (await getDoc(docRef)).data()?.clickCount || 0 + 1,
    lastClickedAt: Timestamp.now(),
  });
}

/**
 * Get all shareable links for a batch
 */
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

/**
 * Revoke a shareable link
 */
export async function revokeShareableLink(linkId: string): Promise<void> {
  await updateDoc(doc(db, SHAREABLE_LINKS_COLLECTION, linkId), {
    status: "revoked",
  });
}

/**
 * Build a shareable form URL
 */
export function buildShareableFormUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/enrollment-form/${token}`;
}

/**
 * Generate absolute URL for a shareable link
 */
export function generateShareableUrl(token: string): string {
  return buildShareableFormUrl(token);
}
