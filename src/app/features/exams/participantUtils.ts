import type { Student } from "../../context/DataContext";
import type { ExamAttempt } from "./types";

export type ResolvedParticipant = {
  name: string;
  email: string;
  studentId: string;
  studentRecordId: string;
  isGuest: boolean;
};

export function resolveAttemptParticipant(
  attempt: ExamAttempt,
  students: Pick<Student, "id" | "name" | "email" | "studentId">[],
): ResolvedParticipant {
  if (attempt.isGuest || attempt.participantName || attempt.participantEmail) {
    return {
      name: attempt.participantName?.trim() || attempt.participantEmail?.trim() || "Guest",
      email: attempt.participantEmail?.trim() || "",
      studentId: "GUEST",
      studentRecordId: attempt.studentRecordId || "",
      isGuest: true,
    };
  }
  const st = students.find((s) => s.id === attempt.studentRecordId);
  return {
    name: st?.name?.trim() || "",
    email: st?.email?.trim() || "",
    studentId: st?.studentId || "",
    studentRecordId: attempt.studentRecordId || "",
    isGuest: false,
  };
}

export function displayNameForAttempt(
  attempt: ExamAttempt,
  students: Pick<Student, "id" | "name" | "email" | "studentId">[],
): string {
  const p = resolveAttemptParticipant(attempt, students);
  return p.name || p.email || attempt.uid;
}
