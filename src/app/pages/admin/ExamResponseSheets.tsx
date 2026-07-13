import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useData } from "../../context/DataContext";
import {
  getExamTest,
  listAttemptsForAdmin,
  listPrivateQuestions,
  listPublicQuestions,
} from "../../features/exams/examApi";
import { resolveAttemptParticipant } from "../../features/exams/adminTestReportUtils";
import { formatExamBatchLabel } from "../../features/exams/examBatchUtils";
import { openResponseSheetInTab, safeResponseSheetFileName } from "../../features/exams/responseSheetPdf";
import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "../../features/exams/types";
import bannerImage from "../../../banner.jpeg";
import { Download, FileText } from "lucide-react";

export default function ExamResponseSheets() {
  const { id } = useParams();
  const testId = id || "";
  const { students, batches } = useData();
  const [loading, setLoading] = useState(true);
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
          listPublicQuestions(testId),
          listPrivateQuestions(testId).catch(() => null),
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
    void load();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const submittedAttempts = useMemo(() => {
    return attempts
      .filter((a) => a.status === "submitted")
      .sort((a, b) => {
        const pa = resolveAttemptParticipant(a, students);
        const pb = resolveAttemptParticipant(b, students);
        return (pa.name || pa.email || a.uid).localeCompare(pb.name || pb.email || b.uid);
      });
  }, [attempts, students]);

  const batchLabel = useMemo(() => (test ? formatExamBatchLabel(test, batches) : ""), [batches, test]);

  const downloadAttempt = (attempt: ExamAttempt) => {
    if (!test) return;
    const participant = resolveAttemptParticipant(attempt, students);
    openResponseSheetInTab(
      {
        test,
        attempt,
        questions,
        keys,
        participant,
        bannerImage,
        photoURL: participant.photoURL,
        generatedBy: "admin",
      },
      safeResponseSheetFileName(`${test.title}-${participant.name || participant.email || attempt.uid}-response-sheet`),
    );
  };

  if (loading) {
    return (
      <div className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading response sheets...
      </div>
    );
  }

  if (!test) return <div className="text-sm text-slate-500">Test not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
            <FileText className="w-3.5 h-3.5" />
            Response sheet PDFs
          </div>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Download individual response sheets</h2>
          <p className="mt-1 text-sm text-slate-600">
            {test.title} • {batchLabel} • {submittedAttempts.length} submitted student
            {submittedAttempts.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant="outline" className="self-start">
          {questions.length} questions
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Students</CardTitle>
        </CardHeader>
        <CardContent>
          {submittedAttempts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No submitted attempts yet. Response sheets appear here after students complete the exam.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedAttempts.map((attempt) => {
                    const participant = resolveAttemptParticipant(attempt, students);
                    const answered = Object.values(attempt.answers || {}).filter((v) => v != null).length;
                    const fileName = safeResponseSheetFileName(
                      `${test.title}-${participant.name || participant.email || attempt.uid}-response-sheet`,
                    );
                    return (
                      <TableRow key={attempt.id}>
                        <TableCell className="min-w-[260px]">
                          <div className="font-medium text-slate-900">{participant.name || "Unknown"}</div>
                          <div className="text-xs text-slate-600">
                            {participant.studentId || participant.email || attempt.uid}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-slate-900">
                            {attempt.score ?? 0} / {attempt.maxScore ?? test.totalMarks}
                          </div>
                          <div className="text-xs text-slate-500">
                            Answered {answered} / {questions.length}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            title={`${fileName}.pdf`}
                            onClick={() => downloadAttempt(attempt)}
                          >
                            <Download className="w-4 h-4 mr-2" />Open PDF
                          </Button>
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
