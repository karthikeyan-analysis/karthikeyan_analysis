import type { ExamTest } from "./types";

/** All batch ids assigned to a test (supports legacy single `batchId` only). */
export function getExamBatchIds(test: Pick<ExamTest, "batchId" | "batchIds">): string[] {
  const fromArray = (test.batchIds || []).map((id) => id.trim()).filter(Boolean);
  if (fromArray.length) return [...new Set(fromArray)];
  if (test.batchId?.trim()) return [test.batchId.trim()];
  return [];
}

export function examIncludesBatch(
  test: Pick<ExamTest, "batchId" | "batchIds">,
  batchId?: string | null,
): boolean {
  if (!batchId?.trim()) return false;
  return getExamBatchIds(test).includes(batchId.trim());
}

/** Persist both `batchIds` and legacy `batchId` (first selected). */
export function normalizeExamBatchFields(batchIds: string[]): {
  batchId: string;
  batchIds: string[];
} {
  const unique = [...new Set(batchIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) {
    throw new Error("At least one batch is required.");
  }
  return { batchId: unique[0], batchIds: unique };
}

export function formatExamBatchLabel(
  test: Pick<ExamTest, "batchId" | "batchIds">,
  batches: { id: string; name: string }[],
): string {
  const ids = getExamBatchIds(test);
  if (!ids.length) return "—";
  const names = ids.map((id) => batches.find((b) => b.id === id)?.name || id);
  return names.join(", ");
}
