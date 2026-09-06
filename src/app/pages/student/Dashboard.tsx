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
import {
  BookOpen,
  Video,
  FileText,
  Layers3,
  CalendarClock,
  Loader2,
  Radio,
  PlayCircle,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import StudentAvatar from "../../components/StudentAvatar";
import { examIncludesBatch } from "../../features/exams/examBatchUtils";
import { useStudentPhoto } from "../../features/students/useStudentPhoto";
import { useNavigate } from "react-router";
import { listExamTestsForStudent } from "../../features/exams/examApi";
import { canShowExamToStudentToday } from "../../features/exams/examAvailability";
import type { ExamTest } from "../../features/exams/types";
import { subscribeToLiveClassesForStudentBatch } from "../../features/liveClasses/liveClassApi";
import type { LiveClass } from "../../features/liveClasses/types";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function greetingForHour(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function StudentDashboard() {
  const { content, videos, tests, batches } = useData();
  const { user, setActiveBatch } = useAuth();
  const { photoURL } = useStudentPhoto();
  const navigate = useNavigate();
  const [examTests, setExamTests] = useState<ExamTest[]>([]);
  const [switchingBatch, setSwitchingBatch] = useState(false);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);

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

  useEffect(() => {
    if (!user?.batchId) {
      setLiveClasses([]);
      return;
    }
    return subscribeToLiveClassesForStudentBatch(user.batchId, setLiveClasses);
  }, [user?.batchId]);

  const liveNowClasses = useMemo(
    () => liveClasses.filter((c) => c.status === "active"),
    [liveClasses],
  );
  const readyRecordings = useMemo(
    () =>
      liveClasses
        .filter((c) => c.status === "ended" && c.recordingStatus === "ready")
        .sort((a, b) => (b.endedAt || b.createdAt || "").localeCompare(a.endedAt || a.createdAt || ""))
        .slice(0, 4),
    [liveClasses],
  );

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

  const firstName = (user?.name || "Student").split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Welcome hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-10 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <StudentAvatar
              name={user?.name || "Student"}
              photoURL={photoURL}
              size="lg"
              className="shrink-0 ring-2 ring-white/20"
            />
            <div className="min-w-0">
              <p className="text-sm text-slate-300">
                {greetingForHour()}, {firstName}
              </p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {currentBatch?.name || "Your learning hub"}
              </h1>
              <p className="mt-1.5 line-clamp-2 text-sm text-slate-300">
                {currentBatch?.description?.trim() ||
                  "Access materials, join live classes, and take today\u2019s tests."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                  {availableSubjects.length} subjects
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                  {todaysExamCount} test{todaysExamCount === 1 ? "" : "s"} today
                </span>
                {liveNowClasses.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200 ring-1 ring-emerald-400/30">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                    {liveNowClasses.length} live now
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {enrolledBatchOptions.length > 1 ? (
            <div className="w-full shrink-0 space-y-1.5 sm:w-56">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Active batch</p>
              <Select
                value={user?.batchId || ""}
                onValueChange={(value) => void handleBatchSwitch(value)}
                disabled={switchingBatch}
              >
                <SelectTrigger className="border-white/15 bg-white/10 text-white">
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
                <p className="flex items-center gap-1 text-xs text-slate-300">
                  <Loader2 className="h-3 w-3 animate-spin" /> Switching…
                </p>
              ) : (
                <button
                  type="button"
                  className="text-xs text-indigo-200 hover:text-white hover:underline"
                  onClick={() => navigate("/student/select-batch")}
                >
                  Open batch picker
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {[
          {
            label: "Resources",
            value: availableContent.length,
            hint: "Course materials",
            icon: BookOpen,
            tone: "text-indigo-700 bg-indigo-50",
            onClick: () => navigate("/student/media"),
          },
          {
            label: "Videos",
            value: availableVideos.length,
            hint: "Video lessons",
            icon: Video,
            tone: "text-violet-700 bg-violet-50",
            onClick: () => navigate("/student/media"),
          },
          {
            label: "Today\u2019s tests",
            value: todaysExamCount,
            hint: "Open schedule",
            icon: FileText,
            tone: "text-emerald-700 bg-emerald-50",
            onClick: () => navigate("/student/tests"),
          },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-none transition hover:border-indigo-200 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{stat.hint}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${stat.tone}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Live classes */}
      {(liveNowClasses.length > 0 || readyRecordings.length > 0) && (
        <Card className="border-slate-200/80 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Radio className="h-4 w-4 text-indigo-600" />
                Live Classes
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">Join live sessions or watch recordings.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-indigo-700"
              onClick={() => navigate("/student/live-classes")}
            >
              View all
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {liveNowClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Live now</Badge>
                    <p className="font-medium text-slate-900">{cls.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{cls.subject}</p>
                </div>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => navigate(`/student/live-classes/${cls.id}`)}
                >
                  Join class
                </Button>
              </div>
            ))}
            {readyRecordings.map((cls) => (
              <div
                key={cls.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{cls.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{cls.subject} · Recording ready</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/student/live-classes/${cls.id}/recording`)}
                >
                  <PlayCircle className="mr-1 h-4 w-4" />
                  Watch
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Subjects */}
        <Card className="border-slate-200/80 shadow-none lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers3 className="h-4 w-4 text-indigo-600" />
              Subjects
            </CardTitle>
            <p className="text-sm text-slate-500">Open the media library by subject.</p>
          </CardHeader>
          <CardContent>
            {availableSubjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="text-sm text-slate-500">
                  {currentBatch
                    ? "No subjects added for your course yet."
                    : "You are not assigned to any course/batch yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {availableSubjects.map((subject) => {
                  const s = subjectStats.get(subject);
                  const resourceCount = s?.resources || 0;
                  const videoCount = s?.videos || 0;
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => navigate("/student/media")}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{subject}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {resourceCount} resources · {videoCount} videos
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's tests */}
        <Card className="border-slate-200/80 shadow-none lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="h-4 w-4 text-emerald-600" />
              Today&apos;s tests
            </CardTitle>
            <p className="text-sm text-slate-500">What&apos;s scheduled for you today.</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcomingItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No active tests scheduled for today.</p>
              </div>
            ) : (
              upcomingItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{item.title}</p>
                    <Badge variant="outline" className="shrink-0 bg-white">
                      {item.type}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-600">{item.subject}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.meta}</p>
                </div>
              ))
            )}

            <Button
              variant="ghost"
              className="w-full justify-center text-indigo-700"
              onClick={() => navigate("/student/tests")}
            >
              View full schedule
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
