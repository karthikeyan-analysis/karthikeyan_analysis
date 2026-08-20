import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../config/firebase";

export type AdminKind = "full" | "cohost";

export interface AdminProfile {
  uid: string;
  name: string;
  email: string;
  kind: AdminKind;
  status?: string;
  createdAt?: string;
}

function mapAdminDoc(id: string, data: Record<string, any>): AdminProfile {
  const kind: AdminKind = data.kind === "cohost" || data.adminKind === "cohost" ? "cohost" : "full";
  return {
    uid: id,
    name: data.name || data.email || id,
    email: data.email || "",
    kind,
    status: data.status,
    createdAt: data.createdAt,
  };
}

function sortAdmins(rows: AdminProfile[]): AdminProfile[] {
  return [...rows].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "full" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** All portal admins + co-hosts — used by the live-class host/co-host picker. */
export async function listAdmins(): Promise<AdminProfile[]> {
  const snap = await getDocs(collection(db, "admins"));
  return sortAdmins(
    snap.docs.map((d) => mapAdminDoc(d.id, d.data() as any)).filter((a) => a.status !== "inactive"),
  );
}

export function subscribeToAdmins(onChange: (rows: AdminProfile[]) => void): () => void {
  return onSnapshot(collection(db, "admins"), (snap) => {
    onChange(
      sortAdmins(
        snap.docs.map((d) => mapAdminDoc(d.id, d.data() as any)).filter((a) => a.status !== "inactive"),
      ),
    );
  });
}

/** Co-host accounts only (for the Co-Host Management page). */
export function subscribeToCoHosts(onChange: (rows: AdminProfile[]) => void): () => void {
  return subscribeToAdmins((rows) => onChange(rows.filter((r) => r.kind === "cohost")));
}

export async function createCoHostAccount(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ uid: string; name: string; email: string; password: string }> {
  const call = httpsCallable<
    { name: string; email: string; password: string },
    { uid: string; name: string; email: string; password: string }
  >(functions, "createCoHost");
  const { data } = await call(params);
  return data;
}

export async function deleteCoHostAccount(uid: string): Promise<void> {
  const call = httpsCallable<{ uid: string }, { ok: boolean }>(functions, "deleteCoHost");
  await call({ uid });
}

export async function resetCoHostAccountPassword(
  uid: string,
  password: string,
): Promise<{ uid: string; name: string; email: string; password: string }> {
  const call = httpsCallable<
    { uid: string; password: string },
    { uid: string; name: string; email: string; password: string }
  >(functions, "resetCoHostPassword");
  const { data } = await call({ uid, password });
  return data;
}
