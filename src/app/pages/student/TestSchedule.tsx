import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { KeyRound, Zap, Award, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAttempt, getExamTest, listExamTestsForStudent } from "../../features/exams/examApi";
import {
  canShowExamToStudentToday,
  getExamWindowStatus,
} from "../../features/exams/examAvailability";
import { useNavigate, useSearchParams } from "react-router";
import StudentAvatar from "../../components/StudentAvatar";
import { useStudentPhoto } from "../../features/students/useStudentPhoto";
import { subscribeAllActiveLiveTestSessions } from "../../features/liveTests/liveTestApi";
import type { LiveTestSession } from "../../features/liveTests/liveTestTypes";
import type { ExamTest, ExamAttempt } from "../../features/exams/types";

export default function TestSchedule() {
  const { user } = useAuth();
  const { photoURL } = useStudentPhoto();
  const { batches } = useData();
  const navigate = useNavigate();

  const currentBatch = batches.find((b) => b.id === user?.batchId);

  const [examTests, setExamTests] = useState<ExamTest[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [attemptByExamId, setAttemptByExamId] = useState<Record<string, ExamAttempt | null>>({});
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [activeLiveSessions, setActiveLiveSessions] = useState<LiveTestSession[]>([]);

  useEffect(() => {
    const unsub = subscribeAllActiveLiveTestSessions((sessions) => {
      setActiveLiveSessions(sessions);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user?.isGuestExamParticipant && user.guestExamTestId) {
      let cancelled = false;
      const loadGuest = async () => {
        setExamLoading(true);
        try {
          const t = await getExamTest(user.guestExamTestId!);
          if (!cancelled) setExamTests(t ? [t] : []);
        } catch (e) {
          console.error(e);
        } finally {
          if (!cancelled) setExamLoading(false);
        }
      };
      void loadGuest();
      return () => {
        cancelled = true;
      };
    }

    if (!user?.batchId) return;
    let cancelled = false;
    const load = async () => {
      setExamLoading(true);
      try {
        const t = await listExamTestsForStudent({
          batchId: user.batchId!,
          studentRecordId: user.studentRecordId,
        });
        if (!cancelled) setExamTests(t);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setExamLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.batchId, user?.guestExamTestId, user?.isGuestExamParticipant, user?.studentRecordId]);

  useEffect(() => {
    if (!user?.id) return;
    if (examTests.length === 0) {
      setAttemptByExamId({});
      return;
    }
    let cancelled = false;
    const loadAttempts = async () => {
      setAttemptLoading(true);
      try {
        const pairs = await Promise.all(
          examTests.map(async (t) => {
            try {
              const a = await getAttempt(t.id, user.id!);
              return [t.id, a] as const;
            } catch {
              // No attempt yet (or not readable). Treat as not started.
              return [t.id, null] as const;
            }
          }),
        );
        if (cancelled) return;
        const next: Record<string, ExamAttempt | null> = {};
        for (const [id, a] of pairs) next[id] = a;
        setAttemptByExamId(next);
      } finally {
        if (!cancelled) setAttemptLoading(false);
      }
    };
    loadAttempts();
    return () => {
      cancelled = true;
    };
  }, [examTests, user?.id]);

  const now = Date.now();
  const studentExams = useMemo(() => {
    const todayActive = examTests
      .filter((t) => canShowExamToStudentToday(t, now))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return { todayActive };
  }, [examTests, now]);

  const visibleExamTests = useMemo(
    () => studentExams.todayActive,
    [studentExams.todayActive],
  );

  const visibleAttemptByExamId = useMemo(() => {
    return Object.fromEntries(
      visibleExamTests.map((test) => [test.id, attemptByExamId[test.id] ?? null]),
    );
  }, [attemptByExamId, visibleExamTests]);

  const isGuestOnly = user?.isGuestExamParticipant && user.guestExamTestId;

  if (!user?.batchId && !isGuestOnly) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-900">Test Schedule</h1>
        <Alert>
          <AlertTitle>Not Enrolled</AlertTitle>
          <AlertDescription>
            You are not enrolled in any batch. If you have a test passcode from your instructor, you
            can join below.
          </AlertDescription>
        </Alert>
        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                Join with passcode
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Enter your name, email, and the passcode shared by your instructor.
              </p>
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
              onClick={() => navigate("/student/join-test")}
            >
              Join test
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">START NOW</Badge>;
      case "closed":
        return <Badge className="bg-gray-100 text-gray-800">Closed</Badge>;
      case "upcoming":
        return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const TestTableSection = ({
    title,
    tests,
    icon: Icon,
    isExam = false,
  }: {
    title: string;
    tests: any[];
    icon: any;
    isExam?: boolean;
  }) => {
    if (tests.length === 0) return null;

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Test Portion</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-indigo-600">
                        {isExam ? test.title : test.testNo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isExam ? new Date(test.startAt).toLocaleDateString() : test.testDate}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isExam ? test.subject : test.portion}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isExam
                          ? `${new Date(test.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(test.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : `${test.startTime} – ${test.endTime}`}
                      </TableCell>
                      <TableCell>
                      {isExam ? (
                          visibleAttemptByExamId[test.id]?.status === "submitted" ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Submitted</Badge>
                          ) : activeLiveSessions.some((s) => s.testId === test.id) ? (
                            <Badge className="bg-emerald-600 text-white font-bold animate-pulse">
                              <Radio className="w-3 h-3 mr-1 inline" /> LIVE TEST NOW
                            </Badge>
                          ) : getExamWindowStatus(test, now) === "active" ? (
                            <Badge className="bg-green-100 text-green-800">START NOW</Badge>
                          ) : getExamWindowStatus(test, now) === "upcoming" ? (
                            <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">Closed</Badge>
                          )
                        ) : (
                          getStatusBadge(test.status)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isExam ? (
                          visibleAttemptByExamId[test.id]?.status === "submitted" ? (
                            <Button disabled variant="outline" size="sm" className="text-xs">
                              Completed
                            </Button>
                          ) : activeLiveSessions.some((s) => s.testId === test.id) ? (
                            <Button
                              onClick={() => navigate(`/student/tests/${test.id}`)}
                              className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md"
                              size="sm"
                            >
                              <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse" /> Join Live Test
                            </Button>
                          ) : getExamWindowStatus(test, now) === "closed" ? (
                            <Button disabled variant="outline" size="sm" className="text-xs">
                              Closed
                            </Button>
                          ) : getExamWindowStatus(test, now) === "upcoming" ? (
                            <Button disabled variant="outline" size="sm" className="text-xs">
                              Coming
                            </Button>
                          ) : (
                            <Button
                              onClick={() => navigate(`/student/tests/${test.id}`)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                              size="sm"
                            >
                              <Zap className="w-3 h-3 mr-1" /> Start
                            </Button>
                          )
                        ) : test.status === "active" ? (
                          <Button
                            onClick={() => window.open(test.cbtLink, "_blank")}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                            size="sm"
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            START NOW
                          </Button>
                        ) : (
                          <Button
                            disabled
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            {test.status === "closed" ? "Closed" : "Coming"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const activeLiveTestsForStudent = useMemo(() => {
    const studentBatchId = user?.batchId;

    const liveSessionItems = activeLiveSessions
      .filter((s) => {
        if (s.status !== "active") return false;
        if (!studentBatchId) return true;
        if (s.batchId === studentBatchId) return true;
        if (s.batchIds && Array.isArray(s.batchIds) && s.batchIds.includes(studentBatchId)) return true;
        return false;
      })
      .map((s) => {
        const fullTest = examTests.find((t) => t.id === s.testId || t.id === s.id);
        return {
          id: s.testId || s.id,
          testNo: s.testTitle || fullTest?.title || "Live Test",
          title: s.testTitle || fullTest?.title || "Live Test",
          portion: s.subject || fullTest?.subject || "All Topics",
          subject: s.subject || fullTest?.subject || "General",
          startAt: s.startedAt || new Date().toISOString(),
          endAt: new Date(Date.now() + (s.durationMinutes || 60) * 60000).toISOString(),
          isLiveSession: true,
          sessionId: s.id,
        };
      });

    const activeExamItems = studentExams.todayActive.filter(
      (t) =>
        getExamWindowStatus(t, now) === "active" &&
        !liveSessionItems.some((ls) => ls.id === t.id),
    );

    return [...liveSessionItems, ...activeExamItems];
  }, [activeLiveSessions, examTests, studentExams.todayActive, user?.batchId, now]);

  const [searchParams] = useSearchParams();
  const isLiveView = searchParams.get("view") === "live";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <StudentAvatar name={user.name || "Student"} photoURL={photoURL} size="lg" className="ring-2 ring-slate-100" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{user.name || "Student"}</p>
          {user.studentId ? (
            <p className="text-xs text-slate-600">ID: {user.studentId}</p>
          ) : null}
          {currentBatch ? (
            <p className="text-xs text-slate-500 truncate max-w-md">{currentBatch.name}</p>
          ) : null}
        </div>
      </div>

      {isLiveView ? (
        /* LIVE TEST HUB VIEW (Only shows active live tests triggered by host) */
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-rose-600 animate-pulse" />
              Live CBT Exam & Active Test Center
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/student/join-test")}>
                <KeyRound className="w-3 h-3 mr-1" />
                Passcode join
              </Button>
            </div>
          </div>

          <TestTableSection
            title="Active Live Tests"
            tests={activeLiveTestsForStudent}
            icon={Zap}
            isExam
          />

          {activeLiveTestsForStudent.length === 0 && !examLoading && (
            <Card className="border-rose-200/80 bg-gradient-to-b from-rose-50/30 to-slate-50/50">
              <CardContent className="pt-8 text-center pb-8">
                <Award className="w-12 h-12 mx-auto text-rose-400 mb-3 animate-pulse" />
                <p className="text-slate-900 font-bold text-base">No Live Test Currently Active</p>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  When your instructor starts a live test from the Live Control Center during class, it will appear here with an instant join prompt.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* TESTS & EXAMS ARCHIVE & SCHEDULE VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              Tests & Exams Archive & Schedule
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/student/join-test")}>
                <KeyRound className="w-3 h-3 mr-1" />
                Passcode join
              </Button>
            </div>
          </div>

          <TestTableSection title="Scheduled Exams" tests={studentExams.todayActive} icon={Zap} isExam />

          {studentExams.todayActive.length === 0 && !examLoading && (
            <Card>
              <CardContent className="pt-8 text-center pb-8">
                <Zap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-medium">No scheduled exams found</p>
                <p className="text-sm text-slate-500 mt-1">
                  Exams will appear here on their scheduled date and time.
                </p>
              </CardContent>
            </Card>
          )}

          {attemptLoading && studentExams.todayActive.length > 0 && (
            <div className="text-xs text-slate-500">Loading your attempts…</div>
          )}
        </div>
      )}
    </div>
  );
}
