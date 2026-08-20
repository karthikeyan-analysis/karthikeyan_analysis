import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { resolveStudentPhotoDisplayUrl } from "./studentPhotoUrl";

/** Resolve profile photos from auth user and/or enrolled student record (by id or email). */
export function useStudentPhoto() {
  const { user } = useAuth();
  const { students } = useData();

  return useMemo(() => {
    if (!user) {
      return {
        photoURL: undefined as string | undefined,
        displaySrc: undefined as string | undefined,
      };
    }

    let photoURL = user.photoURL?.trim() || undefined;

    if (!photoURL && user.studentRecordId) {
      photoURL =
        students.find((s) => s.id === user.studentRecordId)?.photoURL?.trim() ||
        undefined;
    }

    if (!photoURL && user.email) {
      const email = user.email.trim().toLowerCase();
      photoURL =
        students
          .find((s) => s.email?.trim().toLowerCase() === email)
          ?.photoURL?.trim() || undefined;
    }

    return {
      photoURL,
      displaySrc: resolveStudentPhotoDisplayUrl(photoURL),
    };
  }, [user, students]);
}

/** Look up a student's stored photo URL from the roster (admin / reports). */
export function resolveStudentPhotoFromRoster(
  students: { id: string; email?: string; photoURL?: string }[],
  studentRecordId?: string,
  email?: string,
): string | undefined {
  if (studentRecordId) {
    const byId = students
      .find((s) => s.id === studentRecordId)
      ?.photoURL?.trim();
    if (byId) return byId;
  }
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    return students
      .find((s) => s.email?.trim().toLowerCase() === normalizedEmail)
      ?.photoURL?.trim();
  }
  return undefined;
}
