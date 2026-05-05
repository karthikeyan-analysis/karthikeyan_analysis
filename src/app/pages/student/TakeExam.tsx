import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../components/ui/utils";
import {
  getAttempt,
  getExamTest,
  listPrivateQuestions,
  listPublicQuestions,
  saveAttemptProgress,
  startAttempt,
} from "../../features/exams/examApi";
import type {
  ExamQuestionPrivate,
  ExamQuestionPublic,
  ExamShowAnswersAfter,
  ExamTest,
} from "../../features/exams/types";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Clock, Flag, Loader2, Save, XCircle } from "lucide-react";
import { submitAttempt } from "../../features/exams/examApi";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTimeLeft(totalSeconds: number) {
  const s = clamp(Math.floor(totalSeconds), 0, Number.MAX_SAFE_INTEGER);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function canShowAnswers(params: {
  showAnswersAfter: ExamShowAnswersAfter;
  nowMs: number;
  endAtMs: number;
}) {
  if (params.showAnswersAfter === "never") return false;
  if (params.showAnswersAfter === "after_end") return params.nowMs >= params.endAtMs;
  return true;
}

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [test, setTest] = useState<ExamTest | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [correctKeys, setCorrectKeys] = useState<ExamQuestionPrivate[] | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [visited, setVisited] = useState<Record<string, true>>({});
  const [attemptStartedAtIso, setAttemptStartedAtIso] = useState<string | null>(null);
  const [attemptSubmittedAtIso, setAttemptSubmittedAtIso] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<"in_progress" | "submitted" | null>(null);
  const [score, setScore] = useState<{ score: number; maxScore: number } | null>(null);

  const autosaveTimer = useRef<number | null>(null);

  const nowTick = useNowTicker(1000);

  const testId = id || "";
  const uid = user?.id || "";

  const startAtMs = test ? new Date(test.startAt).getTime() : 0;
  const endAtMs = test ? new Date(test.endAt).getTime() : 0;

  const attemptStartedAtMs = attemptStartedAtIso
    ? new Date(attemptStartedAtIso).getTime()
    : null;

  const durationMs = (test?.durationMinutes || 0) * 60 * 1000;
  const hardEndMs = useMemo(() => {
    if (!test || !attemptStartedAtMs) return null;
    // Exam ends when either duration ends (from attempt start) OR the schedule window ends.
    return Math.min(attemptStartedAtMs + durationMs, endAtMs);
  }, [attemptStartedAtMs, durationMs, endAtMs, test]);

  const isWithinWindow = test ? nowTick >= startAtMs && nowTick <= endAtMs : false;
  const isAttemptActive = attemptStatus === "in_progress";
  const isAttemptSubmitted = attemptStatus === "submitted";

  const timeLeftSeconds = hardEndMs ? Math.max(0, Math.floor((hardEndMs - nowTick) / 1000)) : 0;

  const currentQuestion = questions[currentIndex];

  const questionIdOrder = useMemo(() => questions.map((q) => q.id), [questions]);

  const answeredCount = useMemo(() => {
    return questionIdOrder.reduce((acc, qid) => (answers[qid] != null ? acc + 1 : acc), 0);
  }, [answers, questionIdOrder]);

  const reviewCount = useMemo(() => markedForReview.length, [markedForReview.length]);

  const notVisitedCount = useMemo(() => {
    const visitedCount = Object.keys(visited).length;
    return Math.max(0, questions.length - visitedCount);
  }, [questions.length, visited]);

  const paletteStatus = useMemo(() => {
    const statusById: Record<
      string,
      "not_visited" | "not_answered" | "answered" | "marked_for_review"
    > = {};

    questionIdOrder.forEach((qid) => {
      const isVisited = !!visited[qid];
      if (!isVisited) statusById[qid] = "not_visited";
      else statusById[qid] = answers[qid] == null ? "not_answered" : "answered";
      if (markedForReview.includes(qid)) statusById[qid] = "marked_for_review";
    });

    return statusById;
  }, [answers, markedForReview, questionIdOrder, visited]);

  const autoSubmitTriggered = useRef(false);

  useEffect(() => {
    if (!uid || !testId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [t, qs] = await Promise.all([getExamTest(testId), listPublicQuestions(testId)]);
        if (!t) throw new Error("Exam not found");
        if (cancelled) return;

        setTest(t);
        setQuestions(qs);

        const attempt = await getAttempt(testId, uid);
        if (cancelled) return;

        if (!attempt) {
          const startMs = Date.now();
          const hardEnd =
            t && t.endAt
              ? new Date(
                  Math.min(
                    startMs + (t.durationMinutes || 0) * 60 * 1000,
                    new Date(t.endAt).getTime(),
                  ),
                ).toISOString()
              : new Date(startMs).toISOString();
          await startAttempt({
            testId,
            uid,
            batchId: user?.batchId || "",
            studentRecordId: user?.studentRecordId,
            questionIds: qs.map((q) => q.id),
            hardEndAt: hardEnd,
          });
          setAttemptStartedAtIso(new Date().toISOString());
          setAttemptStatus("in_progress");
          const freshAnswers: Record<string, number | null> = {};
          qs.forEach((q) => (freshAnswers[q.id] = null));
          setAnswers(freshAnswers);
          setMarkedForReview([]);
          setVisited(qs.length ? { [qs[0].id]: true } : {});
        } else {
          setAttemptStartedAtIso(attempt.startedAt);
          setAttemptStatus(attempt.status);
          setAttemptSubmittedAtIso(attempt.submittedAt || null);
          setAnswers(attempt.answers || {});
          setMarkedForReview(attempt.markedForReview || []);
          const v: Record<string, true> = {};
          // Consider answered/marked as visited; also mark first question visited.
          qs.forEach((q) => {
            if (attempt.answers?.[q.id] != null) v[q.id] = true;
          });
          (attempt.markedForReview || []).forEach((qid) => {
            v[qid] = true;
          });
          if (qs[0]?.id) v[qs[0].id] = true;
          setVisited(v);
          if (attempt.status === "submitted" && attempt.score != null && attempt.maxScore != null) {
            setScore({ score: attempt.score, maxScore: attempt.maxScore });
          }
        }
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
  }, [testId, uid, user?.batchId, user?.studentRecordId]);

  // Mark current question as visited whenever you navigate.
  useEffect(() => {
    const qid = questions[currentIndex]?.id;
    if (!qid) return;
    setVisited((prev) => (prev[qid] ? prev : { ...prev, [qid]: true }));
  }, [currentIndex, questions]);

  // Periodic autosave (every 10s, debounced by latest state)
  useEffect(() => {
    if (!uid || !testId) return;
    if (!isAttemptActive) return;

    if (autosaveTimer.current) window.clearInterval(autosaveTimer.current);
    autosaveTimer.current = window.setInterval(async () => {
      try {
        setSaving(true);
        await saveAttemptProgress({ testId, uid, answers, markedForReview });
      } catch (e) {
        console.error("Autosave failed", e);
      } finally {
        setSaving(false);
      }
    }, 10_000);

    return () => {
      if (autosaveTimer.current) window.clearInterval(autosaveTimer.current);
      autosaveTimer.current = null;
    };
  }, [answers, isAttemptActive, markedForReview, testId, uid]);

  // Auto-submit when timer ends.
  useEffect(() => {
    if (!isAttemptActive) return;
    if (!hardEndMs) return;
    if (autoSubmitTriggered.current) return;
    if (nowTick < hardEndMs) return;
    autoSubmitTriggered.current = true;
    void handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardEndMs, isAttemptActive, nowTick]);

  // Lock navigation while exam is active (best-effort on web).
  useEffect(() => {
    if (!isAttemptActive) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [isAttemptActive]);

  const handleSelect = (optionIndex: number) => {
    if (!currentQuestion) return;
    if (!isAttemptActive) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
  };

  const handleClear = () => {
    if (!currentQuestion) return;
    if (!isAttemptActive) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: null }));
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    if (!isAttemptActive) return;
    setMarkedForReview((prev) => {
      const has = prev.includes(currentQuestion.id);
      if (has) return prev.filter((id) => id !== currentQuestion.id);
      return [...prev, currentQuestion.id];
    });
  };

  const goNext = () => setCurrentIndex((i) => clamp(i + 1, 0, questions.length - 1));
  const goPrev = () => setCurrentIndex((i) => clamp(i - 1, 0, questions.length - 1));

  const handleSubmit = async () => {
    if (!uid || !testId) return;
    if (!test) return;
    if (!isAttemptActive) return;

    try {
      setSubmitting(true);
      setSaving(true);
      await saveAttemptProgress({ testId, uid, answers, markedForReview });
      // Compute score (keys are readable only after submission and after hardEndAt per rules)
      const keys = await listPrivateQuestions(testId);
      setCorrectKeys(keys);
      const keyById = new Map(keys.map((k) => [k.id, k.correctIndex]));
      const neg = test?.negativeMarkPerWrong || 0;

      let s = 0;
      let max = 0;
      questions.forEach((q) => {
        max += q.marks;
        const selected = answers[q.id];
        if (selected == null) return;
        const correct = keyById.get(q.id);
        if (correct == null) return;
        if (selected === correct) s += q.marks;
        else s -= neg;
      });
      s = Math.max(0, s);

      await submitAttempt({ testId, uid, score: s, maxScore: max });
      setAttemptStatus("submitted");
      setAttemptSubmittedAtIso(new Date().toISOString());
      setScore({ score: s, maxScore: max });
      navigate(`/student/tests/${testId}/result`, { replace: true });
    } catch (e) {
      console.error("Submit failed", e);
      autoSubmitTriggered.current = false;
    } finally {
      setSubmitting(false);
      setSaving(false);
    }
  };

  const showAnswers = useMemo(() => {
    if (!test) return false;
    if (!isAttemptSubmitted) return false;
    const can =
      canShowAnswers({ showAnswersAfter: test.showAnswersAfter, nowMs: nowTick, endAtMs }) ||
      false;
    return can;
  }, [endAtMs, isAttemptSubmitted, nowTick, test]);

  const ensureCorrectKeys = async () => {
    if (!showAnswers) return;
    if (correctKeys) return;
    try {
      const keys = await listPrivateQuestions(testId);
      setCorrectKeys(keys);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void ensureCorrectKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswers]);

  const correctIndexById = useMemo(() => {
    if (!correctKeys) return new Map<string, number>();
    return new Map(correctKeys.map((k) => [k.id, k.correctIndex]));
  }, [correctKeys]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading exam...
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Exam not found</AlertTitle>
        <AlertDescription>This exam does not exist or you don&apos;t have access.</AlertDescription>
      </Alert>
    );
  }

  if (!user.batchId || user.batchId !== test.batchId) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>This exam is not available for your batch.</AlertDescription>
      </Alert>
    );
  }

  // If exam window is over, never allow starting/continuing the exam UI.
  if (nowTick > endAtMs && !isAttemptSubmitted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{test.title}</h1>
          <p className="text-slate-600 mt-1">
            Scheduled: {new Date(test.startAt).toLocaleString()} –{" "}
            {new Date(test.endAt).toLocaleString()}
          </p>
        </div>
        <Alert>
          <AlertTitle>Exam ended</AlertTitle>
          <AlertDescription>
            This exam is closed. You can only view your result.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate(`/student/tests/${testId}/result`)}
          >
            View Result
          </Button>
          <Button variant="outline" onClick={() => navigate("/student/tests")}>
            Back to schedule
          </Button>
        </div>
      </div>
    );
  }

  if (!isWithinWindow && !isAttemptSubmitted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{test.title}</h1>
          <p className="text-slate-600 mt-1">
            Scheduled: {new Date(test.startAt).toLocaleString()} –{" "}
            {new Date(test.endAt).toLocaleString()}
          </p>
        </div>
        <Alert>
          <AlertTitle>Not active yet</AlertTitle>
          <AlertDescription>
            You can start this exam only within the scheduled window.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/student/tests")}>
            Back to schedule
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="h-[calc(100vh-3rem)] flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-xl font-semibold text-slate-900 truncate">
              {test.title}
            </h1>
            <Badge variant="outline" className="text-xs">
              {test.subject}
            </Badge>
            {isAttemptSubmitted ? (
              <Badge className="bg-emerald-100 text-emerald-800">Submitted</Badge>
            ) : (
              <Badge className="bg-indigo-100 text-indigo-800">In progress</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Batch: {test.batchId} • Questions: {questions.length} • Marks: {test.totalMarks}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <div className="text-sm font-semibold text-slate-900 tabular-nums">
              {isAttemptSubmitted ? "00:00" : formatTimeLeft(timeLeftSeconds)}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!uid || !testId) return;
              try {
                setSaving(true);
                await saveAttemptProgress({ testId, uid, answers, markedForReview });
              } finally {
                setSaving(false);
              }
            }}
            disabled={!isAttemptActive || saving || submitting}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="ml-2 hidden sm:inline">Save</span>
          </Button>
          <Badge className="bg-slate-900 text-white hover:bg-slate-900">
            Auto-submit at 00:00
          </Badge>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 min-h-0">
        {/* Question panel */}
        <Card className="min-h-0">
          <CardContent className="p-0 h-full flex flex-col min-h-0">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                  Q{currentIndex + 1}
                </Badge>
                <span className="text-sm text-slate-600">
                  Mark: {currentQuestion?.marks ?? 0}
                </span>
                {currentQuestion && markedForReview.includes(currentQuestion.id) && (
                  <Badge className="bg-amber-100 text-amber-800">Marked</Badge>
                )}
              </div>
              <div className="md:hidden flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <div className="text-sm font-semibold text-slate-900 tabular-nums">
                  {isAttemptSubmitted ? "00:00" : formatTimeLeft(timeLeftSeconds)}
                </div>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <div className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap">
                {currentQuestion?.text}
              </div>

              {currentQuestion?.imageUrl ? (
                <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Question ${currentIndex + 1}`}
                    className="w-full max-h-[360px] object-contain"
                    loading="lazy"
                  />
                </div>
              ) : null}

              <div className="mt-5 space-y-2">
                {currentQuestion?.options?.map((opt, idx) => {
                  const selected = answers[currentQuestion.id] === idx;
                  const correctIndex = correctIndexById.get(currentQuestion.id);
                  const showCorrect = showAnswers && correctIndex != null;
                  const isCorrect = showCorrect && correctIndex === idx;
                  const isWrongSelected = showCorrect && selected && correctIndex !== idx;

                  return (
                    <button
                      key={idx}
                      className={cn(
                        "w-full text-left rounded-xl border px-4 py-3 transition-all",
                        selected
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                        isCorrect && "border-emerald-400 bg-emerald-50",
                        isWrongSelected && "border-rose-400 bg-rose-50",
                      )}
                      onClick={() => handleSelect(idx)}
                      disabled={!isAttemptActive}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold",
                            selected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 text-slate-700",
                            isCorrect && "border-emerald-600 bg-emerald-600 text-white",
                            isWrongSelected && "border-rose-600 bg-rose-600 text-white",
                          )}
                        >
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1 text-sm text-slate-900 whitespace-pre-wrap">
                          {opt}
                          {showCorrect && isCorrect && (
                            <span className="ml-2 text-xs font-semibold text-emerald-700">
                              (Correct)
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isAttemptSubmitted && score && (
                <div className="mt-6">
                  <Alert className="border-emerald-200 bg-emerald-50">
                    <AlertTitle className="text-emerald-900">Result</AlertTitle>
                    <AlertDescription className="text-emerald-800">
                      Score: <span className="font-semibold">{score.score}</span> /{" "}
                      <span className="font-semibold">{score.maxScore}</span>
                      {attemptSubmittedAtIso ? (
                        <span className="block mt-1 text-xs text-emerald-700">
                          Submitted at: {new Date(attemptSubmittedAtIso).toLocaleString()}
                        </span>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMarkForReview}
                  disabled={!isAttemptActive}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  {currentQuestion && markedForReview.includes(currentQuestion.id)
                    ? "Unmark"
                    : "Mark"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={!isAttemptActive}
                >
                  Clear Response
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <Card className="min-h-0">
          <CardContent className="p-4 h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Question Palette</div>
              <div className="text-xs text-slate-500">
                {answeredCount}/{questions.length} answered
              </div>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-2">
              {questions.map((q, idx) => {
                const st = paletteStatus[q.id];
                const isCurrent = idx === currentIndex;
                const base =
                  st === "answered"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : st === "marked_for_review"
                      ? "bg-amber-500 text-white border-amber-500"
                      : st === "not_answered"
                        ? "bg-rose-500 text-white border-rose-500"
                        : "bg-white text-slate-900 border-slate-200";

                return (
                  <button
                    key={q.id}
                    className={cn(
                      "h-9 rounded-lg border text-xs font-semibold transition-all",
                      base,
                      isCurrent && "ring-2 ring-indigo-400 ring-offset-2",
                      st === "not_visited" && "hover:bg-slate-50",
                    )}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <LegendChip color="bg-emerald-600" label="Answered" />
              <LegendChip color="bg-rose-500" label="Not Answered" />
              <LegendChip color="bg-amber-500" label="Marked" />
              <LegendChip color="bg-white border border-slate-200" label="Not Visited" />
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Answered</span>
                <span className="font-semibold text-slate-900">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Marked</span>
                <span className="font-semibold text-slate-900">{reviewCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Not visited (approx)</span>
                <span className="font-semibold text-slate-900">{notVisitedCount}</span>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Exam ends only when the timer finishes.
              </div>
              {attemptStartedAtIso ? (
                <div className="mt-1 text-[11px] text-slate-500">
                  Started: {new Date(attemptStartedAtIso).toLocaleString()}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-block w-3 h-3 rounded-sm", color)} />
      <span>{label}</span>
    </div>
  );
}

function useNowTicker(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

