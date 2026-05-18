import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import { listAllTestsWithAttemptsForAdmin } from "../../features/exams/examApi";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import {
  attemptCompositeKey,
  buildAttemptsLookup,
  isEligibleForExam,
  percentScore,
  safeFileName,
  toIsoOrEmpty,
} from "../../features/exams/adminTestReportUtils";
import { useData } from "../../context/DataContext";
import type { Student } from "../../context/DataContext";
import * as XLSX from "xlsx";

function participationCellText(a: ExamAttempt | undefined, test: ExamTest) {
  if (!a) return "";
  const maxMarks = test.totalMarks;
  if (a.status === "submitted") {
    const pct = percentScore(a, maxMarks);
    const score = a.score ?? "";
    const max = a.maxScore ?? maxMarks;
    const pctPart = pct != null ? `${pct}%` : "";
    return `Submitted${pctPart ? ` · ${pctPart}` : ""}${score !== "" ? ` · ${score}/${max}` : ""}`;
  }
  return "In progress";
}

type Row = {
  test: ExamTest;
  attempts: ExamAttempt[];
  batchName: string;
  started: number;
  submitted: number;
  inProgress: number;
  avgPercentSubmitted: number | null;
  minPercentSubmitted: number | null;
  maxPercentSubmitted: number | null;
};

