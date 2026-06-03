/**
 * Ranking Utilities for Test Management System
 * Implements Dense Ranking and Attendance Tracking
 */

import type { ExamAttempt } from "./types";

export interface RankedAttempt {
  attempt: ExamAttempt;
  rank: number | null;
}

export interface AttendanceSegment {
  attended: ExamAttempt[];
  notAttended: ExamAttempt[];
}

/**
 * Calculates dense ranking for attempts
 * Dense Ranking: If multiple students have the same score, they get the same rank
 * Example: Scores [100, 100, 90, 80] → Ranks [1, 1, 2, 3]
 */
export function assignDenseRanks(
  sortedAttempts: ExamAttempt[],
): RankedAttempt[] {
  let currentRank = 0;
  let lastScore: number | undefined = undefined;

  return sortedAttempts.map((attempt) => {
    if (attempt.status === "submitted") {
      // Check if score changed from previous attempt
      if (lastScore !== attempt.score) {
        currentRank++;
        lastScore = attempt.score;
      }
      return {
        attempt,
        rank: currentRank,
      };
    }

    return {
      attempt,
      rank: null,
    };
  });
}

/**
 * Segments attempts into attended and not attended
 */
export function segmentByAttendance(
  attempts: ExamAttempt[],
): AttendanceSegment {
  return {
    attended: attempts.filter((a) => a.status === "submitted"),
    notAttended: attempts.filter((a) => a.status !== "submitted"),
  };
}

/**
 * Calculates attendance statistics
 */
export function calculateAttendanceStats(
  enrolledCount: number,
  attempts: ExamAttempt[],
) {
  const submitted = attempts.filter((a) => a.status === "submitted").length;
  const inProgress = attempts.filter((a) => a.status === "in_progress").length;
  const notAttempted = enrolledCount - attempts.length;

  return {
    totalEnrolled: enrolledCount,
    attended: submitted,
    inProgress,
    notAttempted,
    attendancePercentage:
      enrolledCount > 0 ? Math.round((submitted / enrolledCount) * 100) : 0,
    submissionPercentage:
      enrolledCount > 0
        ? Math.round(((submitted + inProgress) / enrolledCount) * 100)
        : 0,
  };
}

/**
 * Calculates performance statistics for submitted attempts
 */
export function calculatePerformanceStats(
  attempts: ExamAttempt[],
  maxMarks: number,
) {
  const submitted = attempts.filter((a) => a.status === "submitted");

  if (submitted.length === 0) {
    return {
      averageScore: null,
      averagePercentage: null,
      highestScore: null,
      lowestScore: null,
      medianScore: null,
    };
  }

  const scores = submitted.map((a) => a.score ?? 0).sort((a, b) => a - b);

  const sum = scores.reduce((acc, score) => acc + score, 0);
  const average = sum / scores.length;
  const medianScore =
    scores.length % 2 === 0
      ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
      : scores[Math.floor(scores.length / 2)];

  return {
    averageScore: Math.round(average * 100) / 100,
    averagePercentage: Math.round((average / maxMarks) * 100 * 10) / 10,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    medianScore: Math.round(medianScore * 100) / 100,
  };
}
