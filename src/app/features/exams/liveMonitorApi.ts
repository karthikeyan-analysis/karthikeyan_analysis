import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { ExamAttempt } from "./types";

export type LiveAttemptSnapshot = {
  attempt: ExamAttempt;
  testId: string;
};

/** Real-time listener for all in-progress exam attempts (collection group). */
export function subscribeInProgressAttempts(
  onData: (items: LiveAttemptSnapshot[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collectionGroup(db, "attempts"), where("status", "==", "in_progress"));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const attempt = { id: d.id, ...(d.data() as Omit<ExamAttempt, "id">) } as ExamAttempt;
        const testId = d.ref.parent.parent?.id || attempt.testId || "";
        return { attempt, testId };
      });
      onData(items);
    },
    (err) => {
      console.error("Live monitor subscription error", err);
      onError?.(err);
    },
  );
}
