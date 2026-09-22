import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { TestBatchFormConfig, TestBatchFormConfigInput } from "./types";

const COLLECTION = "testBatchFormConfigs";

function testBatchFormConfigRef(batchId: string) {
  return doc(db, COLLECTION, batchId);
}

/** Returns null if the batch has never had its form customized — caller should fall back to system defaults. */
export async function getTestBatchFormConfig(
  batchId: string,
): Promise<TestBatchFormConfig | null> {
  const snap = await getDoc(testBatchFormConfigRef(batchId));
  if (!snap.exists()) return null;
  return { batchId, ...(snap.data() as any) } as TestBatchFormConfig;
}

export async function upsertTestBatchFormConfig(
  batchId: string,
  patch: TestBatchFormConfigInput,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    testBatchFormConfigRef(batchId),
    {
      batchId,
      header: patch.header,
      footer: patch.footer,
      isCustomized: true,
      updatedAt: new Date().toISOString(),
      updatedBy,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}
