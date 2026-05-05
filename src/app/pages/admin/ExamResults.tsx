import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { getExamTest, listAttemptsForAdmin } from "../../features/exams/examApi";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import { useData } from "../../context/DataContext";
import * as XLSX from "xlsx";

export default function ExamResults() {
  const { id } = useParams();
  const testId = id || "";
  const navigate = useNavigate();
  const { students, batches } = useData();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [test, setTest] = useState<ExamTest | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, a] = await Promise.all([getExamTest(testId), listAttemptsForAdmin(testId)]);
        if (cancelled) return;
        setTest(t);
        setAttempts(a);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const batchName = useMemo(() => {
    if (!test) return "";
    return batches.find((b) => b.id === test.batchId)?.name || test.batchId;
  }, [batches, test]);

  const exportExcel = async () => {
    if (!test) return;
    setExporting(true);
    try {
      const rows = attempts.map((a) => {
        const student = students.find((s) => s.id === a.studentRecordId);
        return {
          examId: test.id,
          examTitle: test.title,
          batch: batchName,
          subject: test.subject,
          uid: a.uid,
          studentRecordId: a.studentRecordId || "",
          studentId: student?.studentId || "",
          studentName: student?.name || "",
          studentEmail: student?.email || "",
          status: a.status,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt || "",
          score: a.score ?? "",
          maxScore: a.maxScore ?? "",
          percentage:
            a.score != null && a.maxScore ? Math.round((a.score / a.maxScore) * 10000) / 100 : "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${test.title.replace(/[\\/:*?"<>|]+/g, "_")}-results.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading results...
      </div>
    );
  }

  if (!test) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Exam not found</AlertTitle>
        <AlertDescription>Invalid exam id.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" className="-ml-3" onClick={() => navigate(`/admin/tests/${testId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to exam
          </Button>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {test.title}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {batchName}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {test.subject}
            </Badge>
          </div>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void exportExcel()} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="ml-2">Download Excel</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attempts</CardTitle>
          <Badge variant="outline" className="text-xs">
            {attempts.length} total
          </Badge>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="text-sm text-slate-500">No attempts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((a) => {
                    const s = students.find((x) => x.id === a.studentRecordId);
                    const percent =
                      a.score != null && a.maxScore ? Math.round((a.score / a.maxScore) * 1000) / 10 : null;
                    return (
                      <TableRow key={a.id} className="hover:bg-slate-50">
                        <TableCell className="min-w-[260px]">
                          <div className="font-medium text-slate-900">{s?.name || "Unknown"}</div>
                          <div className="text-xs text-slate-600">{s?.email || a.uid}</div>
                        </TableCell>
                        <TableCell>
                          {a.status === "submitted" ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Submitted</Badge>
                          ) : (
                            <Badge className="bg-indigo-100 text-indigo-800">In progress</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {a.startedAt ? new Date(a.startedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-900">
                          {a.score != null ? `${a.score} / ${a.maxScore ?? ""}` : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {percent != null ? `${percent}%` : "-"}
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
  );
}

