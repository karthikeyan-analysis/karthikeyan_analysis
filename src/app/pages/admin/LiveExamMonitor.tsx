import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useData } from "../../context/DataContext";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Progress } from "../../components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { cn } from "../../components/ui/utils";
import StudentAvatar from "../../components/StudentAvatar";
import { listExamTestsForAdmin } from "../../features/exams/examApi";
import { subscribeInProgressAttempts } from "../../features/exams/liveMonitorApi";
import type { ExamTest } from "../../features/exams/types";
import {
  buildLiveAttemptRow,
  formatClockTime,
  formatLiveDuration,
  summarizeByTest,
  type LiveAttemptRow,
} from "../../features/exams/liveMonitorUtils";
import {
  Activity,
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

type SortKey = "remaining" | "joined" | "progress" | "name";

function UrgencyDot({ urgency }: { urgency: LiveAttemptRow["urgency"] }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full shrink-0",
        urgency === "critical" && "bg-rose-500 animate-pulse",
        urgency === "warning" && "bg-amber-500",
        urgency === "ok" && "bg-emerald-500",
      )}
      title={urgency === "critical" ? "Under 1 min left" : urgency === "warning" ? "Under 5 min left" : "On track"}
    />
  );
}

function KpiCard(props: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", props.accent)}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{props.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{props.value}</p>
            {props.sub ? <p className="text-xs text-slate-500 mt-0.5">{props.sub}</p> : null}
          </div>
          <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">{props.icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiveExamMonitor() {
  const { students, batches } = useData();
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [liveSnapshots, setLiveSnapshots] = useState<{ attempt: import("../../features/exams/types").ExamAttempt; testId: string }[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("remaining");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTests(true);
      try {
        const t = await listExamTestsForAdmin();
        if (!cancelled) setTests(t);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingTests(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeInProgressAttempts(
      (items) => {
        setLiveSnapshots(items);
        setLastSync(new Date());
        setConnected(true);
        setSubError(null);
      },
      () => {
        setSubError(
          "Live feed unavailable. Deploy Firestore indexes (firebase deploy --only firestore:indexes) or check admin permissions.",
        );
        setConnected(false);
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const testsById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const batchNameById = useMemo(() => new Map(batches.map((b) => [b.id, b.name])), [batches]);

  const rows = useMemo(() => {
    return liveSnapshots.map(({ attempt, testId }) => {
      const test = testsById.get(testId);
      const batchName = batchNameById.get(test?.batchId || "") || test?.batchId || "—";
      return buildLiveAttemptRow({
        attempt,
        testId,
        test,
        batchName,
        students,
        nowMs,
      });
    });
  }, [batchNameById, liveSnapshots, nowMs, students, testsById]);

  const testSummaries = useMemo(() => summarizeByTest(rows), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (selectedTestId !== "all") list = list.filter((r) => r.testId === selectedTestId);
    if (q) {
      list = list.filter(
        (r) =>
          r.participantName.toLowerCase().includes(q) ||
          r.studentId.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.testTitle.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortKey === "remaining") return a.remainingSeconds - b.remainingSeconds;
      if (sortKey === "joined") return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      if (sortKey === "progress") return b.progressPercent - a.progressPercent;
      return a.participantName.localeCompare(b.participantName);
    });
    return sorted;
  }, [rows, search, selectedTestId, sortKey]);

  const stats = useMemo(() => {
    const expiring = rows.filter((r) => r.urgency !== "ok").length;
    const avg =
      rows.length > 0
        ? Math.round(rows.reduce((s, r) => s + r.progressPercent, 0) / rows.length)
        : 0;
    return {
      liveTests: testSummaries.length,
      liveStudents: rows.length,
      expiring,
      avgProgress: avg,
    };
  }, [rows, testSummaries.length]);

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white px-5 py-5 sm:px-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-2.5 ring-1 ring-white/20">
              <Radio className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Live exam monitor</h1>
                <Badge
                  className={cn(
                    "border-0",
                    connected ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full mr-1.5",
                      connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400",
                    )}
                  />
                  {connected ? "Live" : "Offline"}
                </Badge>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Real-time view of students currently taking CBT exams — progress, time left, and activity
                update every second.
              </p>
              {lastSync ? (
                <p className="text-xs text-slate-400 mt-2">
                  Last sync {lastSync.toLocaleTimeString()} • {filteredRows.length} candidate
                  {filteredRows.length === 1 ? "" : "s"} shown
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0" asChild>
              <Link to="/admin/tests">Test management</Link>
            </Button>
          </div>
        </div>
      </div>

      {subError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {subError}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Active exams"
          value={stats.liveTests}
          sub="Tests with candidates in progress"
          icon={<Activity className="w-5 h-5" />}
        />
        <KpiCard
          label="Live candidates"
          value={stats.liveStudents}
          sub="Currently in exam"
          icon={<Users className="w-5 h-5" />}
          accent="border-indigo-200 bg-indigo-50/30"
        />
        <KpiCard
          label="Avg. progress"
          value={`${stats.avgProgress}%`}
          sub="Answered questions"
          icon={<RefreshCw className="w-5 h-5" />}
        />
        <KpiCard
          label="Ending soon"
          value={stats.expiring}
          sub="Under 5 minutes left"
          icon={<Clock className="w-5 h-5" />}
          accent="border-amber-200 bg-amber-50/40"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
        <Card className="border-slate-200 xl:max-h-[calc(100vh-280px)] xl:overflow-hidden flex flex-col">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold">Exams in progress</CardTitle>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
            <button
              type="button"
              onClick={() => setSelectedTestId("all")}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                selectedTestId === "all"
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-100 text-slate-800",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">All exams</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "tabular-nums",
                    selectedTestId === "all" && "border-white/40 text-white",
                  )}
                >
                  {rows.length}
                </Badge>
              </div>
            </button>
            {testSummaries.length === 0 ? (
              <p className="text-sm text-slate-500 px-3 py-6 text-center">
                {loadingTests ? "Loading…" : "No live sessions right now"}
              </p>
            ) : (
              testSummaries.map((t) => (
                <button
                  key={t.testId}
                  type="button"
                  onClick={() => setSelectedTestId(t.testId)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                    selectedTestId === t.testId
                      ? "bg-indigo-600 text-white"
                      : "hover:bg-slate-100 text-slate-800",
                  )}
                >
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div
                    className={cn(
                      "text-xs mt-0.5 truncate",
                      selectedTestId === t.testId ? "text-indigo-100" : "text-slate-500",
                    )}
                  >
                    {t.batchName} • {t.subject}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        selectedTestId === t.testId && "border-white/40 text-white",
                      )}
                    >
                      {t.liveCount} live
                    </Badge>
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        selectedTestId === t.testId ? "text-indigo-100" : "text-slate-500",
                      )}
                    >
                      avg {t.avgProgress}%
                    </span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 min-w-0">
          <CardHeader className="pb-3 border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-sm font-semibold">Candidate roster</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Sort:</span>
                {(
                  [
                    ["remaining", "Time left"],
                    ["joined", "Joined"],
                    ["progress", "Progress"],
                    ["name", "Name"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={sortKey === key ? "default" : "outline"}
                    className={cn(
                      "h-7 text-xs",
                      sortKey === key && "bg-indigo-600 hover:bg-indigo-700",
                    )}
                    onClick={() => setSortKey(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search name, ID, email, or test…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredRows.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="font-medium text-slate-700">No live candidates match</p>
                <p className="text-sm mt-1">Students appear here when they start an in-app CBT exam.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Candidate</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Time left</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-center">Ans</TableHead>
                      <TableHead className="text-center">Mark</TableHead>
                      <TableHead className="text-center">Left</TableHead>
                      <TableHead>Last active</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => (
                      <TableRow key={r.key} className="hover:bg-slate-50/80">
                        <TableCell>
                          <UrgencyDot urgency={r.urgency} />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="flex items-center gap-2.5">
                            <StudentAvatar
                              name={r.participantName}
                              photoURL={r.photoURL}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="min-w-0">
                          <div className="font-medium text-slate-900">{r.participantName}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[180px]">{r.email || "—"}</div>
                          {r.isGuest ? (
                            <Badge variant="outline" className="mt-1 text-[10px] py-0">
                              Guest
                            </Badge>
                          ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono text-slate-700">{r.studentId}</TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">
                            {r.testTitle}
                          </div>
                          <div className="text-xs text-slate-500">{r.batchName}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatClockTime(r.joinedAt)}
                          <div className="text-[10px] text-slate-400 block">
                            +{formatLiveDuration(r.elapsedSeconds)}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              r.urgency === "critical" && "text-rose-700",
                              r.urgency === "warning" && "text-amber-700",
                              r.urgency === "ok" && "text-slate-900",
                            )}
                          >
                            {formatLiveDuration(r.remainingSeconds)}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <Progress value={r.progressPercent} className="h-2 flex-1" />
                            <span className="text-xs font-semibold tabular-nums w-9 text-right">
                              {r.progressPercent}%
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {r.answeredCount}/{r.totalQuestions} questions
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm font-semibold tabular-nums">
                          {r.answeredCount}
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums text-violet-700">
                          {r.markedCount}
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums text-slate-600">
                          {r.unansweredCount}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatClockTime(r.lastActiveAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/admin/tests/${r.testId}/results`} title="Open results">
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loadingTests && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting to live feed…
        </div>
      ) : null}
    </div>
  );
}
