import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import type { ReactElement } from "react";
import { useAuth } from "./context/AuthContext";
import DashboardLayout from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import AdminSignup from "./pages/AdminSignup";
import AdminDashboard from "./pages/admin/Dashboard";
import BatchManagement from "./pages/admin/BatchManagement";
import StudentManagement from "./pages/admin/StudentManagement";
import MediaManager from "./pages/admin/MediaManager";
import ExamManagement from "./pages/admin/ExamManagement";
import ExamEditor from "./pages/admin/ExamEditor";
import ExamResults from "./pages/admin/ExamResults";
import StudentDashboard from "./pages/student/Dashboard";
import MediaLibrary from "./pages/student/MediaLibrary";
import TestSchedule from "./pages/student/TestSchedule";
import TakeExam from "./pages/student/TakeExam";
import ExamResult from "./pages/student/ExamResult";
import VideoPlayer from "./pages/student/VideoPlayer";
import PdfViewer from "./pages/student/PdfViewer";

function StudentOnlyRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "student") return <Navigate to="/admin" replace />;

  return children;
}

function AdminOnlyRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <Navigate to="/student" replace />;

  return children;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login role="student" />,
  },
  {
    path: "/admin/login",
    element: <Login role="admin" />,
  },
  {
    path: "/admin/signup",
    element: <AdminSignup />,
  },
  {
    path: "/admin",
    element: (
      <AdminOnlyRoute>
        <DashboardLayout />
      </AdminOnlyRoute>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "batches", element: <BatchManagement /> },
      { path: "students", element: <StudentManagement /> },
      { path: "media", element: <MediaManager /> },
      { path: "tests", element: <ExamManagement /> },
      { path: "tests/:id", element: <ExamEditor /> },
      { path: "tests/:id/results", element: <ExamResults /> },
    ],
  },
  {
    // Exam pages are full-screen (no sidebar/header) for proctoring-style UX.
    path: "/student/tests/:id",
    element: (
      <StudentOnlyRoute>
        <TakeExam />
      </StudentOnlyRoute>
    ),
  },
  {
    path: "/student/tests/:id/result",
    element: (
      <StudentOnlyRoute>
        <ExamResult />
      </StudentOnlyRoute>
    ),
  },
  {
    path: "/student",
    element: (
      <StudentOnlyRoute>
        <DashboardLayout />
      </StudentOnlyRoute>
    ),
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: "media", element: <MediaLibrary /> },
      { path: "pdf/:id", element: <PdfViewer /> },
      { path: "video/:id", element: <VideoPlayer /> },
      { path: "tests", element: <TestSchedule /> },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);
