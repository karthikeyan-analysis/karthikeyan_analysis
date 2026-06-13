import { useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { listExamTestsForAdmin, listAttemptsForAdmin } from "../../features/exams/examApi";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import { examIncludesBatch } from "../../features/exams/examBatchUtils";
import { useData } from "../../context/DataContext";

interface TableRow {
  sno: number;
  name: string;
  attended: boolean;
  marks: number;
}

export default function StudentTestReports() {
  const navigate = useNavigate();
  const { students, batches } = useData();

  const [allTests, setAllTests] = useState<ExamTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedTest, setSelectedTest] = useState<string>("");

  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

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
  }, [selectedBatch]);

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

  const batchStudents = useMemo(() => {
    if (!selectedBatch) return [];
    return [...students.filter((s) => s.batchId === selectedBatch)].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [students, selectedBatch]);

  const attemptsLookup = useMemo(() => {
    const m = new Map<string, ExamAttempt>();
    for (const a of attempts) {
      const key = (a.studentRecordId || "").trim() || a.uid;
      if (key) m.set(key, a);
    }
    return m;
  }, [attempts]);

  const tableRows = useMemo((): TableRow[] => {
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/admin/tests")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to tests
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Per-test student report</h1>
        <p className="max-w-xl text-sm text-slate-600">
          Select a batch and a test to view every student's attendance and marks for that exam.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select batch &amp; test</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Test Number</label>
            <Select
              value={selectedTest}
              onValueChange={setSelectedTest}
              disabled={!selectedBatch || testsLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedBatch
                      ? "Select a batch first…"
                      : testsLoading
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
    </div>
  );
}
