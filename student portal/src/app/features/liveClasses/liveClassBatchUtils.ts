import type { LiveClass } from "./types";

/** All batch ids assigned to a live class (supports legacy single `batchId` only). */
export function getLiveClassBatchIds(cls: Pick<LiveClass, "batchId" | "batchIds">): string[] {
  const fromArray = (cls.batchIds || []).map((id) => id.trim()).filter(Boolean);
  if (fromArray.length) return [...new Set(fromArray)];
  if (cls.batchId?.trim()) return [cls.batchId.trim()];
  return [];
}

export function liveClassIncludesBatch(
  cls: Pick<LiveClass, "batchId" | "batchIds">,
  batchId?: string | null,
): boolean {
  if (!batchId?.trim()) return false;
  return getLiveClassBatchIds(cls).includes(batchId.trim());
}

/** Persist both `batchIds` and legacy `batchId` (first selected). */
export function normalizeLiveClassBatchFields(batchIds: string[]): {
  batchId: string;
  batchIds: string[];
} {
  const unique = [...new Set(batchIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) {
    throw new Error("At least one batch is required.");
  }
  return { batchId: unique[0], batchIds: unique };
}

export function formatLiveClassBatchLabel(
  cls: Pick<LiveClass, "batchId" | "batchIds">,
  batches: { id: string; name: string }[],
): string {
  const ids = getLiveClassBatchIds(cls);
  if (!ids.length) return "—";
  const names = ids.map((id) => batches.find((b) => b.id === id)?.name || id);
  return names.join(", ");
}
