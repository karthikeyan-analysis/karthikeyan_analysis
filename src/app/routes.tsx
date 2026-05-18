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
import AllTestsAnalytics from "./pages/admin/AllTestsAnalytics";
import StudentTestReports from "./pages/admin/StudentTestReports";
import ExamStudioLayout from "./pages/admin/ExamStudioLayout";
import ExamResults from "./pages/admin/ExamResults";
import ExamCreatePage from "./pages/admin/ExamCreatePage";
import ExamDashboardPage from "./pages/admin/ExamDashboardPage";
import ExamSettingsPage from "./pages/admin/ExamSettingsPage";
import ExamQuestionsPage from "./pages/admin/ExamQuestionsPage";
import ExamPublishPage from "./pages/admin/ExamPublishPage";
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
      { path: "tests/analytics", element: <AllTestsAnalytics /> },
      { path: "reports/student-tests", element: <StudentTestReports /> },
      { path: "tests/new", element: <ExamCreatePage /> },
      {
        path: "tests/:id",
        element: <ExamStudioLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <ExamDashboardPage /> },
          { path: "settings", element: <ExamSettingsPage /> },
          { path: "questions", element: <ExamQuestionsPage /> },
          { path: "publish", element: <ExamPublishPage /> },
          { path: "results", element: <ExamResults /> },
        ],
      },
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
