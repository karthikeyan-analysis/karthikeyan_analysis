import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ArrowLeft, Download, Loader2, Users } from "lucide-react";
import { formatExamBatchLabel } from "../../features/exams/examBatchUtils";
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

type TestRow = {
  test: ExamTest;
  attempts: ExamAttempt[];
  batchName: string;
};

function testColumnHeader(r: TestRow) {
  const t = r.test;
  const idShort = String(t.id).slice(0, 8);
  const titleCrop = String(t.title || "").slice(0, 40);
  return `[${idShort}] ${titleCrop}`;
}

function presentAbsentLabel(student: Student, test: ExamTest, attemptsMap: Map<string, ExamAttempt>): string {
  if (!isEligibleForExam(student, test)) return "N/A";
  const a = attemptsMap.get(attemptCompositeKey(test.id, student.id));
  if (!a) return "Absent";
  return "Present";
}

function scoreCellDisplay(
  student: Student,
  test: ExamTest,
  attemptsMap: Map<string, ExamAttempt>,
): string {
  if (!isEligibleForExam(student, test)) return "N/A";
  const a = attemptsMap.get(attemptCompositeKey(test.id, student.id));
  if (!a) return "";
  const maxMarks = test.totalMarks;
  if (a.status === "in_progress") return "In progress";
  const pct = percentScore(a, maxMarks);
  const score = a.score ?? "";
  const max = a.maxScore ?? maxMarks;
  const pctPart = pct != null ? `${pct}%` : "";
  if (score !== "" && pctPart) return `${score}/${max} (${pctPart})`;
  if (score !== "") return `${score}/${max}`;
  return "Submitted";
}