export default function AllTestsAnalytics() {
  const navigate = useNavigate();
  const { students, batches } = useData();
  const [loading, setLoading] = useState(true);
  const [exportMode, setExportMode] = useState<null | "full" | "attendance">(null);
  const [pairs, setPairs] = useState<{ test: ExamTest; attempts: ExamAttempt[] }[]>([]);
  const exporting = exportMode !== null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await listAllTestsWithAttemptsForAdmin();
        if (!cancelled) setPairs(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    return pairs.map(({ test, attempts }) => {
      const batchName = batches.find((b) => b.id === test.batchId)?.name || test.batchId;
      const submittedAtt = attempts.filter((a) => a.status === "submitted");
      const inProgress = attempts.filter((a) => a.status === "in_progress").length;
      const percents = submittedAtt
        .map((a) => percentScore(a, test.totalMarks))
        .filter((p): p is number => p != null);
      const avgPercentSubmitted =
        percents.length > 0 ? Math.round((percents.reduce((s, p) => s + p, 0) / percents.length) * 10) / 10 : null;
      const minPercentSubmitted =
        percents.length > 0 ? Math.round(Math.min(...percents) * 10) / 10 : null;
      const maxPercentSubmitted =
        percents.length > 0 ? Math.round(Math.max(...percents) * 10) / 10 : null;
      return {
        test,
        attempts,
        batchName,
        started: attempts.length,
        submitted: submittedAtt.length,
        inProgress,
        avgPercentSubmitted,
        minPercentSubmitted,
        maxPercentSubmitted,
      };
    });
  }, [pairs, batches]);

  const totals = useMemo(() => {
    let started = 0;
    let submitted = 0;
    let inProgress = 0;
    for (const r of rows) {
      started += r.started;
      submitted += r.submitted;
      inProgress += r.inProgress;
    }
    return { tests: rows.length, started, submitted, inProgress };
  }, [rows]);

  const testsSorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.test.startAt).getTime() - new Date(a.test.startAt).getTime()),
    [rows],
  );

  const attemptsMap = useMemo(() => buildAttemptsLookup(pairs), [pairs]);

  const rosterSorted = useMemo(
    () => [...students].sort((a, b) => `${a.name}`.localeCompare(`${b.name}`, undefined, { sensitivity: "base" })),
    [students],
  );

  const studentLookup = (studentRecordId?: string) =>
    studentRecordId ? students.find((s) => s.id === studentRecordId) : undefined;

  /** Any started attempt counts as attended for this report (submitted or in progress). */
  function attendanceStatusForCell(student: Student, test: ExamTest): "ATTENDED" | "NA" {
    if (!isEligibleForExam(student, test)) return "NA";
    const a = attemptsMap.get(attemptCompositeKey(test.id, student.id));
    if (a && (a.status === "submitted" || a.status === "in_progress")) return "ATTENDED";
    return "NA";
  }

  const exportExcel = () => {
    setExportMode("full");
    try {
      const testSummary = rows.map((r) => ({
        examId: r.test.id,
        examTitle: r.test.title,
        subject: r.test.subject,
        batch: r.batchName,
        startAt: toIsoOrEmpty(r.test.startAt),
        endAt: toIsoOrEmpty(r.test.endAt),
        durationMinutes: r.test.durationMinutes,
        totalQuestions: r.test.totalQuestions,
        totalMarks: r.test.totalMarks,
        examStatus: (() => {
          const now = Date.now();
          const s = new Date(r.test.startAt).getTime();
          const e = new Date(r.test.endAt).getTime();
          if (now >= s && now <= e) return "active";
          if (now < s) return "upcoming";
          return "closed";
        })(),
        studentsStarted: r.started,
        studentsSubmitted: r.submitted,
        studentsInProgress: r.inProgress,
        avgPercent_amongSubmitted: r.avgPercentSubmitted ?? "",
        minPercent_amongSubmitted: r.minPercentSubmitted ?? "",
        maxPercent_amongSubmitted: r.maxPercentSubmitted ?? "",
      }));

      const allAttempts: Record<string, string | number>[] = [];
      for (const r of rows) {
        for (const a of r.attempts) {
          const st = studentLookup(a.studentRecordId);
          const pct = a.status === "submitted" ? percentScore(a, r.test.totalMarks) : null;
          allAttempts.push({
            examId: r.test.id,
            examTitle: r.test.title,
            subject: r.test.subject,
            batch: r.batchName,
            studentUid: a.uid,
            studentRecordId: a.studentRecordId || "",
            studentId: st?.studentId || "",
            studentName: st?.name || "",
            studentEmail: st?.email || "",
            attemptStatus: a.status,
            score: a.score ?? "",
            maxScore: a.maxScore ?? r.test.totalMarks,
            percent: pct ?? "",
            startedAt: toIsoOrEmpty(a.startedAt),
            submittedAt: toIsoOrEmpty(a.submittedAt),
            lastSavedAt: toIsoOrEmpty(a.lastSavedAt),
          });
        }
      }

      const rollupMap = new Map<
        string,
        {
          key: string;
          studentUid: string;
          studentRecordId: string;
          studentId: string;
          studentName: string;
          studentEmail: string;
          testsStarted: number;
          testsSubmitted: number;
          percents: number[];
        }
      >();

      for (const r of rows) {
        for (const a of r.attempts) {
          const st = studentLookup(a.studentRecordId);
          const rollupKey = a.studentRecordId || a.uid;
          let row = rollupMap.get(rollupKey);
          if (!row) {
            row = {
              key: rollupKey,
              studentUid: a.uid,
              studentRecordId: a.studentRecordId || "",
              studentId: st?.studentId || "",
              studentName: st?.name || "",
              studentEmail: st?.email || "",
              testsStarted: 0,
              testsSubmitted: 0,
              percents: [],
            };
            rollupMap.set(rollupKey, row);
          }
          row.testsStarted += 1;
          if (a.status === "submitted") {
            row.testsSubmitted += 1;
            const p = percentScore(a, r.test.totalMarks);
            if (p != null) row.percents.push(p);
          }
          if (st?.studentId && !row.studentId) row.studentId = st.studentId;
          if (st?.name && !row.studentName) row.studentName = st.name;
          if (st?.email && !row.studentEmail) row.studentEmail = st.email;
        }
      }

      const studentOverview = Array.from(rollupMap.values()).map((u) => ({
        studentUid: u.studentUid,
        studentRecordId: u.studentRecordId,
        studentId: u.studentId,
        studentName: u.studentName,
        studentEmail: u.studentEmail,
        testsStarted: u.testsStarted,
        testsSubmitted: u.testsSubmitted,
        avgPercent_acrossSubmittedTests:
          u.percents.length > 0
            ? Math.round((u.percents.reduce((s, p) => s + p, 0) / u.percents.length) * 10) / 10
            : "",
      }));

      const matrixHeaders = [
        "studentRecordId",
        "studentId",
        "studentName",
        "studentEmail",
        "studentBatch",
        ...testsSorted.map((r) => {
          const t = r.test;
          const idShort = String(t.id).slice(0, 8);
          const titleCrop = String(t.title || "").slice(0, 55);
          return `[${idShort}] ${titleCrop}`;
        }),
      ];

      const matrixAoA: (string | number)[][] = [
        matrixHeaders,
        ...rosterSorted.map((s) => {
          const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
          return [
            s.id,
            s.studentId,
            s.name,
            s.email,
            batchName,
            ...testsSorted.map((r) => {
              const a = attemptsMap.get(attemptCompositeKey(r.test.id, s.id));
              return participationCellText(a, r.test);
            }),
          ];
        }),
      ];

      const studentTestPairs = rosterSorted.flatMap((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        return testsSorted.map((r) => {
          const t = r.test;
          const elig = isEligibleForExam(s, t);
          const a = attemptsMap.get(attemptCompositeKey(t.id, s.id));
          const pct = a?.status === "submitted" ? percentScore(a, t.totalMarks) : null;
          return {
            studentRecordId: s.id,
            studentId: s.studentId,
            studentName: s.name,
            studentEmail: s.email,
            studentBatch: batchName,
            examId: t.id,
            examTitle: t.title,
            examSubject: t.subject,
            examBatch: r.batchName,
            examStartAt: toIsoOrEmpty(t.startAt),
            examEndAt: toIsoOrEmpty(t.endAt),
            eligibleForExam: elig ? "Yes" : "No",
            attempted: a ? "Yes" : "No",
            attemptStatus: a?.status ?? "",
            score: a?.score ?? "",
            maxScore: a ? (a.maxScore ?? t.totalMarks) : "",
            percent: pct ?? "",
            startedAt: a ? toIsoOrEmpty(a.startedAt) : "",
            submittedAt: a ? toIsoOrEmpty(a.submittedAt) : "",
          };
        });
      });

      const everyStudentRollup = rosterSorted.map((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        let examsEligible = 0;
        let examsAttempted = 0;
        let examsSubmitted = 0;
        for (const r of testsSorted) {
          if (!isEligibleForExam(s, r.test)) continue;
          examsEligible++;
          const a = attemptsMap.get(attemptCompositeKey(r.test.id, s.id));
          if (a) {
            examsAttempted++;
            if (a.status === "submitted") examsSubmitted++;
          }
        }
        const rate =
          examsEligible > 0 ? Math.round((examsAttempted / examsEligible) * 1000) / 10 : "";
        const submitRate =
          examsEligible > 0 ? Math.round((examsSubmitted / examsEligible) * 1000) / 10 : "";

        const fromAttempts = rollupMap.get(s.id);
        return {
          studentRecordId: s.id,
          studentId: s.studentId,
          studentName: s.name,
          studentEmail: s.email,
          studentBatch: batchName,
          studentStatus: s.status,
          examsEligible_visibilityRules: examsEligible,
          examsAttempted: examsAttempted,
          examsSubmitted: examsSubmitted,
          pctEligibleAttempted: rate,
          pctEligibleSubmitted: submitRate,
          testsStarted_anyExam: fromAttempts?.testsStarted ?? 0,
          testsSubmitted_anyExam: fromAttempts?.testsSubmitted ?? 0,
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(testSummary), "Test summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrixAoA), "Participation_matrix");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentTestPairs), "Student_x_test_pairs");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(everyStudentRollup), "Every_student_summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allAttempts), "All attempts");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentOverview), "Students overview");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `${safeFileName(`all_tests_analytics_${stamp}`)}.xlsx`);
    } finally {
      setExportMode(null);
    }
  };

  /** Printable student × test grid: ATTENDED if the student started the test (eligible roster only); NA otherwise. */
  const exportAttendanceReportExcel = () => {
    if (testsSorted.length === 0) return;
    setExportMode("attendance");
    try {
      const numCols = 1 + testsSorted.length;
      const padRow = (): string[] => Array.from({ length: numCols }, () => "");

      const orgTitle = "Karthikeyan Analysis Study Circle & Learning Resources";
      const listTitle = "LIST OF STATISTICS CLASS TEST ATTENDANCE";
      const headerRow = ["CANDIDATES NAME", ...testsSorted.map((_, i) => `TEST.${i + 1}`)];

      const aoa: string[][] = [];
      {
        const r = padRow();
        r[0] = orgTitle;
        aoa.push(r);
      }
      {
        const r = padRow();
        r[0] = listTitle;
        aoa.push(r);
      }
      aoa.push(padRow());
      aoa.push(headerRow);

      for (const s of rosterSorted) {
        aoa.push([
          String(s.name || "").trim().toUpperCase(),
          ...testsSorted.map((row) => attendanceStatusForCell(s, row.test)),
        ]);
      }

      aoa.push(padRow());
      {
        const r = padRow();
        r[0] = "*NA - Not Attended";
        aoa.push(r);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const lastColIdx = numCols - 1;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
      ];
      ws["!cols"] = [{ wch: 40 }, ...testsSorted.map(() => ({ wch: 14 }))];

      const keyAoA: (string | number)[][] = [
        ["Column", "Exam title", "Subject", "Batch", "Exam start (UTC)"],
        ...testsSorted.map((r, i) => [
          `TEST.${i + 1}`,
          r.test.title,
          r.test.subject,
          r.batchName,
          toIsoOrEmpty(r.test.startAt),
        ]),
      ];
      const wsKey = XLSX.utils.aoa_to_sheet(keyAoA);
      wsKey["!cols"] = [{ wch: 10 }, { wch: 48 }, { wch: 22 }, { wch: 22 }, { wch: 26 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Class_test_attendance");
      XLSX.utils.book_append_sheet(wb, wsKey, "TEST_column_key");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `${safeFileName(`class_test_attendance_${stamp}`)}.xlsx`);
    } finally {
      setExportMode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to tests
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">All tests — performance analytics</h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Attendance and scores across every CBT test. Use{" "}
            <span className="font-medium text-slate-800">Attendance report</span> for a student-by-test grid (ATTENDED /
            NA). The full Excel workbook includes a detailed participation matrix, student×test pairs, raw attempts, and
            summaries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            className="border-slate-300"
            onClick={exportAttendanceReportExcel}
            disabled={loading || exporting || rows.length === 0}
          >
            {exportMode === "attendance" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Attendance report
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={exportExcel}
            disabled={loading || exporting || rows.length === 0}
          >
            {exportMode === "full" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Full analytics Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tests</CardDescription>
            <CardTitle className="text-2xl">{totals.tests}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total attempts (started)</CardDescription>
            <CardTitle className="text-2xl">{totals.started}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submitted</CardDescription>
            <CardTitle className="text-2xl text-emerald-800">{totals.submitted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-2xl text-amber-800">{totals.inProgress}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-test summary</CardTitle>
          <CardDescription>
            Students started includes in-progress and submitted. Percent metrics use submitted attempts only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading analytics…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No tests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">In progress</TableHead>
                    <TableHead className="text-right">Avg %</TableHead>
                    <TableHead className="text-right">Min %</TableHead>
                    <TableHead className="text-right">Max %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.test.id}>
                      <TableCell className="font-medium text-slate-900 max-w-[200px] truncate" title={r.test.title}>
                        {r.test.title}
                      </TableCell>
                      <TableCell className="text-sm">{r.batchName}</TableCell>
                      <TableCell className="text-sm">{r.test.subject}</TableCell>
                      <TableCell className="text-right">{r.started}</TableCell>
                      <TableCell className="text-right">{r.submitted}</TableCell>
                      <TableCell className="text-right">{r.inProgress}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.avgPercentSubmitted != null ? `${r.avgPercentSubmitted}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.minPercentSubmitted != null ? `${r.minPercentSubmitted}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.maxPercentSubmitted != null ? `${r.maxPercentSubmitted}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="outline" className="text-xs font-normal max-w-full justify-center text-center h-auto py-2 leading-relaxed">
          Full workbook sheets: summary, participation matrix, student×test pairs, every-student rollup, raw attempts,
          overview. Attendance report file: printable grid + TEST_column_key (which TEST.n is which exam).
        </Badge>
      </div>
    </div>
  );
}
