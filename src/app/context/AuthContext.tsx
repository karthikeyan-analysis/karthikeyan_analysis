import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { saveGuestProfile } from "../features/exams/examApi";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

export type UserRole = "admin" | "student";

// ── Single-device session ─────────────────────────────────────────────────────
const STUDENT_SESSION_KEY = "ka_student_session";

function generateSessionToken(): string {
  try {
    const arr = new Uint8Array(18);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback for older browsers / non-secure contexts where Web Crypto is unavailable.
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }
}

/** Prefer redirect on devices where popups are unreliable. */
function shouldPreferGoogleRedirect(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger/i.test(ua);
  const isOldOrStrictSafari =
    /Safari/i.test(ua) && !/Chrome|CriOS|Edg|Chromium|Android/i.test(ua);
  return isMobile || isInAppBrowser || isOldOrStrictSafari;
}

const GOOGLE_LOGIN_ERROR_KEY = "ka_google_login_error";

export function consumeGoogleLoginError(): string | null {
  try {
    const msg = sessionStorage.getItem(GOOGLE_LOGIN_ERROR_KEY);
    if (msg) sessionStorage.removeItem(GOOGLE_LOGIN_ERROR_KEY);
    return msg;
  } catch {
    return null;
  }
}

function storeGoogleLoginError(message: string) {
  try {
    sessionStorage.setItem(GOOGLE_LOGIN_ERROR_KEY, message);
  } catch {
    /* ignore */
  }
}

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  let os = "Unknown OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}

async function writeStudentSession(studentRecordId: string): Promise<void> {
  const sessionToken = generateSessionToken();
  await updateDoc(doc(db, "students", studentRecordId), {
    activeSessionToken: sessionToken,
    activeDevice: getDeviceInfo(),
    activeDeviceLoginAt: new Date().toISOString(),
  });
  localStorage.setItem(
    STUDENT_SESSION_KEY,
    JSON.stringify({ studentRecordId, sessionToken }),
  );
}

