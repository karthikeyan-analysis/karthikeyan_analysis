import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { getAttempt, getExamTest, listPrivateQuestions, listPublicQuestions } from "../../features/exams/examApi";
import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "../../features/exams/types";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function ExamResult() {
  const { id } = useParams();
  const testId = id || "";
  const { user } = useAuth();
  const navigate = useNavigate();

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
    return Date.now() >= new Date(test.endAt).getTime();
  }, [attempt, test]);

  useEffect(() => {
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
  }, [canShowAnswers, keys, testId]);

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
        <Button onClick={() => navigate(`/student/tests/${testId}`)}>Back to exam</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
          </div>
          <Button variant="outline" onClick={() => navigate("/student/tests")}>
            Back to schedule
          </Button>
        </div>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Policy</div>
                <div className="text-lg font-semibold text-slate-900">
                  {test.showAnswersAfter === "never"
                    ? "Answers hidden"
                    : test.showAnswersAfter === "immediate"
                      ? "Answers after submit"
                      : "Answers after end"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">Review</div>
              {canShowAnswers ? (
                <Badge className="bg-indigo-100 text-indigo-800">Correct answers visible</Badge>
              ) : (
                <Badge variant="outline">Correct answers hidden</Badge>
              )}
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => {
                const selected = attempt.answers?.[q.id] ?? null;
                const correct = canShowAnswers ? correctIndexById.get(q.id) : undefined;
                return (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">
                        Q{idx + 1}. <span className="font-normal whitespace-pre-wrap">{q.text}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {q.marks} mark
                      </Badge>
                    </div>
                    {q.imageUrl ? (
                      <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <img src={q.imageUrl} alt={`Q${idx + 1}`} className="w-full max-h-[360px] object-contain" />
                      </div>
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

