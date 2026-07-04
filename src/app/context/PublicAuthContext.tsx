import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  increment,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";

export interface PublicStudent {
  id: string;
  username: string;
  passcode: string;
  name: string;
  fatherName: string;
  dob: string;
  phone: string;
  nativeDistrict: string;
  gender: "Male" | "Female";
  educationalQualification: "UG" | "PG";
  subjects: string[];
  isKarthikeyanStudent: boolean;
  karthikeyanYear?: string;
  photoUrl?: string;
  activeSessionToken?: string;
  registeredAt: string;
}

interface PublicAuthContextType {
  publicStudent: PublicStudent | null;
  loading: boolean;
  login: (username: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshStudent: () => Promise<void>;
}

const SESSION_KEY = "publicCBT_session";

const PublicAuthContext = createContext<PublicAuthContextType | undefined>(undefined);

function generateSessionToken(): string {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function PublicAuthProvider({ children }: { children: ReactNode }) {
  const [publicStudent, setPublicStudent] = useState<PublicStudent | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount — restore session from localStorage and verify against Firestore
  useEffect(() => {
    const restore = async () => {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) { setLoading(false); return; }
      try {
        const { studentId, sessionToken } = JSON.parse(raw) as {
          studentId: string;
          sessionToken: string;
        };
        const snap = await getDoc(doc(db, "publicCBTStudents", studentId));
        if (!snap.exists()) { clearSession(); setLoading(false); return; }
        const data = snap.data() as PublicStudent;
        if (data.activeSessionToken !== sessionToken) {
          // Another device logged in — invalidate this session
          clearSession();
          setLoading(false);
          return;
        }
        setPublicStudent({ id: snap.id, ...data });
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setPublicStudent(null);
  };

  const login = async (
    username: string,
    passcode: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const uname = username.trim().toUpperCase();
    const pc = passcode.trim().toUpperCase();
    if (!uname || !pc) return { success: false, error: "Enter username and passcode." };

    try {
      const q = query(
        collection(db, "publicCBTStudents"),
        where("username", "==", uname),
      );
      const snap = await getDocs(q);
      if (snap.empty) return { success: false, error: "Username not found." };

      const docSnap = snap.docs[0];
      const data = docSnap.data() as PublicStudent;

      if (data.passcode !== pc) return { success: false, error: "Incorrect passcode." };

      // Generate new session token (invalidates all other devices)
      const sessionToken = generateSessionToken();
      await updateDoc(doc(db, "publicCBTStudents", docSnap.id), {
        activeSessionToken: sessionToken,
      });

      const student: PublicStudent = { id: docSnap.id, ...data, activeSessionToken: sessionToken };
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ studentId: docSnap.id, sessionToken }),
      );
      setPublicStudent(student);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Login failed. Try again." };
    }
  };

  const logout = () => {
    clearSession();
  };

  const refreshStudent = async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw || !publicStudent) return;
    try {
      const snap = await getDoc(doc(db, "publicCBTStudents", publicStudent.id));
      if (snap.exists()) {
        setPublicStudent({ id: snap.id, ...(snap.data() as PublicStudent) });
      }
    } catch {}
  };

  return (
    <PublicAuthContext.Provider value={{ publicStudent, loading, login, logout, refreshStudent }}>
      {children}
    </PublicAuthContext.Provider>
  );
}

export function usePublicAuth() {
  const ctx = useContext(PublicAuthContext);
  if (!ctx) throw new Error("usePublicAuth must be used inside PublicAuthProvider");
  return ctx;
}

// ── Utility: register a new public student ─────────────────────────────────

function generatePasscode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const b of arr) code += chars[b % chars.length];
  return code;
}

export async function registerPublicStudent(data: Omit<PublicStudent, "id" | "username" | "passcode" | "activeSessionToken" | "registeredAt">): Promise<{ username: string; passcode: string; id: string }> {
  // Atomically increment counter and get the next number
  const counterRef = doc(db, "publicCBTMeta", "counter");
  let count = 1;

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    if (counterSnap.exists()) {
      count = (counterSnap.data().count as number) + 1;
      tx.update(counterRef, { count });
    } else {
      count = 1;
      tx.set(counterRef, { count: 1 });
    }
  });

  const username = `KASC26${String(count).padStart(3, "0")}`;
  const passcode = generatePasscode();
  const sessionToken = generateSessionToken();

  const newDoc = {
    ...data,
    username,
    passcode,
    activeSessionToken: sessionToken,
    registeredAt: new Date().toISOString(),
  };

  const colRef = collection(db, "publicCBTStudents");
  const docRef = doc(colRef);
  await setDoc(docRef, newDoc);

  return { username, passcode, id: docRef.id };
}
