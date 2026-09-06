import React from "react";
import type { ReactElement } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { useAuth } from "./context/AuthContext";
import { usePublicAuth } from "./context/PublicAuthContext";
import DashboardLayout from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import AdminSignup from "./pages/AdminSignup";
import AdminDashboard from "./pages/admin/Dashboard";
import BatchManagement from "./pages/admin/BatchManagement";
import StudentManagement from "./pages/admin/StudentManagement";
import MediaManager from "./pages/admin/MediaManager";
import ExamManagement from "./pages/admin/ExamManagement";
import LiveExamMonitor from "./pages/admin/LiveExamMonitor";
import AllTestsAnalytics from "./pages/admin/AllTestsAnalytics";
import StudentTestReports from "./pages/admin/StudentTestReports";
import ExamStudioLayout from "./pages/admin/ExamStudioLayout";
import ExamResults from "./pages/admin/ExamResults";
import ExamResponseSheets from "./pages/admin/ExamResponseSheets";
import TestAttendanceAnalytics from "./pages/admin/TestAttendanceAnalytics";
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
import ResponseSheetPage from "./pages/student/ResponseSheetPage";
import GuestExamJoin from "./pages/student/GuestExamJoin";
import VideoPlayer from "./pages/student/VideoPlayer";
import PdfViewer from "./pages/student/PdfViewer";
import EnrollmentManagement from "./pages/admin/EnrollmentManagement";
import EnrollmentFormPage from "./pages/student/EnrollmentFormPage";
import EnrollmentSuccessPage from "./pages/student/EnrollmentSuccessPage";
import PublicRegistration from "./pages/public/PublicRegistration";
import PublicLogin from "./pages/public/PublicLogin";
import PublicDashboard from "./pages/public/PublicDashboard";
import PublicHallTicket from "./pages/public/PublicHallTicket";
import AdmissionFormPage from "./pages/public/AdmissionFormPage";
import AdmissionSuccessPage from "./pages/public/AdmissionSuccessPage";
import PublicRegistrationsPage from "./pages/admin/PublicRegistrationsPage";
import PortalSettingsPage from "./pages/admin/PortalSettingsPage";
import SelectBatchPage from "./pages/student/SelectBatchPage";
import LiveClassManagement from "./pages/admin/LiveClassManagement";
import LiveClassRoom from "./pages/admin/LiveClassRoom";
import LiveClassAttendance from "./pages/admin/LiveClassAttendance";
import CoHostManagement from "./pages/admin/CoHostManagement";
import LiveClasses from "./pages/student/LiveClasses";
import LiveClassJoin from "./pages/student/LiveClassJoin";
import LiveClassRecording from "./pages/student/LiveClassRecording";
import ConductLiveTest from "./pages/admin/ConductLiveTest";

function studentNeedsBatchPicker(
  user: {
    role: string;
    batchId?: string;
    batchIds?: string[];
    isGuestExamParticipant?: boolean;
  } | null,
) {
  if (!user || user.role !== "student") return false;
  if (user.isGuestExamParticipant) return false;
  const ids = user.batchIds?.length
    ? user.batchIds
    : user.batchId
      ? [user.batchId]
      : [];
  if (ids.length <= 1) return false;
  return !user.batchId || !ids.includes(user.batchId);
}

function StudentOnlyRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "student") {
    return (
      <Navigate
        to={user.adminKind === "cohost" ? "/admin/live-classes" : "/admin"}
        replace
      />
    );
  }
  if (studentNeedsBatchPicker(user)) {
    return <Navigate to="/student/select-batch" replace />;
  }

  return children;
}

function StudentBatchSelectRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "student") {
    return (
      <Navigate
        to={user.adminKind === "cohost" ? "/admin/live-classes" : "/admin"}
        replace
      />
    );
  }
  const ids = user.batchIds?.length
    ? user.batchIds
    : user.batchId
      ? [user.batchId]
      : [];
  // If they only have one batch (or already have a valid active one), go to dashboard.
  if (ids.length <= 1) return <Navigate to="/student" replace />;
  if (user.batchId && ids.includes(user.batchId)) {
    // Still allow opening the picker to switch (user navigated intentionally).
  }

  return children;
}

function GuestJoinRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === "admin") {
    return (
      <Navigate
        to={user.adminKind === "cohost" ? "/admin/live-classes" : "/admin"}
        replace
      />
    );
  }
  return children;
}

function PublicProtectedRoute({ children }: { children: ReactElement }) {
  const { publicStudent, loading } = usePublicAuth();
  if (loading) return null;
  if (!publicStudent) return <Navigate to="/public/login" replace />;
  return children;
}

function AdminOnlyRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <Navigate to="/student" replace />;

  // Co-hosts may use Live Classes and Live Tests modules.
  if (user.adminKind === "cohost") {
    const path = location.pathname;
    const allowed =
      path === "/admin/live-classes" ||
      path.startsWith("/admin/live-classes/") ||
      path === "/admin/live-tests" ||
      path.startsWith("/admin/live-tests/");
    if (!allowed) return <Navigate to="/admin/live-classes" replace />;
  }

  return children;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login role="student" />,
  },
  {
    path: "/student/join-test",
    element: (
      <GuestJoinRoute>
        <GuestExamJoin />
      </GuestJoinRoute>
    ),
  },
  {
    path: "/student/join-test/:testId",
    element: (
      <GuestJoinRoute>
        <GuestExamJoin />
      </GuestJoinRoute>
    ),
  },
  {
    path: "/enrollment-form/:token",
    element: <EnrollmentFormPage />,
  },
  {
    path: "/enrollment-success",
    element: <EnrollmentSuccessPage />,
  },
  // ── Public CBT Portal ──────────────────────────────────────────────────────
  { path: "/public/register", element: <PublicRegistration /> },
  { path: "/public/login", element: <PublicLogin /> },
  {
    path: "/public/dashboard",
    element: (
      <PublicProtectedRoute>
        <PublicDashboard />
      </PublicProtectedRoute>
    ),
  },
  {
    path: "/public/hall-ticket",
    element: (
      <PublicProtectedRoute>
        <PublicHallTicket />
      </PublicProtectedRoute>
    ),
  },
  // ── Admission Form Portal ──────────────────────────────────────────────────
  { path: "/public/admission", element: <AdmissionFormPage /> },
  { path: "/public/admission-success", element: <AdmissionSuccessPage /> },
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
      { path: "enrollments", element: <EnrollmentManagement /> },
      { path: "media", element: <MediaManager /> },
      { path: "tests", element: <ExamManagement /> },
      { path: "tests/live-monitor", element: <LiveExamMonitor /> },
      { path: "tests/analytics", element: <AllTestsAnalytics /> },
      { path: "tests/attendance", element: <TestAttendanceAnalytics /> },
      { path: "reports/student-tests", element: <StudentTestReports /> },
      { path: "public-registrations", element: <PublicRegistrationsPage /> },
      { path: "portal-settings", element: <PortalSettingsPage /> },
      { path: "co-hosts", element: <CoHostManagement /> },
      { path: "live-classes", element: <LiveClassManagement /> },
      { path: "live-tests", element: <ConductLiveTest /> },
      { path: "live-classes/:id/attendance", element: <LiveClassAttendance /> },
      { path: "live-classes/:id/recording", element: <LiveClassRecording /> },
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
          { path: "response-sheets", element: <ExamResponseSheets /> },
        ],
      },
    ],
  },
  {
    // Full-screen like the exam room — a video call benefits from the full viewport.
    path: "/admin/live-classes/:id/room",
    element: (
      <AdminOnlyRoute>
        <LiveClassRoom />
      </AdminOnlyRoute>
    ),
  },
  {
    path: "/student/select-batch",
    element: (
      <StudentBatchSelectRoute>
        <SelectBatchPage />
      </StudentBatchSelectRoute>
    ),
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
    path: "/student/tests/:id/response-sheet",
    element: (
      <StudentOnlyRoute>
        <ResponseSheetPage />
      </StudentOnlyRoute>
    ),
  },
  {
    // Full-screen — same reasoning as the exam room.
    path: "/student/live-classes/:id",
    element: (
      <StudentOnlyRoute>
        <LiveClassJoin />
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
      { path: "live-classes", element: <LiveClasses /> },
      { path: "live-classes/:id/recording", element: <LiveClassRecording /> },
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
