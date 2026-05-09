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
  User as FirebaseUser,
} from "firebase/auth";
import { auth, db } from "../../config/firebase";
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
  batchId?: string; // Batch enrollment for students
  studentRecordId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  loginStudentWithGoogle: () => Promise<{ success: boolean; error?: string }>;
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

  // Fetch user role and data from Firestore
  const fetchUserData = async (
    firebaseUser: FirebaseUser,
  ): Promise<User | null> => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "",
          role: userData.role || "student",
          studentId: userData.studentId,
          batchId: userData.batchId,
          studentRecordId: userData.studentRecordId,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  };

  // Monitor auth state changes
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

      // Fetch user data to verify role
      const userData = await fetchUserData(result.user);
      if (userData && userData.role === role) {
        setUser(userData);
        return true;
      }

      // Prevent cross-role logins (e.g. admin via student login).
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

      // Allow student access only for emails pre-registered by admin.
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
