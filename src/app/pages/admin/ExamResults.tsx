import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { CheckCircle2, Download, Loader2, Trash2 } from "lucide-react";
import {
  approveRejoinForAdmin,
  deleteAttemptsForAdmin,
  getExamTest,
  listAttemptsForAdmin,
  listPrivateQuestions,
  listPublicQuestions,
} from "../../features/exams/examApi";
import type {
  ExamAttempt,
  ExamQuestionPrivate,
  ExamQuestionPublic,
  ExamTest,
} from "../../features/exams/types";
import { useData } from "../../context/DataContext";
import * as XLSX from "xlsx";
import {
  displayNameForAttempt,
  resolveAttemptParticipant,
} from "../../features/exams/adminTestReportUtils";
import { formatExamBatchLabel } from "../../features/exams/examBatchUtils";
import { formatPartLabel } from "../../features/exams/examScoring";
import {
  computeThreeSectionBreakdown,
  resolveThreeSections,
} from "../../features/exams/sectionResultUtils";

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
function sortAttemptsForRankExport(attempts: ExamAttempt[], students: any[]) {
  const nameOf = (a: ExamAttempt) =>
    displayNameForAttempt(a, students).trim().toLowerCase() || a.uid;

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
  const [clearingResponses, setClearingResponses] = useState(false);
  const [approvingRejoinUid, setApprovingRejoinUid] = useState<string | null>(
    null,
  );
  const [test, setTest] = useState<ExamTest | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [keys, setKeys] = useState<ExamQuestionPrivate[] | null>(null);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, a, qs, k] = await Promise.all([
          getExamTest(testId),
          listAttemptsForAdmin(testId),
          listPublicQuestions(testId).catch(() => [] as ExamQuestionPublic[]),
          listPrivateQuestions(testId).catch(
            () => null as ExamQuestionPrivate[] | null,
          ),
        ]);
        if (cancelled) return;
        setTest(t);
        setAttempts(a);
        setQuestions(qs);
        setKeys(k);
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
    return formatExamBatchLabel(test, batches);
  }, [batches, test]);

  const { sectionInfo, rows: threeSectionRows } = useMemo(() => {
    return computeThreeSectionBreakdown({
      test,
      questions,
      keys,
      attempts,
      students,
      resolveParticipant: resolveAttemptParticipant,
    });
  }, [test, questions, keys, attempts, students]);
  const exportExcel = async () => {
    if (!test) return;
    setExporting(true);
    try {
      let curQuestions = questions;
      let curKeys = keys;
      if (curQuestions.length === 0 || !curKeys) {
        const [qs, k] = await Promise.all([
          listPublicQuestions(testId).catch(() => [] as ExamQuestionPublic[]),
          listPrivateQuestions(testId).catch(
            () => null as ExamQuestionPrivate[] | null,
          ),
        ]);
        curQuestions = qs;
        curKeys = k;
      }

      const { sectionInfo: secInfo, rows: computedRows } =
        computeThreeSectionBreakdown({
          test,
          questions: curQuestions,
          keys: curKeys,
          attempts,
          students,
          resolveParticipant: resolveAttemptParticipant,
        });

      const questionIndexById = new Map<string, number>();
      const questionById = new Map<string, ExamQuestionPublic>();
      for (let i = 0; i < curQuestions.length; i++) {
        questionIndexById.set(curQuestions[i]!.id, i + 1);
        questionById.set(curQuestions[i]!.id, curQuestions[i]!);
      }
      const correctIndexById = new Map<string, number>();
      if (curKeys) {
        for (const k of curKeys) correctIndexById.set(k.id, k.correctIndex);
      }

      const totalQuestions = curQuestions.length;
      const totalMarks =
        typeof test.totalMarks === "number"
          ? test.totalMarks
          : curQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);

      const partsList =
        test.partsMode === "multi"
          ? [...(test.parts || [])].sort((a, b) => a.order - b.order)
          : [];
      const partById = new Map(partsList.map((p) => [p.id, p]));

      // Sheet 1: Ranked results according to handwritten spec & prompt
      const rankedResultRows = computedRows.map((row) => ({
        "S.No.": row.sNo,
        Rank: row.rank,
        "Student Name": row.studentName,
        [`PART-A (MATHS) (No. of Qus out of ${secInfo.partA.totalQuestions})`]:
          row.partA.correct,
        "PART-A (MATHS) Marks (x1.5)": row.partA.marks,
        [`PART-B (STAT) (No. of Qus out of ${secInfo.partB.totalQuestions})`]:
          row.partB.correct,
        "PART-B (STAT) Marks (x1.5)": row.partB.marks,
        [`PART-C (ECO) (No. of Qus out of ${secInfo.partC.totalQuestions})`]:
          row.partC.correct,
        "PART-C (ECO) Marks (x1.5)": row.partC.marks,
        "TOTAL Qus Correct": row.totalCorrect,
        "TOTAL MARKS": row.grandTotalMarks,
        "Student ID": row.studentId,
        "Student Email": row.studentEmail,
        Status: row.status,
        "Submitted At": row.submittedAt,
        "Time Taken (Seconds)": row.timeTakenSeconds,
      }));

      // Sheet 2: QuestionByQuestion
      const exportAttemptOrder = computedRows.map((r) => r.rawAttempt);
      const questionByQuestionRows = exportAttemptOrder.flatMap((a) => {
        const participant = resolveAttemptParticipant(a, students);
        const answers = a.answers || {};
        return curQuestions.map((q) => {
          const selected = answers[q.id] ?? null;
          const correct = curKeys ? correctIndexById.get(q.id) : undefined;
          const selectedText =
            selected != null ? (q.options?.[selected] ?? "") : "";
          const correctText =
            correct != null ? (q.options?.[correct] ?? "") : "";
          const isCorrect =
            correct != null && selected != null ? selected === correct : "";
          const part = q.partId ? partById.get(q.partId) : undefined;
          return {
            examId: test.id,
            examTitle: test.title,
            batch: batchName,
            subject: test.subject,
            uid: a.uid,
            studentRecordId: a.studentRecordId || "",
            studentId: participant.studentId,
            studentName: participant.name,
            studentEmail: participant.email,
            isGuest: participant.isGuest ? "yes" : "no",
            attemptStatus: a.status,
            startedAt: toIsoOrEmpty(a.startedAt),
            submittedAt: toIsoOrEmpty(a.submittedAt),
            partLabel: part?.label || "",
            partSubject: part?.subject || "",
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

      // Sheet 3: Wide
      const wideRows = computedRows.map((row) => {
        const a = row.rawAttempt;
        const participant = resolveAttemptParticipant(a, students);
        const base: Record<string, any> = {
          "S.No.": row.sNo,
          Rank: row.rank,
          "Student Name": row.studentName,
          "Student ID": row.studentId,
          "Student Email": row.studentEmail,
          Status: row.status,
          "Total Correct": row.totalCorrect,
          "Grand Total Marks": row.grandTotalMarks,
          "Part A (Maths) Correct": row.partA.correct,
          "Part A (Maths) Marks": row.partA.marks,
          "Part B (Stat) Correct": row.partB.correct,
          "Part B (Stat) Marks": row.partB.marks,
          "Part C (Eco) Correct": row.partC.correct,
          "Part C (Eco) Marks": row.partC.marks,
        };
        const answers = a.answers || {};
        for (const q of curQuestions) {
          const qNo = questionIndexById.get(q.id) ?? "";
          const selected = answers[q.id] ?? null;
          const correct = curKeys ? correctIndexById.get(q.id) : undefined;
          const letter =
            selected == null || typeof selected !== "number"
              ? ""
              : String.fromCharCode(65 + Math.max(0, selected));
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

      // Sheet 4: Submission order
      const submissionOrderRows = [...exportAttemptOrder]
        .filter((a) => a.status === "submitted" && a.submittedAt)
        .sort(
          (a, b) =>
            new Date(a.submittedAt!).getTime() -
            new Date(b.submittedAt!).getTime(),
        )
        .map((a, idx) => {
          const participant = resolveAttemptParticipant(a, students);
          const startedMs = a.startedAt
            ? new Date(a.startedAt).getTime()
            : null;
          const subMs = a.submittedAt
            ? new Date(a.submittedAt).getTime()
            : null;
          const timeTakenSeconds =
            startedMs != null && subMs != null
              ? Math.max(0, Math.round((subMs - startedMs) / 1000))
              : "";
          return {
            submissionRank: idx + 1,
            studentName: participant.name,
            studentId: participant.studentId,
            marksObtained: a.score ?? "",
            maxMarks: a.maxScore ?? totalMarks,
            percentage: percentFromAttempt(a, totalMarks) ?? "",
            submittedAt: toIsoOrEmpty(a.submittedAt),
            timeTakenSeconds,
          };
        });

      const ws = XLSX.utils.json_to_sheet(rankedResultRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ranked results");

      const ws2 = XLSX.utils.json_to_sheet(questionByQuestionRows);
      XLSX.utils.book_append_sheet(wb, ws2, "QuestionByQuestion");

      const ws3 = XLSX.utils.json_to_sheet(wideRows);
      XLSX.utils.book_append_sheet(wb, ws3, "Wide");

      const ws4 = XLSX.utils.json_to_sheet(submissionOrderRows);
      XLSX.utils.book_append_sheet(wb, ws4, "Submission order");

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

  const clearResponses = async () => {
    if (!test) return;
    if (attempts.length === 0) {
      alert("No responses to remove.");
      return;
    }

    const ok = window.confirm(
      `Remove all ${attempts.length} response(s) for "${test.title}"?\n\nThis deletes submitted and in-progress attempts. Students can take the test again if it is still available.`,
    );
    if (!ok) return;

    const typed = window.prompt(
      'Type "REMOVE" to confirm deleting all responses for this test.',
    );
    if (typed !== "REMOVE") return;

    setClearingResponses(true);
    try {
      const deleted = await deleteAttemptsForAdmin(testId);
      setAttempts([]);
      alert(`Removed ${deleted} response(s).`);
    } catch (e) {
      console.error(e);
      alert(
        "Failed to remove responses. Check admin permissions and try again.",
      );
    } finally {
      setClearingResponses(false);
    }
  };

  const rejoinNeedsApproval = (attempt: ExamAttempt) => {
    if (attempt.status !== "in_progress") return false;
    if (!attempt.rejoinRequestedAt) return false;
    if (!attempt.rejoinApprovedAt) return true;
    return attempt.rejoinApprovedAt < attempt.rejoinRequestedAt;
  };

  const approveRejoin = async (attempt: ExamAttempt) => {
    setApprovingRejoinUid(attempt.uid);
    try {
      await approveRejoinForAdmin(testId, attempt.uid);
      const approvedAt = new Date().toISOString();
      setAttempts((prev) =>
        prev.map((item) =>
          item.uid === attempt.uid
            ? { ...item, rejoinApprovedAt: approvedAt }
            : item,
        ),
      );
    } catch (e) {
      console.error(e);
      alert("Failed to approve rejoin. Check admin permissions and try again.");
    } finally {
      setApprovingRejoinUid(null);
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
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/tests/${testId}/response-sheets`)}
          >
            <Download className="w-4 h-4 mr-2" />
            Response PDFs
          </Button>
          <Button
            variant="outline"
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
            onClick={() => void clearResponses()}
            disabled={clearingResponses || attempts.length === 0}
          >
            {clearingResponses ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span className="ml-2">
              {clearingResponses ? "Removing..." : "Remove Responses"}
            </span>
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void exportExcel()}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="ml-2">Download Excel</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Attempts & Rankings</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Part A: Mathematics (35 Q) • Part B: Statistics (35 Q) • Part C:
              Economics (35 Q) • 1.5 marks / question
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {threeSectionRows.length} total
          </Badge>
        </CardHeader>
        <CardContent>
          {threeSectionRows.length === 0 ? (
            <div className="text-sm text-slate-500">No attempts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-12 text-center font-bold text-slate-900">
                      S.No.
                    </TableHead>
                    <TableHead className="w-14 text-center font-bold text-slate-900">
                      Rank
                    </TableHead>
                    <TableHead className="font-bold text-slate-900 min-w-[180px]">
                      Student Name
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900">
                      <div>PART-A (MATHS)</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Correct / {sectionInfo.partA.totalQuestions} (x1.5 M)
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900">
                      <div>PART-B (STAT)</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Correct / {sectionInfo.partB.totalQuestions} (x1.5 M)
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900">
                      <div>PART-C (ECO)</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Correct / {sectionInfo.partC.totalQuestions} (x1.5 M)
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-bold text-emerald-800">
                      <div>Total Correct</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Questions
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-bold text-indigo-900">
                      <div>Grand Total</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Marks
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900">
                      Status
                    </TableHead>
                    <TableHead className="text-center font-bold text-slate-900">
                      Action / Rejoin
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threeSectionRows.map((r) => {
                    const a = r.rawAttempt;
                    return (
                      <TableRow
                        key={a.id || a.uid}
                        className="hover:bg-slate-50"
                      >
                        <TableCell className="text-center font-medium text-slate-600 tabular-nums">
                          {r.sNo}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-900 tabular-nums">
                          {r.rank}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="font-semibold text-slate-900">
                            {r.studentName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.studentId ? `ID: ${r.studentId} • ` : ""}
                            {r.studentEmail || a.uid}
                          </div>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          <span className="font-bold text-slate-900">
                            {r.partA.correct}
                          </span>
                          <span className="text-xs text-slate-500">
                            {" "}
                            / {sectionInfo.partA.totalQuestions}
                          </span>
                          <span className="block text-xs font-semibold text-indigo-600">
                            ({r.partA.marks} M)
                          </span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          <span className="font-bold text-slate-900">
                            {r.partB.correct}
                          </span>
                          <span className="text-xs text-slate-500">
                            {" "}
                            / {sectionInfo.partB.totalQuestions}
                          </span>
                          <span className="block text-xs font-semibold text-indigo-600">
                            ({r.partB.marks} M)
                          </span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          <span className="font-bold text-slate-900">
                            {r.partC.correct}
                          </span>
                          <span className="text-xs text-slate-500">
                            {" "}
                            / {sectionInfo.partC.totalQuestions}
                          </span>
                          <span className="block text-xs font-semibold text-indigo-600">
                            ({r.partC.marks} M)
                          </span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold px-2 py-0.5 text-sm">
                            {r.totalCorrect}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          <span className="text-base font-extrabold text-indigo-900">
                            {r.grandTotalMarks}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {r.status === "submitted" ? (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Submitted
                            </Badge>
                          ) : (
                            <Badge className="bg-indigo-100 text-indigo-800">
                              In progress
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rejoinNeedsApproval(a) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-amber-200 text-amber-800 hover:bg-amber-50"
                              onClick={() => void approveRejoin(a)}
                              disabled={approvingRejoinUid === a.uid}
                            >
                              {approvingRejoinUid === a.uid ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                              )}
                              Approve
                            </Button>
                          ) : a.rejoinApprovedAt ? (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Approved
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
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
