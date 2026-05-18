import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Download, Loader2 } from "lucide-react";
import { getExamTest, listAttemptsForAdmin, listPrivateQuestions, listPublicQuestions } from "../../features/exams/examApi";
import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "../../features/exams/types";
import { useData } from "../../context/DataContext";
import * as XLSX from "xlsx";

function safeFileName(name: string) {
  return (name || "export").replace(/[\\/:*?"<>|]+/g, "_");
}

function toIsoOrEmpty(value: any) {
  if (!value) return "";
  try {
    return new Date(value).toISOString();
  } catch {
    return String(value);
  }
}

function asNumberOrEmpty(value: any) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : "";
}

function percentFromAttempt(a: ExamAttempt, maxMarks: number) {
  const max = a.maxScore ?? maxMarks;
  const score = a.score;
  if (score == null || !Number.isFinite(max) || max <= 0) return null;
  return Math.round((score / max) * 1000) / 10;
}

/** Submitted first, highest marks first; ties break by student name. In-progress / not submitted after, by name. */
function sortAttemptsForRankExport(attempts: ExamAttempt[], students: { id: string; name?: string }[]) {
  const nameOf = (a: ExamAttempt) =>
    students.find((s) => s.id === a.studentRecordId)?.name?.trim().toLowerCase() || a.uid;

  const submitted = attempts.filter((a) => a.status === "submitted");
  const notSubmitted = attempts.filter((a) => a.status !== "submitted");

  submitted.sort((a, b) => {
    const sa = a.score ?? -Infinity;
    const sb = b.score ?? -Infinity;
    if (sb !== sa) return sb - sa;
    return nameOf(a).localeCompare(nameOf(b));
  });
  notSubmitted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  return { ranked: submitted, unranked: notSubmitted };
}

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

  /** Matches Excel export: submitted highest marks first, then in-progress / not submitted. */
  const sortedAttemptsForDisplay = useMemo(() => {
    if (attempts.length === 0) return [];
    const { ranked, unranked } = sortAttemptsForRankExport(attempts, students);
    return [...ranked, ...unranked];
  }, [attempts, students]);

  const attemptsWithRank = useMemo(() => {
    let r = 0;
    return sortedAttemptsForDisplay.map((a) => {
      if (a.status === "submitted") r++;
      return {
        attempt: a,
        rank: a.status === "submitted" ? r : null,
      };
    });
  }, [sortedAttemptsForDisplay]);

  const exportExcel = async () => {
    if (!test) return;
    setExporting(true);
    try {
      const [qs, keys] = await Promise.all([
        listPublicQuestions(testId).catch(() => [] as ExamQuestionPublic[]),
        listPrivateQuestions(testId).catch(() => null as ExamQuestionPrivate[] | null),
      ]);

      const questions = [...qs];
      const questionIndexById = new Map<string, number>();
      const questionById = new Map<string, ExamQuestionPublic>();
      for (let i = 0; i < questions.length; i++) {
        questionIndexById.set(questions[i]!.id, i + 1);
        questionById.set(questions[i]!.id, questions[i]!);
      }
      const correctIndexById = new Map<string, number>();
      if (keys) {
        for (const k of keys) correctIndexById.set(k.id, k.correctIndex);
      }

      const totalQuestions = questions.length;
      const totalMarks =
        typeof test.totalMarks === "number"
          ? test.totalMarks
          : questions.reduce((sum, q) => sum + (q.marks || 0), 0);

      const avgMarksPerQuestion =
        totalQuestions > 0 ? Math.round((totalMarks / totalQuestions) * 1000) / 1000 : "";

      const { ranked, unranked } = sortAttemptsForRankExport(attempts, students);
      const exportAttemptOrder = [...ranked, ...unranked];

      let rankCounter = 0;
      const summaryRows = exportAttemptOrder.map((a) => {
        const student = students.find((s) => s.id === a.studentRecordId);
        const answers = a.answers || {};
        const answeredCount = Object.values(answers).filter((v) => v != null).length;
        let correctCount: number | "" = "";
        let wrongCount: number | "" = "";
        let unansweredCount: number | "" = "";
        if (keys) {
          let c = 0;
          let w = 0;
          let u = 0;
          for (const q of questions) {
            const selected = answers[q.id] ?? null;
            if (selected == null) {
              u++;
              continue;
            }
            const correct = correctIndexById.get(q.id);
            if (correct == null) continue;
            if (selected === correct) c++;
            else w++;
          }
          correctCount = c;
          wrongCount = w;
          unansweredCount = u;
        }

        const startedMs = a.startedAt ? new Date(a.startedAt).getTime() : null;
        const submittedMs = a.submittedAt ? new Date(a.submittedAt).getTime() : null;
        const timeTakenSeconds =
          startedMs != null && submittedMs != null && Number.isFinite(startedMs) && Number.isFinite(submittedMs)
            ? Math.max(0, Math.round((submittedMs - startedMs) / 1000))
            : "";

        const maxForStudent = a.maxScore ?? totalMarks;
        const pct = percentFromAttempt(a, totalMarks);

        if (a.status === "submitted") rankCounter++;

        return {
          rank: a.status === "submitted" ? rankCounter : "",
          studentName: student?.name || "",
          studentId: student?.studentId || "",
          marksObtained: a.score ?? "",
          maxMarks: maxForStudent,
          percentage: pct != null ? pct : "",
          totalQuestions,
          totalMarks,
          avgMarksPerQuestion,
          studentEmail: student?.email || "",
          status: a.status,
          answeredCount,
          unansweredCount,
          correctCount,
          wrongCount,
          uid: a.uid,
          studentRecordId: a.studentRecordId || "",
          examId: test.id,
          examTitle: test.title,
          batch: batchName,
          subject: test.subject,
          startedAt: toIsoOrEmpty(a.startedAt),
          submittedAt: toIsoOrEmpty(a.submittedAt),
          hardEndAt: toIsoOrEmpty((a as any).hardEndAt),
          timeTakenSeconds,
        };
      });

      const questionByQuestionRows = exportAttemptOrder.flatMap((a) => {
        const student = students.find((s) => s.id === a.studentRecordId);
        const answers = a.answers || {};
        return questions.map((q) => {
          const selected = answers[q.id] ?? null;
          const correct = keys ? correctIndexById.get(q.id) : undefined;
          const selectedText = selected != null ? q.options?.[selected] ?? "" : "";
          const correctText = correct != null ? q.options?.[correct] ?? "" : "";
          const isCorrect = correct != null && selected != null ? selected === correct : "";
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
            attemptStatus: a.status,
            startedAt: toIsoOrEmpty(a.startedAt),
            submittedAt: toIsoOrEmpty(a.submittedAt),
            questionNo: questionIndexById.get(q.id) ?? "",
            questionId: q.id,
            questionText: q.text || "",
            marks: asNumberOrEmpty(q.marks),
            optionCount: q.options?.length ?? "",
            selectedIndex: selected ?? "",
            selectedOption: selectedText,
            correctIndex: correct ?? "",
            correctOption: correctText,
            isCorrect,
          };
        });
      });

      let wideRank = 0;
      const wideRows = exportAttemptOrder.map((a) => {
        const student = students.find((s) => s.id === a.studentRecordId);
        const maxForStudent = a.maxScore ?? totalMarks;
        const pct = percentFromAttempt(a, totalMarks);
        if (a.status === "submitted") wideRank++;
        const base: Record<string, any> = {
          rank: a.status === "submitted" ? wideRank : "",
          studentName: student?.name || "",
          studentId: student?.studentId || "",
          marksObtained: a.score ?? "",
          maxMarks: maxForStudent,
          percentage: pct != null ? pct : "",
          totalQuestions,
          totalMarks,
          avgMarksPerQuestion,
          uid: a.uid,
          studentEmail: student?.email || "",
          status: a.status,
        };
        const answers = a.answers || {};
        for (const q of questions) {
          const qNo = questionIndexById.get(q.id) ?? "";
          const selected = answers[q.id] ?? null;
          const correct = keys ? correctIndexById.get(q.id) : undefined;
          const letter =
            selected == null || typeof selected !== "number" ? "" : String.fromCharCode(65 + Math.max(0, selected));
          const correctness =
            correct == null || selected == null || typeof selected !== "number"
              ? ""
              : selected === correct
                ? "C"
                : "W";
          base[`Q${qNo}`] = letter;
          base[`Q${qNo}_status`] = correctness;
        }
        return base;
      });

      const ws = XLSX.utils.json_to_sheet(summaryRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ranked results");

      const ws2 = XLSX.utils.json_to_sheet(questionByQuestionRows);
      XLSX.utils.book_append_sheet(wb, ws2, "QuestionByQuestion");

      const ws3 = XLSX.utils.json_to_sheet(wideRows);
      XLSX.utils.book_append_sheet(wb, ws3, "Wide");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName(test.title)}-results.xlsx`;
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
          <div className="text-sm font-semibold text-slate-900">Results</div>
          <div className="text-xs text-slate-600 mt-1">
            {test.title} • {batchName} • {test.subject}
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
            {sortedAttemptsForDisplay.length} total
          </Badge>
        </CardHeader>
        <CardContent>
          {sortedAttemptsForDisplay.length === 0 ? (
            <div className="text-sm text-slate-500">No attempts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Percent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attemptsWithRank.map(({ attempt: a, rank }) => {
                    const s = students.find((x) => x.id === a.studentRecordId);
                    const rankLabel = rank != null ? String(rank) : "—";
                    const maxMarks = test ? a.maxScore ?? test.totalMarks : null;
                    const percent =
                      a.score != null && maxMarks != null && maxMarks > 0
                        ? Math.round((a.score / maxMarks) * 1000) / 10
                        : null;
                    return (
                      <TableRow key={a.id} className="hover:bg-slate-50">
                        <TableCell className="text-sm font-semibold text-slate-800 tabular-nums">{rankLabel}</TableCell>
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
                          {a.score != null && maxMarks != null ? `${a.score} / ${maxMarks}` : "-"}
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

