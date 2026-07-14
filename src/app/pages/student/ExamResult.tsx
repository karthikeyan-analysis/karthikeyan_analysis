import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ExamQuestionImageFrame } from "../../components/exams/ExamQuestionImageFrame";
import { getAttempt, getExamTest, listPrivateQuestions, listPublicQuestions } from "../../features/exams/examApi";
import StudentPhotoImage from "../../components/StudentPhotoImage";
import { useStudentPhoto } from "../../features/students/useStudentPhoto";
import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "../../features/exams/types";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

export default function ExamResult() {
  const { id } = useParams();
  const testId = id || "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const { photoURL, displaySrc: studentPhotoSrc } = useStudentPhoto();

  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<ExamTest | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [keys, setKeys] = useState<ExamQuestionPrivate[] | null>(null);

  useEffect(() => {
    if (!testId || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, a, qs] = await Promise.all([
          getExamTest(testId),
          getAttempt(testId, user.id),
          listPublicQuestions(testId),
        ]);
        if (cancelled) return;
        setTest(t);
        setAttempt(a);
        setQuestions(qs);
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
  }, [testId, user?.id]);

  const canShowAnswers = useMemo(() => {
    if (!test || !attempt) return false;
    if (attempt.status !== "submitted") return false;
    if (test.showAnswersAfter === "never") return false;
    if (test.showAnswersAfter === "immediate") return true;
    // Prefer per-attempt hard end, not schedule end.
    const hardEndAtMs = attempt.hardEndAt ? new Date(attempt.hardEndAt).getTime() : null;
    if (hardEndAtMs != null) return Date.now() >= hardEndAtMs;
    return true;
  }, [attempt, test]);

  useEffect(() => {
    if (!attempt || attempt.status !== "submitted") return;
    if (!canShowAnswers) return;
    if (keys) return;
    let cancelled = false;
    const load = async () => {
      try {
        const k = await listPrivateQuestions(testId);
        if (!cancelled) setKeys(k);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt, canShowAnswers, keys, testId]);

  // No Cloud Functions: attempt.score is written by client at auto-submit.

  const correctIndexById = useMemo(() => {
    if (!keys) return new Map<string, number>();
    return new Map(keys.map((k) => [k.id, k.correctIndex]));
  }, [keys]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading result...
      </div>
    );
  }

  if (!test) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Exam not found</AlertTitle>
        <AlertDescription>Invalid exam id.</AlertDescription>
      </Alert>
    );
  }

  if (!attempt) {
    return (
      <Alert>
        <AlertTitle>No attempt found</AlertTitle>
        <AlertDescription>You haven’t started this exam yet.</AlertDescription>
      </Alert>
    );
  }

  if (attempt.status !== "submitted") {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Result not ready</AlertTitle>
          <AlertDescription>
            This exam will be submitted automatically when the timer ends.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/student/tests")}>Back to schedule</Button>
      </div>
    );
  }

  const answeredCount = Object.values(attempt.answers || {}).filter((v) => v != null).length;
  const scoreValue = attempt.score ?? 0;
  const maxScoreValue = attempt.maxScore ?? test.totalMarks;
  const percent = maxScoreValue ? Math.round((scoreValue / maxScoreValue) * 1000) / 10 : 0;
  const studentName =
    attempt?.participantName?.trim() ||
    user.name?.trim() ||
    attempt?.participantEmail?.trim() ||
    "Student";
  const studentIdValue = user.isGuestExamParticipant
    ? user.email?.trim() || "Guest"
    : user.studentId?.trim() || user.studentRecordId?.trim() || "-";


  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-4 flex justify-center">
          <img
            src={bannerImage}
            alt="EduHub banner"
            className="block h-auto max-h-24 sm:max-h-28 w-auto max-w-full object-contain"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-1 flex-col sm:flex-row sm:gap-6 min-w-0 items-stretch">
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 truncate">
                Result
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline">{test.title}</Badge>
                <Badge variant="outline">{test.subject}</Badge>
                <Badge className="bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Submitted
                </Badge>
              </div>
              <div className="text-sm text-slate-600 mt-2">
                Submitted at: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-"}
              </div>
              <div className="text-sm text-slate-700 mt-1">
                Student Name: <span className="font-semibold text-slate-900">{studentName}</span>
                {" • "}Student ID: <span className="font-semibold text-slate-900">{studentIdValue}</span>
              </div>
            </div>
            <div className="flex justify-end sm:flex-none shrink-0 sm:mt-1">
              <div
                className="relative w-[92px] h-[118px] rounded-sm border-[3px] border-slate-800 bg-white flex items-center justify-center overflow-hidden shadow-sm"
                title="Student photo"
              >
                {photoURL ? (
                  <StudentPhotoImage
                    photoURL={photoURL}
                    imgClassName="max-w-full max-h-full w-full h-full object-contain object-center"
                    fallback={
                      <span className="text-base font-bold text-indigo-700 tabular-nums px-1 text-center select-none">
                        {initialsFromName(studentName)}
                      </span>
                    }
                  />
                ) : (
                  <span className="text-base font-bold text-indigo-700 tabular-nums px-1 text-center select-none">
                    {initialsFromName(studentName)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" className="self-end sm:self-start shrink-0" onClick={() => navigate("/student/tests")}>
            Back to schedule
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Score</div>
                <div className="text-3xl font-bold text-slate-900">
                  {attempt.score ?? 0} / {attempt.maxScore ?? test.totalMarks}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Answered</div>
                <div className="text-3xl font-bold text-slate-900">
                  {Object.values(attempt.answers || {}).filter((v) => v != null).length} / {questions.length}
                </div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Response sheet</div>
                <div className="mt-2">
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => navigate(`/student/tests/${testId}/response-sheet`)}
                  >
                    <Download className="w-4 h-4 mr-2" /> View Response Sheet
                  </Button>
                </div>
                <p className="text-[11px] text-indigo-800/80 mt-2">
                  Download your full response sheet after completing the exam.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">Review</div>
              {keys ? (
                <Badge className="bg-emerald-100 text-emerald-800">Correct answers shown</Badge>
              ) : canShowAnswers ? (
                <Badge variant="outline">Loading correct answers…</Badge>
              ) : (
                <Badge variant="outline">Correct answers hidden</Badge>
              )}
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => {
                const selected = attempt.answers?.[q.id] ?? null;
                const correct = keys ? correctIndexById.get(q.id) : undefined;
                const status =
                  selected == null
                    ? "unanswered"
                    : correct == null
                      ? "answered"
                      : selected === correct
                        ? "correct"
                        : "wrong";
                return (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">
                        Q{idx + 1}. <span className="font-normal whitespace-pre-wrap">{q.text}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {q.marks} mark
                        </Badge>
                        <Badge
                          className={
                            status === "correct"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "wrong"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-800"
                          }
                        >
                          {status === "correct"
                            ? "Correct"
                            : status === "wrong"
                              ? "Wrong"
                              : selected == null
                                ? "Unanswered"
                                : "Answered"}
                        </Badge>
                      </div>
                    </div>
                    {q.imageUrl ? (
                      <ExamQuestionImageFrame
                        src={q.imageUrl}
                        alt={`Question ${idx + 1} figure`}
                        questionNo={q.questionNo ?? idx + 1}
                        className="mt-3"
                      />
                    ) : null}

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((o, oi) => {
                        const isSelected = selected === oi;
                        const isCorrect = correct != null && correct === oi;
                        return (
                          <div
                            key={oi}
                            className={[
                              "rounded-lg border px-3 py-2 text-sm",
                              isCorrect ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white",
                              isSelected && !isCorrect ? "border-rose-300 bg-rose-50" : "",
                            ].join(" ")}
                          >
                            <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                            {o}
                            {isSelected ? <span className="ml-2 text-xs text-slate-500">(Your answer)</span> : null}
                            {isCorrect ? <span className="ml-2 text-xs font-semibold text-emerald-700">(Correct)</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

