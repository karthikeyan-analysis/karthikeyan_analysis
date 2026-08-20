import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ArrowLeft, Download, Loader2, Users } from "lucide-react";
import { listExamTestsForAdmin, listAttemptsForAdmin } from "../../features/exams/examApi";
import { studentBelongsToBatch } from "../../features/students/studentBatchUtils";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import { examIncludesBatch } from "../../features/exams/examBatchUtils";
import { useData } from "../../context/DataContext";
import * as XLSX from "xlsx";

interface ReportRow {
  sno: number;
  name: string;
  attended: boolean;
  marks: number;
}

type ActiveTab = "per-test" | "matrix";

export default function StudentTestReports() {
  const navigate = useNavigate();
  const { students, batches } = useData();

  const [activeTab, setActiveTab] = useState<ActiveTab>("per-test");
  const [allTests, setAllTests] = useState<ExamTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedTest, setSelectedTest] = useState<string>("");

  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Matrix-specific state
  const [matrixAttempts, setMatrixAttempts] = useState<Map<string, ExamAttempt[]>>(new Map());
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixExporting, setMatrixExporting] = useState(false);

  useEffect(() => {
    setTestsLoading(true);
    listExamTestsForAdmin()
      .then(setAllTests)
      .catch(console.error)
      .finally(() => setTestsLoading(false));
  }, []);

  const testsForBatch = useMemo(() => {
    if (!selectedBatch) return [];
    return allTests
      .filter((t) => examIncludesBatch(t, selectedBatch))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [allTests, selectedBatch]);

  useEffect(() => {
    setSelectedTest("");
    setAttempts([]);
    setMatrixAttempts(new Map());
  }, [selectedBatch]);

  // Per-test view: load attempts when a test is selected
  useEffect(() => {
    if (!selectedTest) {
      setAttempts([]);
      return;
    }
    setAttemptsLoading(true);
    listAttemptsForAdmin(selectedTest)
      .then(setAttempts)
      .catch(console.error)
      .finally(() => setAttemptsLoading(false));
  }, [selectedTest]);

  // Matrix view: load all test attempts when tab opens with a batch selected
  useEffect(() => {
    if (activeTab !== "matrix" || !selectedBatch || testsForBatch.length === 0) return;
    setMatrixLoading(true);
    Promise.all(
      testsForBatch.map((t) =>
        listAttemptsForAdmin(t.id).then((att) => [t.id, att] as const),
      ),
    )
      .then((results) => {
        const m = new Map<string, ExamAttempt[]>();
        for (const [id, att] of results) m.set(id, att);
        setMatrixAttempts(m);
      })
      .catch(console.error)
      .finally(() => setMatrixLoading(false));
  }, [activeTab, selectedBatch, testsForBatch]);

  const batchStudents = useMemo(() => {
    if (!selectedBatch) return [];
    return [...students.filter((s) => studentBelongsToBatch(s, selectedBatch))].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [students, selectedBatch]);

  // Per-test attempt lookup
  const attemptsLookup = useMemo(() => {
    const m = new Map<string, ExamAttempt>();
    for (const a of attempts) {
      const key = (a.studentRecordId || "").trim() || a.uid;
      if (key) m.set(key, a);
    }
    return m;
  }, [attempts]);

  const tableRows = useMemo((): ReportRow[] => {
    return batchStudents.map((s, idx) => {
      const attempt = attemptsLookup.get(s.id);
      const attended = !!attempt;
      const marks = attempt?.score ?? 0;
      return { sno: idx + 1, name: s.name, attended, marks };
    });
  }, [batchStudents, attemptsLookup]);

  const selectedTestObj = useMemo(
    () => allTests.find((t) => t.id === selectedTest) ?? null,
    [allTests, selectedTest],
  );

  const attendedCount = tableRows.filter((r) => r.attended).length;

  // Matrix: attempt lookup per test
  const matrixLookupByTest = useMemo(() => {
    const outer = new Map<string, Map<string, ExamAttempt>>();
    for (const test of testsForBatch) {
      const inner = new Map<string, ExamAttempt>();
      for (const a of matrixAttempts.get(test.id) ?? []) {
        const key = (a.studentRecordId || "").trim() || a.uid;
        if (key) inner.set(key, a);
      }
      outer.set(test.id, inner);
    }
    return outer;
  }, [testsForBatch, matrixAttempts]);

  function exportMatrixToExcel() {
    if (!selectedBatch || batchStudents.length === 0 || testsForBatch.length === 0) return;
    setMatrixExporting(true);
    try {
      const batchName = batches.find((b) => b.id === selectedBatch)?.name ?? "Batch";
      const headers: string[] = ["S.No", "Student Name"];
      for (let i = 0; i < testsForBatch.length; i++) {
        const t = testsForBatch[i];
        headers.push(`Test ${i + 1} Attendance`);
        headers.push(`Test ${i + 1} Marks (/${t.totalMarks ?? "?"})`);
      }

      const rows = batchStudents.map((s, idx) => {
        const row: (string | number)[] = [idx + 1, s.name];
        for (const test of testsForBatch) {
          const attempt = matrixLookupByTest.get(test.id)?.get(s.id);
          row.push(attempt ? "Attended" : "Not Attended");
          row.push(attempt?.score ?? 0);
        }
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Matrix");
      XLSX.writeFile(wb, `${batchName.replace(/[\\/:*?"<>|]+/g, "_")}_multi_test_matrix_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Failed to export matrix data");
    } finally {
      setMatrixExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/admin/tests")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to tests
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Student test reports</h1>
        <p className="max-w-xl text-sm text-slate-600">
          View attendance and marks per test or see a full multi-test matrix for a batch.
        </p>
      </div>

      {/* Batch selector (shared) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select batch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Batch Name</label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger>
                <SelectValue placeholder="Select a batch…" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tab bar */}
      {selectedBatch && (
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
          <button
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${activeTab === "per-test" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("per-test")}
          >
            Per-Test Report
          </button>
          <button
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${activeTab === "matrix" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("matrix")}
          >
            Multi-Test Matrix
          </button>
        </div>
      )}

      {/* ── Per-Test Tab ──────────────────────────────────────────────────── */}
      {activeTab === "per-test" && selectedBatch && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select test</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Test Number</label>
                <Select
                  value={selectedTest}
                  onValueChange={setSelectedTest}
                  disabled={testsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        testsLoading
                          ? "Loading…"
                          : testsForBatch.length === 0
                            ? "No tests for this batch"
                            : "Select a test…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {testsForBatch.map((t, idx) => (
                      <SelectItem key={t.id} value={t.id}>
                        Test {idx + 1}: {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedTest && (
            <Card>
              <CardHeader className="flex flex-col gap-2 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between pb-4">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{selectedTestObj?.title ?? "Selected Test"}</CardTitle>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {batches.find((b) => b.id === selectedBatch)?.name ?? ""}&nbsp;&middot;&nbsp;
                      {attemptsLoading ? "Loading…" : `${attendedCount} / ${tableRows.length} attended`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {attemptsLoading ? (
                  <div className="flex items-center gap-2 px-6 py-12 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading attempt data…
                  </div>
                ) : batchStudents.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-slate-500">
                    No students found in this batch.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="w-16 pl-6">S.No</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Attendance Status</TableHead>
                        <TableHead className="pr-6 text-right">Marks Obtained</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.map((row) => (
                        <TableRow key={row.sno}>
                          <TableCell className="pl-6 tabular-nums text-slate-500">{row.sno}</TableCell>
                          <TableCell className="font-medium text-slate-900">{row.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={row.attended ? "default" : "secondary"}
                              className={
                                row.attended
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-100"
                              }
                            >
                              {row.attended ? "Attended" : "Not Attended"}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6 text-right tabular-nums font-semibold">
                            {row.marks}
                            {selectedTestObj && (
                              <span className="ml-1 text-xs font-normal text-slate-400">
                                / {selectedTestObj.totalMarks}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Multi-Test Matrix Tab ─────────────────────────────────────────── */}
      {activeTab === "matrix" && selectedBatch && (
        <Card>
          <CardHeader className="flex flex-col gap-2 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between pb-4">
            <div>
              <CardTitle className="text-base">
                {batches.find((b) => b.id === selectedBatch)?.name ?? "Batch"} — All Tests
              </CardTitle>
              <p className="mt-0.5 text-sm text-slate-500">
                {testsForBatch.length} test{testsForBatch.length !== 1 ? "s" : ""} · {batchStudents.length} student{batchStudents.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportMatrixToExcel}
              disabled={matrixLoading || matrixExporting || batchStudents.length === 0 || testsForBatch.length === 0}
              className="gap-1.5 self-start sm:self-auto"
            >
              {matrixExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download Excel
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            {matrixLoading ? (
              <div className="flex items-center gap-2 px-6 py-12 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading matrix data…
              </div>
            ) : testsForBatch.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">No tests found for this batch.</p>
            ) : batchStudents.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">No students found in this batch.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="w-12 pl-4 sticky left-0 bg-slate-50">S.No</TableHead>
                    <TableHead className="min-w-[160px] sticky left-12 bg-slate-50">Student Name</TableHead>
                    {testsForBatch.map((t, idx) => (
                      <Fragment key={t.id}>
                        <TableHead className="min-w-[100px] text-center text-xs">
                          Test {idx + 1}
                          <br />
                          <span className="font-normal text-slate-400">Attendance</span>
                        </TableHead>
                        <TableHead className="min-w-[90px] text-center text-xs">
                          Test {idx + 1}
                          <br />
                          <span className="font-normal text-slate-400">Marks /{t.totalMarks ?? "?"}</span>
                        </TableHead>
                      </Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchStudents.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-4 tabular-nums text-slate-500 sticky left-0 bg-white">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900 sticky left-12 bg-white">{s.name}</TableCell>
                      {testsForBatch.map((t) => {
                        const attempt = matrixLookupByTest.get(t.id)?.get(s.id);
                        const attended = !!attempt;
                        return (
                          <Fragment key={t.id}>
                            <TableCell className="text-center">
                              <Badge
                                variant={attended ? "default" : "secondary"}
                                className={
                                  attended
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs"
                                    : "bg-slate-100 text-slate-400 hover:bg-slate-100 text-xs"
                                }
                              >
                                {attended ? "✓" : "–"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center tabular-nums font-medium text-slate-700">
                              {attended ? (attempt?.score ?? 0) : "–"}
                            </TableCell>
                          </Fragment>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedBatch && (
        <p className="text-sm text-slate-500">Select a batch above to get started.</p>
      )}
    </div>
  );
}
