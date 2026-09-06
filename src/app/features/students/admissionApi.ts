import {
  collection,
  doc,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../config/firebase";

export interface AdmissionFormData {
  name: string;
  fatherName: string;
  dob: string;
  phone: string;
  email?: string;
  nativeDistrict: string;
  gender: "Male" | "Female";
  educationalQualification: string;
  subjects: string[];
  isKarthikeyanStudent: boolean;
  karthikeyanYear?: string;
  photoUrl?: string;
  batchApplied?: string;
}

export interface AdmissionResult {
  id: string;
  portalUsername: string;
  portalPassword: string;
  studentId: string;
}

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 6): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

/**
 * Atomically allocates the next admission counter, generates a KA-XXXX
 * portal username + random password, then writes a new student doc with
 * status "inactive" so admin can review and activate.
 */
export async function registerAdmissionStudent(
  data: AdmissionFormData,
): Promise<AdmissionResult> {
  const counterRef = doc(db, "admissionMeta", "counter");
  let count = 1;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    if (snap.exists()) {
      count = (snap.data().count as number) + 1;
      tx.update(counterRef, { count });
    } else {
      count = 1;
      tx.set(counterRef, { count: 1 });
    }
  });

  const portalUsername = `KA-${String(count).padStart(4, "0")}`;
  const portalPassword = generatePassword(6);
  const studentIdField = portalUsername;

  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

  const newDoc = {
    ...cleanData,
    studentId: studentIdField,
    portalUsername,
    portalPassword,
    status: "inactive" as const,
    enrolledDate: new Date().toISOString(),
    name: data.name.trim(),
    email: data.email?.trim() || "",
  };

  const colRef = collection(db, "students");
  const docRef = doc(colRef);
  await setDoc(docRef, newDoc);

  return { id: docRef.id, portalUsername, portalPassword, studentId: studentIdField };
}