/** Admin utility: clears the active device lock so the student can log in fresh. */
export async function resetStudentDevice(studentDocId: string): Promise<void> {
  await updateDoc(doc(db, "students", studentDocId), {
    activeSessionToken: deleteField(),
    activeDevice: deleteField(),
    activeDeviceLoginAt: deleteField(),
  } as any);
}
// ─────────────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentId?: string;
  batchId?: string;
  studentRecordId?: string;
  photoURL?: string;
  isGuestExamParticipant?: boolean;
  guestExamTestId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  loginStudentWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginGuestForExam: (params: {
    name: string;
    email: string;
    testId: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signupAdmin: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (
    firebaseUser: FirebaseUser,
  ): Promise<User | null> => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const role = (userData.role as UserRole) || "student";
        let name =
          (typeof userData.name === "string" && userData.name.trim()) ||
          firebaseUser.displayName ||
          "";
        let photoURL: string | undefined =
          typeof userData.photoURL === "string" && userData.photoURL.trim()
            ? userData.photoURL.trim()
            : undefined;
        let studentRecordId =
          typeof userData.studentRecordId === "string" ? userData.studentRecordId : undefined;
        let studentId =
          typeof userData.studentId === "string" ? userData.studentId : undefined;
        let batchId = typeof userData.batchId === "string" ? userData.batchId : undefined;

        if (role === "student") {
          const email = (
            firebaseUser.email ||
            (typeof userData.email === "string" ? userData.email : "")
          )
            .trim()
            .toLowerCase();

          type StudentDoc = {
            name?: string;
            photoURL?: string;
            studentId?: string;
            batchId?: string;
          };

          let studentData: StudentDoc | null = null;

          if (studentRecordId) {
            const stSnap = await getDoc(doc(db, "students", studentRecordId));
            if (stSnap.exists()) {
              studentData = stSnap.data() as StudentDoc;
            } else {
              studentRecordId = undefined;
            }
          }

          if (!studentData && email) {
            const studentQuery = query(
              collection(db, "students"),
              where("email", "==", email),
            );
            const studentSnap = await getDocs(studentQuery);
            if (!studentSnap.empty) {
              studentRecordId = studentSnap.docs[0].id;
              studentData = studentSnap.docs[0].data() as StudentDoc;
              void setDoc(
                userDocRef,
                {
                  studentRecordId,
                  studentId: studentData.studentId ?? studentId ?? null,
                  batchId: studentData.batchId ?? batchId ?? null,
                  ...(studentData.photoURL ? { photoURL: studentData.photoURL } : {}),
                  updatedAt: new Date().toISOString(),
                },
                { merge: true },
              );
            }
          }

          if (studentData) {
            if (studentData.name?.trim()) name = studentData.name.trim();
            if (typeof studentData.photoURL === "string" && studentData.photoURL.trim()) {
              photoURL = studentData.photoURL.trim();
            }
            if (studentData.studentId) studentId = studentData.studentId;
            if (studentData.batchId) batchId = studentData.batchId;
          }

          // ── Single-device enforcement (skip for anonymous/guest users) ──
          if (studentRecordId && !firebaseUser.isAnonymous) {
            const localRaw = localStorage.getItem(STUDENT_SESSION_KEY);
            if (localRaw) {
              try {
                const { studentRecordId: localId, sessionToken: localToken } = JSON.parse(localRaw) as {
                  studentRecordId: string;
                  sessionToken: string;
                };
                if (localId === studentRecordId) {
                  const firestoreToken = (studentData as any)?.activeSessionToken as string | undefined;
                  if (firestoreToken && localToken !== firestoreToken) {
                    // Another device wrote a new token — kick this session out
                    localStorage.removeItem(STUDENT_SESSION_KEY);
                    sessionStorage.setItem("ka_kicked_reason", "other_device");
                    await signOut(auth);
                    return null;
                  }
                }
              } catch { /* malformed localStorage — ignore */ }
            }
          }
          // ────────────────────────────────────────────────────────────────
        } else if (role === "admin" && typeof userData.name === "string" && userData.name.trim()) {
          name = userData.name.trim();
        }

        if (!photoURL && firebaseUser.photoURL) {
          photoURL = firebaseUser.photoURL;
        }

        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || userData.email || "",
          name,
          role,
          studentId,
          batchId,
          studentRecordId,
          photoURL,
          isGuestExamParticipant: userData.isGuestExamParticipant === true,
          guestExamTestId:
            typeof userData.guestExamTestId === "string" ? userData.guestExamTestId : undefined,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const boot = async () => {
      // Complete redirect Google login BEFORE listening to auth state,
      // so older devices that use redirect get a fully provisioned student session.
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user && !cancelled) {
          const completed = await completeStudentGoogleSignIn(redirectResult.user);
          if (!cancelled) {
            if (!completed.success) {
              storeGoogleLoginError(completed.error || "Google sign-in failed.");
              setUser(null);
            } else {
              setUser(completed.user || null);
            }
          }
        }
      } catch (error) {
        console.error("Google redirect login error:", error);
        storeGoogleLoginError("Google sign-in failed. Please try again.");
      }

      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userData = await fetchUserData(firebaseUser);
          if (!cancelled) setUser(userData);
        } else if (!cancelled) {
          setUser(null);
        }
        if (!cancelled) setLoading(false);
      });
    };

    boot();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function completeStudentGoogleSignIn(
    firebaseUser: FirebaseUser,
  ): Promise<{ success: boolean; error?: string; user?: User | null }> {
    const signedInEmail = (firebaseUser.email || "").toLowerCase();

    if (!signedInEmail) {
      await signOut(auth);
      return {
        success: false,
        error: "Google account email not found. Please try another account.",
      };
    }

    const studentQuery = query(
      collection(db, "students"),
      where("email", "==", signedInEmail),
    );
    const studentSnap = await getDocs(studentQuery);

    if (studentSnap.empty) {
      await signOut(auth);
      return {
        success: false,
        error:
          "This Google account is not registered as a student. Contact admin.",
      };
    }

    const studentRecord = studentSnap.docs[0].data() as {
      name?: string;
      email?: string;
      studentId?: string;
      batchId?: string;
      photoURL?: string;
    };
    const studentRecordId = studentSnap.docs[0].id;

    await setDoc(
      doc(db, "users", firebaseUser.uid),
      {
        role: "student",
        name: studentRecord.name || firebaseUser.displayName || "Student",
        email: signedInEmail,
        studentId: studentRecord.studentId,
        batchId: studentRecord.batchId,
        studentRecordId,
        isGuestExamParticipant: false,
        guestExamTestId: null,
        ...(studentRecord.photoURL ? { photoURL: studentRecord.photoURL } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    await writeStudentSession(studentRecordId);
    const studentUser = await fetchUserData(firebaseUser);
    return { success: true, user: studentUser };
  }

  const login = async (
    email: string,
    password: string,
    role: UserRole,
  ): Promise<boolean> => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userData = await fetchUserData(result.user);
      if (userData && userData.role === role) {
        // Register this device as the active session for students
        if (role === "student" && userData.studentRecordId) {
          await writeStudentSession(userData.studentRecordId);
        }
        setUser(userData);
        return true;
      }
      await signOut(auth);
      setUser(null);
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const loginStudentWithGoogle = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const provider = new GoogleAuthProvider();
    // Force account-picker even when the user already has a session.
    provider.setCustomParameters({ prompt: "select_account" });

    const startRedirect = async () => {
      await signInWithRedirect(auth, provider);
      // Navigation leaves this page; callers should keep a "redirecting" state.
      return { success: true as const };
    };

    try {
      if (shouldPreferGoogleRedirect()) {
        return await startRedirect();
      }

      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        // Popups fail often on older browsers, Safari, and in-app webviews.
        if (
          popupError?.code === "auth/popup-blocked" ||
          popupError?.code === "auth/cancelled-popup-request" ||
          popupError?.code === "auth/operation-not-supported-in-this-environment"
        ) {
          return await startRedirect();
        }
        if (popupError?.code === "auth/popup-closed-by-user") {
          return { success: false, error: "Sign-in was cancelled. Please try again." };
        }
        // Network / unknown popup failures: try redirect once more before giving up.
        if (
          typeof popupError?.code === "string" &&
          popupError.code.startsWith("auth/")
        ) {
          try {
            return await startRedirect();
          } catch {
            throw popupError;
          }
        }
        throw popupError;
      }

      const completed = await completeStudentGoogleSignIn(result.user);
      if (!completed.success) {
        return { success: false, error: completed.error };
      }
      setUser(completed.user || null);
      return { success: true };
    } catch (error: any) {
      console.error("Student Google login error:", error);
      return {
        success: false,
        error: error?.message || "Could not sign in with Google. Please try again.",
      };
    }
  };

  const loginGuestForExam = async (params: {
    name: string;
    email: string;
    testId: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const name = params.name.trim();
    const email = params.email.trim().toLowerCase();
    if (!name) return { success: false, error: "Please enter your name." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (!params.testId) return { success: false, error: "Test not found." };

    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;

      const guestStudentSnap = await getDocs(
        query(collection(db, "students"), where("email", "==", email)),
      );
      const guestStudent = guestStudentSnap.empty ? null : guestStudentSnap.docs[0];

      await setDoc(
        doc(db, "users", uid),
        {
          role: "student",
          name: guestStudent?.data()?.name?.trim() || name,
          email,
          isGuestExamParticipant: true,
          guestExamTestId: params.testId,
          ...(guestStudent
            ? {
                studentRecordId: guestStudent.id,
                studentId: guestStudent.data()?.studentId ?? null,
                batchId: guestStudent.data()?.batchId ?? null,
                ...(guestStudent.data()?.photoURL
                  ? { photoURL: guestStudent.data()?.photoURL }
                  : {}),
              }
            : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await saveGuestProfile({ testId: params.testId, uid, name, email });

      const guestUser = await fetchUserData(cred.user);
      setUser(guestUser);
      return { success: true };
    } catch (error: any) {
      console.error("Guest exam login error:", error);
      if (error?.code === "auth/operation-not-allowed") {
        return {
          success: false,
          error:
            "Anonymous sign-in is disabled in Firebase. Enable it under Authentication → Sign-in method → Anonymous.",
        };
      }
      return {
        success: false,
        error: "Could not start guest session. Please try again.",
      };
    }
  };

  const signupAdmin = async (
    name: string,
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(result.user, { displayName: name });

      await setDoc(doc(db, "users", result.user.uid), {
        role: "admin",
        name,
        email,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, "admins", result.user.uid), {
        uid: result.user.uid,
        name,
        email,
        role: "admin",
        createdAt: new Date().toISOString(),
      });

      const createdUser = await fetchUserData(result.user);
      setUser(createdUser);

      return { success: true };
    } catch (error: any) {
      console.error("Admin signup error:", error);
      return {
        success: false,
        error:
          error?.code === "auth/email-already-in-use"
            ? "This email is already registered. Please use another email."
            : error?.code === "auth/weak-password"
              ? "Password should be at least 6 characters long."
              : "Unable to create admin account. Please try again.",
      };
    }
  };

  const logout = async () => {
    try {
      // Clear student device session from Firestore + localStorage
      const localRaw = localStorage.getItem(STUDENT_SESSION_KEY);
      if (localRaw) {
        try {
          const { studentRecordId } = JSON.parse(localRaw) as { studentRecordId: string };
          if (studentRecordId) {
            await updateDoc(doc(db, "students", studentRecordId), {
              activeSessionToken: deleteField(),
              activeDevice: deleteField(),
              activeDeviceLoginAt: deleteField(),
            } as any);
          }
        } catch { /* ignore Firestore errors on logout */ }
        localStorage.removeItem(STUDENT_SESSION_KEY);
      }
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginStudentWithGoogle,
        loginGuestForExam,
        signupAdmin,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
