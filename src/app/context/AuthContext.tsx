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
  signInAnonymously,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { saveGuestProfile } from "../features/exams/examApi";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

export type UserRole = "admin" | "student";

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (
    email: string,
    password: string,
    role: UserRole,
  ): Promise<boolean> => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userData = await fetchUserData(result.user);
      if (userData && userData.role === role) {
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
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedInEmail = (result.user.email || "").toLowerCase();

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
        doc(db, "users", result.user.uid),
        {
          role: "student",
          name: studentRecord.name || result.user.displayName || "Student",
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

      const studentUser = await fetchUserData(result.user);
      setUser(studentUser);
      return { success: true };
    } catch (error: any) {
      console.error("Student Google login error:", error);
      if (error?.code === "auth/popup-closed-by-user") {
        return { success: false, error: "Google sign-in popup was closed." };
      }
      return {
        success: false,
        error: "Could not sign in with Google. Please try again.",
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
