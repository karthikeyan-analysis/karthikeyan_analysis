import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { db, storage } from "../../config/firebase";
import { deleteStudentProfileImage } from "../features/students/studentPhotoStorage";

export interface Batch {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  subjects?: string[];
  createdDate: string;
  studentCount: number;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  enrolledDate: string;
  status: "active" | "inactive";
  batchId?: string; // Batch enrollment
  /** Public download URL for profile image (Firebase Storage). */
  photoURL?: string;
}

export type VisibilityType = "ALL" | "SELECTIVE" | "BATCH";

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: "pdf" | "doc" | "note";
  uploadDate: string;
  visibilityType: VisibilityType;
  selectedStudents?: string[]; // student IDs
  batchId?: string; // Batch-specific content
  subject?: string;
  fileUrl?: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  uploadDate: string;
  visibilityType: VisibilityType;
  selectedStudents?: string[]; // student IDs
  batchId?: string; // Batch-specific video
  subject?: string;
  videoUrl?: string;
}

export interface Test {
  id: string;
  testNo: number;
  testDate: string;
  portion: string;
  startTime: string;
  endTime: string;
  cbtLink: string;
  status: "closed" | "active" | "upcoming";
  batchId: string;
  createdDate: string;
}

interface DataContextType {
  batches: Batch[];
  addBatch: (
    batch: Omit<Batch, "id" | "createdDate" | "studentCount">,
  ) => Promise<void>;
  updateBatch: (id: string, batch: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;

  students: Student[];
  addStudent: (student: Omit<Student, "id">) => Promise<string>;
  updateStudent: (id: string, student: Partial<Student>) => Promise<void>;
  clearStudentPhoto: (id: string) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  getStudentsByBatch: (batchId: string) => Student[];

  content: ContentItem[];
  addContent: (item: Omit<ContentItem, "id" | "uploadDate">) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  getContentByBatch: (batchId: string) => ContentItem[];

  videos: Video[];
  addVideo: (video: Omit<Video, "id" | "uploadDate">) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;
  getVideosByBatch: (batchId: string) => Video[];

  tests: Test[];
  addTest: (test: Omit<Test, "id" | "createdDate">) => Promise<void>;
  updateTest: (id: string, test: Partial<Test>) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  getTestsByBatch: (batchId: string) => Test[];

  loading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep `Batch.studentCount` consistent with actual enrolled students.
  // Firestore can have stale counts (e.g. after bulk imports), so we derive it
  // for UI/visibility pickers and dashboards.
  const batchesWithDerivedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      if (!s.batchId) continue;
      counts.set(s.batchId, (counts.get(s.batchId) || 0) + 1);
    }
    return batches.map((b) => ({
      ...b,
      studentCount: counts.get(b.id) || 0,
    }));
  }, [batches, students]);

  // Load all data from Firestore on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadBatches(),
          loadStudents(),
          loadContent(),
          loadVideos(),
          loadTests(),
        ]);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const loadBatches = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Batch[];
      setBatches(batchesData);
    } catch (error) {
      console.error("Error loading batches:", error);
    }
  };

  const loadStudents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "students"));
      const studentsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[];
      setStudents(studentsData);
    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  const loadContent = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "content"));
      const contentData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ContentItem[];
      setContent(contentData);
    } catch (error) {
      console.error("Error loading content:", error);
    }
  };

  const loadVideos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "videos"));
      const videosData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Video[];
      setVideos(videosData);
    } catch (error) {
      console.error("Error loading videos:", error);
    }
  };

  const loadTests = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "tests"));
      const testsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Test[];
      setTests(testsData);
    } catch (error) {
      console.error("Error loading tests:", error);
    }
  };

  // Batch operations
  const addBatch = async (
    batch: Omit<Batch, "id" | "createdDate" | "studentCount">,
  ) => {
    try {
      const newBatch = {
        ...batch,
        createdDate: new Date().toISOString().split("T")[0],
        studentCount: 0,
      };
      const docRef = await addDoc(collection(db, "batches"), newBatch);
      setBatches([
        ...batches,
        {
          ...newBatch,
          id: docRef.id,
        },
      ]);
    } catch (error) {
      console.error("Error adding batch:", error);
      throw error;
    }
  };

  const updateBatch = async (id: string, updates: Partial<Batch>) => {
    try {
      await updateDoc(doc(db, "batches", id), updates);
      setBatches(batches.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    } catch (error) {
      console.error("Error updating batch:", error);
      throw error;
    }
  };

  const deleteBatch = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "batches", id));

      // Remove batch association from students
      const affectedStudents = students.filter((s) => s.batchId === id);
      affectedStudents.forEach((student) => {
        batch.update(doc(db, "students", student.id), { batchId: null });
      });

      await batch.commit();

      setBatches(batches.filter((b) => b.id !== id));
      setStudents(
        students.map((s) =>
          s.batchId === id ? { ...s, batchId: undefined } : s,
        ),
      );
    } catch (error) {
      console.error("Error deleting batch:", error);
      throw error;
    }
  };

  // Student operations
  const addStudent = async (student: Omit<Student, "id">) => {
    try {
      const newStudent = {
        ...student,
        email: student.email.toLowerCase(),
        enrolledDate:
          student.enrolledDate || new Date().toISOString().split("T")[0],
      };
      const docRef = await addDoc(collection(db, "students"), newStudent);
      const studentWithId = { ...newStudent, id: docRef.id };
      setStudents((prev) => [...prev, studentWithId]);

      // Update batch student count
      if (newStudent.batchId) {
        const batch = batches.find((b) => b.id === newStudent.batchId);
        if (batch) {
          await updateBatch(newStudent.batchId, {
            studentCount: batch.studentCount + 1,
          });
        }
      }
      return docRef.id;
    } catch (error) {
      console.error("Error adding student:", error);
      throw error;
    }
  };

  const clearStudentPhoto = async (id: string) => {
    try {
      await deleteStudentProfileImage(id);
      await updateDoc(doc(db, "students", id), { photoURL: deleteField() } as any);
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, photoURL: undefined } : s)),
      );
    } catch (error) {
      console.error("Error clearing student photo:", error);
      throw error;
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      const oldStudent = students.find((s) => s.id === id);
      const normalizedUpdates = {
        ...updates,
        ...(updates.email ? { email: updates.email.toLowerCase() } : {}),
      };
      await updateDoc(doc(db, "students", id), normalizedUpdates);
      setStudents(
        students.map((s) => (s.id === id ? { ...s, ...normalizedUpdates } : s)),
      );

      // Update batch student counts if batch changed
      if (oldStudent && oldStudent.batchId !== normalizedUpdates.batchId) {
        if (oldStudent.batchId) {
          const oldBatch = batches.find((b) => b.id === oldStudent.batchId);
          if (oldBatch) {
            await updateBatch(oldStudent.batchId, {
              studentCount: Math.max(0, oldBatch.studentCount - 1),
            });
          }
        }
        if (normalizedUpdates.batchId) {
          const newBatch = batches.find(
            (b) => b.id === normalizedUpdates.batchId,
          );
          if (newBatch) {
            await updateBatch(normalizedUpdates.batchId, {
              studentCount: newBatch.studentCount + 1,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error updating student:", error);
      throw error;
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      const student = students.find((s) => s.id === id);
      await deleteStudentProfileImage(id);
      await deleteDoc(doc(db, "students", id));
      setStudents(students.filter((s) => s.id !== id));

      // Update batch student count
      if (student?.batchId) {
        const batch = batches.find((b) => b.id === student.batchId);
        if (batch) {
          await updateBatch(student.batchId, {
            studentCount: Math.max(0, batch.studentCount - 1),
          });
        }
      }
    } catch (error) {
      console.error("Error deleting student:", error);
      throw error;
    }
  };

  const getStudentsByBatch = (batchId: string): Student[] => {
    return students.filter((s) => s.batchId === batchId);
  };

  // Content operations
  const addContent = async (item: Omit<ContentItem, "id" | "uploadDate">) => {
    try {
      const newItem = {
        ...item,
        uploadDate: new Date().toISOString().split("T")[0],
      };
      const docRef = await addDoc(collection(db, "content"), newItem);
      setContent([...content, { ...newItem, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding content:", error);
      throw error;
    }
  };

  const deleteContent = async (id: string) => {
    try {
      const existingItem = content.find((c) => c.id === id);
      if (existingItem?.fileUrl) {
        try {
          await deleteObject(storageRef(storage, existingItem.fileUrl));
        } catch (storageError) {
          console.warn(
            "Could not delete content file from storage:",
            storageError,
          );
        }
      }

      await deleteDoc(doc(db, "content", id));
      setContent(content.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting content:", error);
      throw error;
    }
  };

  const getContentByBatch = (batchId: string): ContentItem[] => {
    return content.filter(
      (c) =>
        c.visibilityType === "ALL" ||
        (c.visibilityType === "BATCH" && c.batchId === batchId),
    );
  };

  // Video operations
  const addVideo = async (video: Omit<Video, "id" | "uploadDate">) => {
    try {
      const newVideo = {
        ...video,
        uploadDate: new Date().toISOString().split("T")[0],
      };
      const docRef = await addDoc(collection(db, "videos"), newVideo);
      setVideos([...videos, { ...newVideo, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding video:", error);
      throw error;
    }
  };

  const deleteVideo = async (id: string) => {
    try {
      const existingVideo = videos.find((v) => v.id === id);
      if (existingVideo?.videoUrl) {
        try {
          await deleteObject(storageRef(storage, existingVideo.videoUrl));
        } catch (storageError) {
          console.warn("Could not delete video from storage:", storageError);
        }
      }

      await deleteDoc(doc(db, "videos", id));
      setVideos(videos.filter((v) => v.id !== id));
    } catch (error) {
      console.error("Error deleting video:", error);
      throw error;
    }
  };

  const getVideosByBatch = (batchId: string): Video[] => {
    return videos.filter(
      (v) =>
        v.visibilityType === "ALL" ||
        (v.visibilityType === "BATCH" && v.batchId === batchId),
    );
  };

  // Test operations
  const addTest = async (test: Omit<Test, "id" | "createdDate">) => {
    try {
      const newTest = {
        ...test,
        createdDate: new Date().toISOString().split("T")[0],
      };
      const docRef = await addDoc(collection(db, "tests"), newTest);
      setTests([...tests, { ...newTest, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding test:", error);
      throw error;
    }
  };

  const updateTest = async (id: string, updates: Partial<Test>) => {
    try {
      await updateDoc(doc(db, "tests", id), updates);
      setTests(tests.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    } catch (error) {
      console.error("Error updating test:", error);
      throw error;
    }
  };

  const deleteTest = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tests", id));
      setTests(tests.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Error deleting test:", error);
      throw error;
    }
  };

  const getTestsByBatch = (batchId: string): Test[] => {
    return tests
      .filter((t) => t.batchId === batchId)
      .sort((a, b) => a.testNo - b.testNo);
  };

  return (
    <DataContext.Provider
      value={{
        batches: batchesWithDerivedCounts,
        addBatch,
        updateBatch,
        deleteBatch,
        students,
        addStudent,
        updateStudent,
        clearStudentPhoto,
        deleteStudent,
        getStudentsByBatch,
        content,
        addContent,
        deleteContent,
        getContentByBatch,
        videos,
        addVideo,
        deleteVideo,
        getVideosByBatch,
        tests,
        addTest,
        updateTest,
        deleteTest,
        getTestsByBatch,
        loading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
