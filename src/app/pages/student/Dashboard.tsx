import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { BookOpen, Video, FileText, Layers3, CalendarClock, Loader2 } from "lucide-react";
import StudentAvatar from "../../components/StudentAvatar";
import { examIncludesBatch } from "../../features/exams/examBatchUtils";
import { useStudentPhoto } from "../../features/students/useStudentPhoto";
import { useNavigate } from "react-router";
import { listExamTestsForStudent } from "../../features/exams/examApi";
import { canShowExamToStudentToday } from "../../features/exams/examAvailability";
import type { ExamTest } from "../../features/exams/types";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StudentDashboard() {
  const { content, videos, tests, batches } = useData();
  const { user, setActiveBatch } = useAuth();
  const { photoURL } = useStudentPhoto();
  const navigate = useNavigate();
  const [examTests, setExamTests] = useState<ExamTest[]>([]);
  const [switchingBatch, setSwitchingBatch] = useState(false);

  const enrolledBatchIds = useMemo(() => {
    if (!user) return [];
    return user.batchIds?.length ? user.batchIds : user.batchId ? [user.batchId] : [];
  }, [user]);

  const enrolledBatchOptions = useMemo(() => {
    return enrolledBatchIds.map((id) => ({
      id,
      name: batches.find((b) => b.id === id)?.name || "Unknown batch",
    }));
  }, [batches, enrolledBatchIds]);

  const handleBatchSwitch = async (batchId: string) => {
    if (!batchId || batchId === user?.batchId) return;
    setSwitchingBatch(true);
    try {
      await setActiveBatch(batchId);
    } catch (e) {
      console.error(e);
    } finally {
      setSwitchingBatch(false);
    }
  };

  const canAccessItem = (item: {
    visibilityType: "ALL" | "SELECTIVE" | "BATCH";
    batchId?: string;
    selectedStudents?: string[];
  }) => {
    if (!user) return false;
    if (item.visibilityType === "ALL") return true;
    if (item.visibilityType === "BATCH") return !!user.batchId && item.batchId === user.batchId;
    return (
      item.selectedStudents?.includes(user.studentRecordId || "") ||
      item.selectedStudents?.includes(user.id) ||
      false
    );
  };

  const availableContent = content.filter((item) => canAccessItem(item));
  const availableVideos = videos.filter((video) => canAccessItem(video));

  const currentBatch = useMemo(() => {
    if (!user?.batchId) return undefined;
    return batches.find((b) => b.id === user.batchId);
  }, [batches, user?.batchId]);

  const availableSubjects = useMemo(() => {
    const raw = currentBatch?.subjects || [];
    return raw.map((s) => s.trim()).filter(Boolean);
  }, [currentBatch?.subjects]);

  const subjectStats = useMemo(() => {
    const toKey = (v?: string) => (v || "").trim() || "Uncategorized";
    const stats = new Map<string, { resources: number; videos: number }>();

    for (const item of availableContent) {
      const k = toKey(item.subject);
      stats.set(k, { resources: (stats.get(k)?.resources || 0) + 1, videos: stats.get(k)?.videos || 0 });
    }
    for (const v of availableVideos) {
      const k = toKey(v.subject);
      stats.set(k, { resources: stats.get(k)?.resources || 0, videos: (stats.get(k)?.videos || 0) + 1 });
    }

    return stats;
  }, [availableContent, availableVideos]);

  useEffect(() => {
    if (!user?.batchId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const t = await listExamTestsForStudent({
          batchId: user.batchId,
          studentRecordId: user.studentRecordId,
        });
        if (!cancelled) setExamTests(t);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.batchId, user?.studentRecordId]);

  const todaysExamTests = useMemo(() => {
    const now = Date.now();
    return examTests
      .filter((t) => canShowExamToStudentToday(t, now))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [examTests]);

  const todaysExamCount = todaysExamTests.length;

  const upcomingItems = useMemo(() => {
    const today = localDateKey();
    const cbt = todaysExamTests
      .map((t) => ({
        id: `cbt-${t.id}`,
        type: "CBT" as const,
        title: t.title,
        subject: t.subject,
        when: new Date(t.startAt).getTime(),
        meta: `${new Date(t.startAt).toLocaleString()} – ${new Date(t.endAt).toLocaleString()}`,
      }))
      .filter((x) => Number.isFinite(x.when));

    const internal = tests
      .filter(
        (t) =>
          user?.batchId &&
          examIncludesBatch(t, user.batchId) &&
          t.status === "active" &&
          t.testDate === today,
      )
      .map((t) => {
        const ts = new Date(`${t.testDate}T${t.startTime || "00:00"}`).getTime();
        return {
          id: `test-${t.id}`,
          type: "TEST" as const,
          title: `Test ${t.testNo}`,
          subject: t.portion,
          when: Number.isFinite(ts) ? ts : new Date(t.testDate).getTime(),
          meta: `${t.testDate} • ${t.startTime} - ${t.endTime}`,
        };
      })
      .filter((x) => Number.isFinite(x.when));

    return [...cbt, ...internal].sort((a, b) => a.when - b.when).slice(0, 4);
  }, [tests, todaysExamTests, user?.batchId]);

  return (
    <div className="space-y-6">
      {/* Course header */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <StudentAvatar
              name={user?.name || "Student"}
              photoURL={photoURL}
              size="lg"
              className="shrink-0 ring-2 ring-slate-100"
            />
            <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Joined Course</p>
            <p className="text-xl font-semibold text-slate-900 mt-1">
              {currentBatch?.name || "Not assigned"}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {currentBatch?.description?.trim() || "Course details will appear here."}
            </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            {enrolledBatchOptions.length > 1 ? (
              <div className="w-full sm:w-56 space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Active batch</p>
                <Select
                  value={user?.batchId || ""}
                  onValueChange={(value) => void handleBatchSwitch(value)}
                  disabled={switchingBatch}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrolledBatchOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {switchingBatch ? (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Switching…
                  </p>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-indigo-700 hover:underline text-left"
                    onClick={() => navigate("/student/select-batch")}
                  >
                    Open batch picker
                  </button>
                )}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                {availableSubjects.length} subjects
              </Badge>
              <Badge variant="outline" className="bg-white">
                {todaysExamCount} test today
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Available Resources
            </CardTitle>
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{availableContent.length}</div>
            <p className="text-xs text-slate-500 mt-1">Course materials</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Video Courses
            </CardTitle>
            <Video className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{availableVideos.length}</div>
            <p className="text-xs text-slate-500 mt-1">Video lessons</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Today's CBT Exams
            </CardTitle>
            <FileText className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {todaysExamCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <button
                className="text-indigo-700 hover:underline"
                onClick={() => navigate("/student/tests")}
              >
                Open Today's Tests
              </button>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subjects */}
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="w-5 h-5 text-indigo-600" />
              Available Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableSubjects.length === 0 ? (
              <p className="text-sm text-slate-600">
                {currentBatch
                  ? "No subjects added for your course yet."
                  : "You are not assigned to any course/batch yet."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableSubjects.map((subject) => {
                  const s = subjectStats.get(subject);
                  const resourceCount = s?.resources || 0;
                  const videoCount = s?.videos || 0;
                  return (
                    <Button
                      key={subject}
                      variant="outline"
                      className="h-auto py-4 px-4 justify-between"
                      onClick={() => navigate("/student/media")}
                      title="Open Media Library"
                    >
                      <div className="text-left">
                        <div className="text-base font-semibold text-slate-900">
                          {subject}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          {resourceCount} resources • {videoCount} videos
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">Open</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming tests */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-emerald-600" />
              Today's Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingItems.length === 0 ? (
              <p className="text-sm text-slate-600">No active tests scheduled for today.</p>
            ) : (
              upcomingItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 truncate">
                      {item.title}
                    </p>
                    <Badge variant="outline" className="bg-white shrink-0">
                      {item.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                    {item.subject}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{item.meta}</p>
                </div>
              ))
            )}

            <Button
              variant="ghost"
              className="w-full justify-center text-indigo-700"
              onClick={() => navigate("/student/tests")}
            >
              View test schedule
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
