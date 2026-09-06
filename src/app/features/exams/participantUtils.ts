import type { Student } from "../../context/DataContext";
import type { ExamAttempt } from "./types";

export type ResolvedParticipant = {
  name: string;
  email: string;
  studentId: string;
  studentRecordId: string;
  photoURL?: string;
  isGuest: boolean;
};

export function resolveAttemptParticipant(
  attempt: ExamAttempt,
  students: Pick<Student, "id" | "name" | "email" | "studentId" | "photoURL">[],
): ResolvedParticipant {
  if (attempt.isGuest || attempt.participantName || attempt.participantEmail) {
    const email = attempt.participantEmail?.trim() || "";
    const byEmail = email
      ? students.find((s) => s.email?.trim().toLowerCase() === email.toLowerCase())
      : undefined;
    return {
      name: attempt.participantName?.trim() || attempt.participantEmail?.trim() || "Guest",
      email,
      studentId: byEmail?.studentId || "GUEST",
      studentRecordId: attempt.studentRecordId || byEmail?.id || "",
      photoURL: byEmail?.photoURL,
      isGuest: true,
    };
  }
  const st = students.find((s) => s.id === attempt.studentRecordId);
  return {
    name: st?.name?.trim() || "",
    email: st?.email?.trim() || "",
    studentId: st?.studentId || "",
    studentRecordId: attempt.studentRecordId || "",
    photoURL: st?.photoURL,
    isGuest: false,
  };
}

export function displayNameForAttempt(
  attempt: ExamAttempt,
  students: Pick<Student, "id" | "name" | "email" | "studentId" | "photoURL">[],
): string {
  const p = resolveAttemptParticipant(attempt, students);
  return p.name || p.email || attempt.uid;
}
