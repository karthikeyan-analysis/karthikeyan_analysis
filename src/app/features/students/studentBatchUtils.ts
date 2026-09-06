/**
 * Helpers for students enrolled in one or more batches.
 * - `batchIds`: all enrollments
 * - `batchId`: active / primary (legacy-compatible)
 */

export type StudentBatchFields = {
  batchId?: string | null;
  batchIds?: string[] | null;
};

export function normalizeStudentBatchIds(
  input: StudentBatchFields | null | undefined,
): string[] {
  const fromArray = (input?.batchIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (fromArray.length) return [...new Set(fromArray)];
  const legacy = String(input?.batchId || "").trim();
  return legacy ? [legacy] : [];
}

/** Persist both `batchIds` and legacy `batchId` (first / preferred active). */
export function studentBatchWriteFields(
  batchIds: string[],
  preferredActive?: string | null,
): { batchId: string | null; batchIds: string[] } {
  const unique = [...new Set(batchIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unique.length) return { batchId: null, batchIds: [] };
  const preferred = String(preferredActive || "").trim();
  const active = preferred && unique.includes(preferred) ? preferred : unique[0];
  return { batchId: active, batchIds: unique };
}

export function studentBelongsToBatch(
  student: StudentBatchFields | null | undefined,
  batchId?: string | null,
): boolean {
  const id = String(batchId || "").trim();
  if (!id) return false;
  return normalizeStudentBatchIds(student).includes(id);
}

export function studentHasNoBatch(student: StudentBatchFields | null | undefined): boolean {
  return normalizeStudentBatchIds(student).length === 0;
}

export function mergeBatchEnrollment(
  existing: StudentBatchFields | null | undefined,
  addBatchId: string,
): { batchId: string; batchIds: string[]; alreadyInBatch: boolean } {
  const current = normalizeStudentBatchIds(existing);
  const nextId = String(addBatchId || "").trim();
  if (!nextId) {
    const fields = studentBatchWriteFields(current);
    return {
      batchId: fields.batchId || "",
      batchIds: fields.batchIds,
      alreadyInBatch: false,
    };
  }
  const alreadyInBatch = current.includes(nextId);
  const merged = alreadyInBatch ? current : [...current, nextId];
  const fields = studentBatchWriteFields(merged, existing?.batchId);
  return {
    batchId: fields.batchId || nextId,
    batchIds: fields.batchIds,
    alreadyInBatch,
  };
}

export function activeBatchStorageKey(studentRecordId: string) {
  return `ka_active_batch_${studentRecordId}`;
}

export function readStoredActiveBatch(studentRecordId: string): string | null {
  try {
    const raw = localStorage.getItem(activeBatchStorageKey(studentRecordId));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function writeStoredActiveBatch(studentRecordId: string, batchId: string) {
  try {
    localStorage.setItem(activeBatchStorageKey(studentRecordId), batchId);
  } catch {
    /* ignore */
  }
}

export function clearStoredActiveBatch(studentRecordId: string) {
  try {
    localStorage.removeItem(activeBatchStorageKey(studentRecordId));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve which batch should be active after login.
 * - Prefer saved local preference if still enrolled
 * - Else if exactly one batch, use it
 * - Else leave unset (caller shows picker)
 */
export function resolveActiveBatchId(params: {
  batchIds: string[];
  studentRecordId: string;
  preferredFromUserDoc?: string | null;
}): string | undefined {
  const { batchIds, studentRecordId, preferredFromUserDoc } = params;
  if (!batchIds.length) return undefined;
  if (batchIds.length === 1) return batchIds[0];

  const stored = readStoredActiveBatch(studentRecordId);
  if (stored && batchIds.includes(stored)) return stored;

  const fromUser = String(preferredFromUserDoc || "").trim();
  if (fromUser && batchIds.includes(fromUser)) return fromUser;

  return undefined;
}
