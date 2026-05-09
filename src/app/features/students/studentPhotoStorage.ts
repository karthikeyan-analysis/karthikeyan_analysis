import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../../../config/firebase";

const profilePath = (studentRecordId: string) => `studentPhotos/${studentRecordId}/profile`;

export function studentProfileRef(studentRecordId: string) {
  return ref(storage, profilePath(studentRecordId));
}

export async function uploadStudentProfileImage(studentRecordId: string, file: File): Promise<string> {
  const r = studentProfileRef(studentRecordId);
  const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  await uploadBytes(r, file, {
    contentType,
    cacheControl: "public,max-age=3600",
  });
  return getDownloadURL(r);
}

export async function deleteStudentProfileImage(studentRecordId: string): Promise<void> {
  try {
    await deleteObject(studentProfileRef(studentRecordId));
  } catch {
    // Object may not exist
  }
}