export default function StudentTestReports() {
  const navigate = useNavigate();
  const { students, batches } = useData();
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<{ test: ExamTest; attempts: ExamAttempt[] }[]>([]);
  const [exporting, setExporting] = useState(false);
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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

  const testRows: TestRow[] = useMemo(() => {
    return pairs.map(({ test, attempts }) => ({
      test,
      attempts,
      batchName: formatExamBatchLabel(test, batches),
    }));
  }, [pairs, batches]);

  const testsSorted = useMemo(
    () => [...testRows].sort((a, b) => new Date(b.test.startAt).getTime() - new Date(a.test.startAt).getTime()),
    [testRows],
  );

  const attemptsMap = useMemo(() => buildAttemptsLookup(pairs), [pairs]);

  const visibleStudents = useMemo(() => {
    let list = [...students];
    if (batchFilter !== "all") {
      list = list.filter((s) => s.batchId === batchFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          `${s.name}`.toLowerCase().includes(q) ||
          `${s.email}`.toLowerCase().includes(q) ||
          `${s.studentId}`.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => `${a.name}`.localeCompare(`${b.name}`, undefined, { sensitivity: "base" }));
  }, [students, batchFilter, search]);

  const selectedStudents = useMemo(() => {
    return students
      .filter((s) => selected[s.id])
      .sort((a, b) => `${a.name}`.localeCompare(`${b.name}`, undefined, { sensitivity: "base" }));
  }, [students, selected]);

  const selectedCount = selectedStudents.length;

  const allVisibleSelected =
    visibleStudents.length > 0 && visibleStudents.every((s) => selected[s.id]);
  const someVisibleSelected = visibleStudents.some((s) => selected[s.id]);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const s of visibleStudents) next[s.id] = true;
      return next;
    });
  }, [visibleStudents]);

  const clearVisible = useCallback(() => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const s of visibleStudents) delete next[s.id];
      return next;
    });
  }, [visibleStudents]);

  const clearAll = useCallback(() => setSelected({}), []);

  const exportExcel = () => {
    if (selectedStudents.length === 0 || testsSorted.length === 0) return;
    setExporting(true);
    try {
      const summaryRows = selectedStudents.map((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        let eligible = 0;
        let started = 0;
        let submitted = 0;
        const percents: number[] = [];
        for (const r of testsSorted) {
          const t = r.test;
          if (!isEligibleForExam(s, t)) continue;
          eligible++;
          const a = attemptsMap.get(attemptCompositeKey(t.id, s.id));
          if (a) {
            started++;
            if (a.status === "submitted") {
              submitted++;
              const p = percentScore(a, t.totalMarks);
              if (p != null) percents.push(p);
            }
          }
        }
        const absent = eligible - started;
        const avgPct =
          percents.length > 0
            ? Math.round((percents.reduce((x, y) => x + y, 0) / percents.length) * 10) / 10
            : "";
        const minPct = percents.length > 0 ? Math.round(Math.min(...percents) * 10) / 10 : "";
        const maxPct = percents.length > 0 ? Math.round(Math.max(...percents) * 10) / 10 : "";
        const attendRate = eligible > 0 ? Math.round((started / eligible) * 1000) / 10 : "";
        const submitRate = eligible > 0 ? Math.round((submitted / eligible) * 1000) / 10 : "";

        return {
          studentRecordId: s.id,
          studentId: s.studentId,
          studentName: s.name,
          studentEmail: s.email,
          studentBatch: batchName,
          rosterStatus: s.status,
          examsEligible: eligible,
          examsStarted_present: started,
          examsSubmitted: submitted,
          examsAbsent_eligibleNoStart: absent,
          attendanceRate_pctOfEligible: attendRate,
          submissionRate_pctOfEligible: submitRate,
          avgPercent_amongSubmittedTests: avgPct,
          minPercent_amongSubmittedTests: minPct,
          maxPercent_amongSubmittedTests: maxPct,
        };
      });

      const detailRows: Record<string, string | number>[] = [];
      for (const s of selectedStudents) {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        for (const r of testsSorted) {
          const t = r.test;
          const elig = isEligibleForExam(s, t);
          const a = attemptsMap.get(attemptCompositeKey(t.id, s.id));
          const pct = a?.status === "submitted" ? percentScore(a, t.totalMarks) : null;
          const pa = presentAbsentLabel(s, t, attemptsMap);
          detailRows.push({
            studentRecordId: s.id,
            studentId: s.studentId,
            studentName: s.name,
            studentEmail: s.email,
            studentBatch: batchName,
            rosterStatus: s.status,
            examId: t.id,
            examTitle: t.title,
            examSubject: t.subject,
            examBatch: r.batchName,
            examStartAt: toIsoOrEmpty(t.startAt),
            examEndAt: toIsoOrEmpty(t.endAt),
            eligibleForExam: elig ? "Yes" : "No",
            presentAbsent: pa,
            attemptStatus: a?.status ?? "",
            score: a?.score ?? "",
            maxMarks: a ? (a.maxScore ?? t.totalMarks) : "",
            percent: pct ?? "",
            startedAt: a ? toIsoOrEmpty(a.startedAt) : "",
            submittedAt: a ? toIsoOrEmpty(a.submittedAt) : "",
            lastSavedAt: a ? toIsoOrEmpty(a.lastSavedAt) : "",
          });
        }
      }

      const scoreHeader = ["Student ID", "Name", "Email", "Batch", ...testsSorted.map(testColumnHeader)];
      const scoreAoA: (string | number)[][] = [
        scoreHeader,
        ...selectedStudents.map((s) => {
          const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
          return [
            s.studentId,
            s.name,
            s.email,
            batchName,
            ...testsSorted.map((r) => scoreCellDisplay(s, r.test, attemptsMap)),
          ];
        }),
      ];

      const attHeader = ["Student ID", "Name", "Email", "Batch", ...testsSorted.map(testColumnHeader)];
      const attAoA: (string | number)[][] = [
        attHeader,
        ...selectedStudents.map((s) => {
          const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
          return [
            s.studentId,
            s.name,
            s.email,
            batchName,
            ...testsSorted.map((r) => presentAbsentLabel(s, r.test, attemptsMap)),
          ];
        }),
      ];

      const notesAoA: string[][] = [
        ["Student test reports — export notes"],
        [""],
        ["Present", "Student had an attempt record (started the CBT), submitted or in progress."],
        ["Absent", "Student was eligible for the exam but has no attempt."],
        ["N/A", "Student was not eligible (different batch or not on selective list)."],
        [""],
        ["Tests are ordered by exam start time (newest first)."],
        [
          `Exported ${selectedStudents.length} student(s), ${testsSorted.length} test column(s).`,
        ],
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Student_summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Test_results_detail");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scoreAoA), "Scores_matrix");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attAoA), "Attendance_matrix");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notesAoA), "Notes");

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `${safeFileName(`student_test_reports_${selectedCount}pax_${stamp}`)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to tests
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Student test reports</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Pick one or more students, then download an Excel workbook with per-student summaries, every test as a row
            (marks, percent, present/absent), and wide matrices for scores and attendance. Eligibility follows the same
            batch and selective rules as the rest of the admin tools.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-9 px-3 text-sm font-normal tabular-nums">
            {selectedCount} selected
          </Badge>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={exportExcel}
            disabled={loading || exporting || selectedCount === 0 || testsSorted.length === 0}
          >
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Narrow the roster, then tick students to include.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-filter">Batch</Label>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger id="batch-filter" className="w-full">
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-search">Search</Label>
              <Input
                id="student-search"
                placeholder="Name, email, or student ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={selectAllVisible} disabled={visibleStudents.length === 0}>
                Select visible
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearVisible} disabled={!someVisibleSelected}>
                Clear visible
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={selectedCount === 0}>
                Clear all
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Showing <span className="font-medium text-slate-700">{visibleStudents.length}</span> of{" "}
              <span className="font-medium text-slate-700">{students.length}</span> students.
              {loading ? " Loading tests…" : ` ${testsSorted.length} published tests in scope.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-4">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Choose students</CardTitle>
                <CardDescription>Use the header checkbox to select or deselect everyone in the filtered list.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-2 px-6 py-12 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tests and attempts…
              </div>
            ) : visibleStudents.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">No students match these filters.</p>
            ) : (
              <div className="max-h-[min(520px,55vh)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={(v) => {
                            if (v === true) selectAllVisible();
                            else clearVisible();
                          }}
                          aria-label="Select all visible students"
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleStudents.map((s) => {
                      const batchName = batches.find((b) => b.id === s.batchId)?.name || "—";
                      const isOn = Boolean(selected[s.id]);
                      return (
                        <TableRow key={s.id} className={isOn ? "bg-emerald-50/40" : undefined}>
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={isOn}
                              onCheckedChange={(v) => toggleOne(s.id, v === true)}
                              aria-label={`Select ${s.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                          <TableCell className="text-sm text-slate-600 tabular-nums">{s.studentId}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-slate-600" title={s.email}>
                            {s.email}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{batchName}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs font-normal">
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-800">Workbook contents</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-slate-600">
          <ul className="list-inside list-disc space-y-1 marker:text-slate-400">
            <li>
              <span className="font-medium text-slate-800">Student_summary</span> — one row per selected student:
              eligible exam count, started, submitted, absent, attendance and submission rates, average/min/max percent
              among submitted tests.
            </li>
            <li>
              <span className="font-medium text-slate-800">Test_results_detail</span> — long format: every student × every
              test with present/absent, attempt status, score, max marks, percent, timestamps.
            </li>
            <li>
              <span className="font-medium text-slate-800">Scores_matrix</span> — wide sheet with one column per test
              (score/max and percent, or in progress / blank absent).
            </li>
            <li>
              <span className="font-medium text-slate-800">Attendance_matrix</span> — same layout with Present / Absent /
              N/A.
            </li>
            <li>
              <span className="font-medium text-slate-800">Notes</span> — definitions for the export.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
