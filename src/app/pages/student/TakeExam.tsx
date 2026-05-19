import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import bannerImage from "../../../banner.jpeg";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../components/ui/utils";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { PLATFORM_INSTRUCTIONS_TEXT } from "./cbtInstructions";
import instruction1 from "../../../instructions/1.jpg";
import instruction2 from "../../../instructions/2.jpg";
import instruction3 from "../../../instructions/3.jpg";
import instruction4 from "../../../instructions/4.jpg";
import instruction5 from "../../../instructions/5.jpg";
import instruction6 from "../../../instructions/6.jpg";
import instruction7 from "../../../instructions/7.jpg";
import instruction8 from "../../../instructions/8.jpg";
import instruction9 from "../../../instructions/9.jpg";
import {
  getAttempt,
  getExamTest,
  listPrivateQuestions,
  listPublicQuestions,
  saveAttemptProgress,
  startAttempt,
} from "../../features/exams/examApi";
import { resolveStudentPhotoDisplayUrl } from "../../features/students/studentPhotoUrl";
import type {
  ExamQuestionPrivate,
  ExamQuestionPublic,
  ExamShowAnswersAfter,
  ExamTest,
} from "../../features/exams/types";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Clock, Flag, Loader2, Save, XCircle } from "lucide-react";
import { submitAttempt } from "../../features/exams/examApi";
import { sha256Base64 } from "../../features/exams/password";
import { ExamQuestionImageFrame } from "../../components/exams/ExamQuestionImageFrame";
import { canStartNewExamAttempt } from "../../features/exams/examAvailability";
import { allowsPasscodeGuestAccess } from "../../features/exams/settings";

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

/** Passport-style label initials when no photo URL. */
function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
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
  const studentPhotoSrc = useMemo(
    () => resolveStudentPhotoDisplayUrl(user?.photoURL),
    [user?.photoURL],
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [test, setTest] = useState<ExamTest | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [correctKeys, setCorrectKeys] = useState<ExamQuestionPrivate[] | null>(null);

  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwVerified, setPwVerified] = useState(false);
  const [pwChecking, setPwChecking] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [visited, setVisited] = useState<Record<string, true>>({});
  const [attemptStartedAtIso, setAttemptStartedAtIso] = useState<string | null>(null);
  const [attemptSubmittedAtIso, setAttemptSubmittedAtIso] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<"in_progress" | "submitted" | null>(null);
  const [score, setScore] = useState<{ score: number; maxScore: number } | null>(null);
  const [closedForNewAttempts, setClosedForNewAttempts] = useState(false);

  const autosaveTimer = useRef<number | null>(null);

  const nowTick = useNowTicker(1000);

  const testId = id || "";
  const uid = user?.id || "";
  const isGuestParticipant =
    user?.isGuestExamParticipant === true && user.guestExamTestId === testId;
  const pwSessionKey = useMemo(() => `exam_pw_ok:${testId}:${uid}`, [testId, uid]);
  const instructionsSessionKey = useMemo(() => `cbt_instr_ok:${testId}:${uid}`, [testId, uid]);
  const [instructionsOk, setInstructionsOk] = useState(false);
  const [instructionsChecked, setInstructionsChecked] = useState(false);

  useEffect(() => {
    if (!uid || !testId) return;
    setInstructionsOk(sessionStorage.getItem(instructionsSessionKey) === "1");
  }, [instructionsSessionKey, testId, uid]);

  const endAtMs = test ? new Date(test.endAt).getTime() : 0;

  const attemptStartedAtMs = attemptStartedAtIso
    ? new Date(attemptStartedAtIso).getTime()
    : null;

  const durationMs = (test?.durationMinutes || 0) * 60 * 1000;
  const hardEndMs = useMemo(() => {
    if (!test || !attemptStartedAtMs) return null;
    // Exam ends strictly by duration from attempt start (no fixed schedule window).
    return attemptStartedAtMs + durationMs;
  }, [attemptStartedAtMs, durationMs, test]);
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
        const t = await getExamTest(testId);
        if (!t) throw new Error("Exam not found");
        if (cancelled) return;

        setTest(t);

        const guestOk = isGuestParticipant && allowsPasscodeGuestAccess(t);
        const alreadyOk = sessionStorage.getItem(pwSessionKey) === "1";
        setPwVerified(!t.accessPasswordHash || alreadyOk || guestOk);
        if (guestOk) sessionStorage.setItem(pwSessionKey, "1");
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
  }, [isGuestParticipant, pwSessionKey, testId, uid]);

  useEffect(() => {
    if (!uid || !testId) return;
    if (!test) return;
    if (test.accessPasswordHash && !pwVerified) return;
    if (!instructionsOk) return;
    let cancelled = false;

    const loadQuestionsAndAttempt = async () => {
      setLoading(true);
      try {
        const qs = await listPublicQuestions(testId);
        if (cancelled) return;
        setQuestions(qs);

        const attempt = await getAttempt(testId, uid);
        if (cancelled) return;

        if (!attempt) {
          if (!canStartNewExamAttempt(test)) {
            setClosedForNewAttempts(true);
            setQuestions(qs);
            return;
          }
          setClosedForNewAttempts(false);
          const startMs = Date.now();
          const hardEnd = new Date(startMs + (test.durationMinutes || 0) * 60 * 1000).toISOString();
          await startAttempt({
            testId,
            uid,
            batchId: test.batchId,
            studentRecordId: user?.studentRecordId,
            participantName: isGuestParticipant ? user?.name : undefined,
            participantEmail: isGuestParticipant ? user?.email : undefined,
            isGuest: isGuestParticipant,
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
          setClosedForNewAttempts(false);
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

    void loadQuestionsAndAttempt();
    return () => {
      cancelled = true;
    };
  }, [
    pwVerified,
    instructionsOk,
    test,
    testId,
    uid,
    user?.batchId,
    isGuestParticipant,
    user?.email,
    user?.name,
    user?.studentRecordId,
  ]);

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
        // Keep UI simple: show only when user is actively taking the exam.
        // This avoids silent failure when Firestore rules/network blocks writes.
        // eslint-disable-next-line no-alert
        alert("Autosave failed. Please click Save manually once.");
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

  const handleManualSave = async () => {
    if (!uid || !testId) return;
    try {
      setSaving(true);
      await saveAttemptProgress({ testId, uid, answers, markedForReview });
    } catch (e) {
      console.error("Manual save failed", e);
      alert("Save failed. Please check your internet and try again.");
    } finally {
      setSaving(false);
    }
  };

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
      navigate(`/student/tests/${testId}/result`, {
        replace: true,
        state: { allowPdfDownload: true },
      });
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
    const effectiveEndAtMs = hardEndMs ?? endAtMs;
    const can =
      canShowAnswers({ showAnswersAfter: test.showAnswersAfter, nowMs: nowTick, endAtMs: effectiveEndAtMs }) ||
      false;
    return can;
  }, [endAtMs, hardEndMs, isAttemptSubmitted, nowTick, test]);

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

  const canAccessAsGuest =
    isGuestParticipant && allowsPasscodeGuestAccess(test) && user.guestExamTestId === testId;

  if (!canAccessAsGuest && (!user.batchId || user.batchId !== test.batchId)) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>
          This exam is not available for your batch. If you have a passcode, use{" "}
          <a href="/student/join-test" className="underline font-medium">
            Join with passcode
          </a>
          .
        </AlertDescription>
      </Alert>
    );
  }

  if (closedForNewAttempts && !attemptStatus) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4 text-center">
            <XCircle className="w-10 h-10 text-slate-400 mx-auto" />
            <div>
              <div className="text-lg font-semibold text-slate-900">Test closed</div>
              <p className="text-sm text-slate-600 mt-2">
                This test is no longer accepting new attempts. If you already submitted, your result
                was shown when you finished — download the PDF from that screen only.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/student/tests")}>
              Back to schedule
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (test.accessPasswordHash && !pwVerified) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Enter test password</div>
              <div className="text-sm text-slate-600 mt-1">
                This exam is password protected. Ask your admin/trainer for the password.
              </div>
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={pwInput}
                onChange={(e) => {
                  setPwInput(e.target.value);
                  setPwError(null);
                }}
                placeholder="Password"
              />
              {pwError ? <div className="text-sm text-rose-600">{pwError}</div> : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={pwChecking || !pwInput.trim()}
                onClick={async () => {
                  if (!test.accessPasswordHash) {
                    setPwVerified(true);
                    return;
                  }
                  try {
                    setPwChecking(true);
                    const h = await sha256Base64(pwInput.trim());
                    if (h !== test.accessPasswordHash) {
                      setPwError("Wrong password. Try again.");
                      return;
                    }
                    sessionStorage.setItem(pwSessionKey, "1");
                    setPwVerified(true);
                  } catch (e) {
                    console.error(e);
                    setPwError("Could not verify password. Please try again.");
                  } finally {
                    setPwChecking(false);
                  }
                }}
              >
                {pwChecking ? "Checking..." : "Continue"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/student/tests")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!instructionsOk && !isAttemptSubmitted) {
    const tamilFriendlyFont =
      'font-["Noto_Sans_Tamil","Nirmala_UI","Latha","Hind_Madurai","Inter",system-ui,sans-serif]';
    const instructionPages = [
      instruction1,
      instruction2,
      instruction3,
      instruction4,
      instruction5,
      instruction6,
      instruction7,
      instruction8,
      instruction9,
    ];

    return (
      <div className={cn("min-h-screen bg-slate-50 p-4 sm:p-6", tamilFriendlyFont)}>
        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-2 sm:px-8 sm:py-3 bg-white border-b border-slate-200">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100">
                    Pre-test checklist
                  </div>
                  <h1 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-slate-900 truncate">
                    Instructions before you start
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
                    Read the official CBT instructions and the platform guidelines. You can start the test only after you
                    confirm you’ve read them.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-300"
                  onClick={() => navigate("/student/tests")}
                >
                  Back
                </Button>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-8 sm:py-7 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="max-h-[52vh] overflow-y-auto">
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">TNPSC CBT Instructions (Scanned)</div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Official instructions pages (Tamil + English)
                          </div>
                        </div>
                        <Badge className="bg-indigo-600 text-white">Official</Badge>
                      </div>
                      <div className="mt-4 space-y-3">
                        {instructionPages.map((src, idx) => (
                          <div
                            key={src}
                            className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                          >
                            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">Page {idx + 1} / {instructionPages.length}</span>
                            </div>
                            <img
                              src={src}
                              alt={`TNPSC CBT instructions page ${idx + 1}`}
                              className="w-full h-auto object-contain bg-white"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            Important Instructions (Our platform)
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            How to use Save/Mark/Submit properly
                          </div>
                        </div>
                        <Badge className="bg-violet-600 text-white">Platform</Badge>
                      </div>
                      <pre className={cn("mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-900", tamilFriendlyFont)}>
                        {PLATFORM_INSTRUCTIONS_TEXT.trim()}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-start gap-3 text-sm text-slate-700 select-none">
                    <Checkbox
                      checked={instructionsChecked}
                      onCheckedChange={(v) => setInstructionsChecked(v === true)}
                    />
                    <span>
                      I have read and understood the instructions. I agree to follow them during the examination.
                    </span>
                  </label>

                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={!instructionsChecked}
                    onClick={() => {
                      sessionStorage.setItem(instructionsSessionKey, "1");
                      setInstructionsOk(true);
                    }}
                  >
                    Continue to test
                  </Button>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Tip: If you get disconnected, wait for the page to recover—avoid refresh during the exam.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="h-[calc(100vh-3rem)] flex flex-col gap-4">
        <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <img
                src={bannerImage}
                alt="EduHub banner"
                className="block h-16 sm:h-20 lg:h-24 w-auto max-w-full object-contain object-left"
              />
            </div>
            <div className="w-full lg:w-auto lg:min-w-[360px] rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                  {test.title}
                </h1>
                <Badge variant="outline" className="text-xs bg-white">
                  {test.subject}
                </Badge>
                {isAttemptSubmitted ? (
                  <Badge className="bg-emerald-100 text-emerald-800">Submitted</Badge>
                ) : (
                  <Badge className="bg-indigo-100 text-indigo-800">In progress</Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <div>
                  Batch: <span className="font-semibold text-slate-800">{test.batchId}</span>
                </div>
                <div>
                  Questions: <span className="font-semibold text-slate-800">{questions.length}</span>
                </div>
                <div>
                  Total Marks: <span className="font-semibold text-slate-800">{test.totalMarks}</span>
                </div>
                <div>
                  Duration:{" "}
                  <span className="font-semibold text-slate-800">
                    {formatTimeLeft((test.durationMinutes || 0) * 60)}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  Time Left:{" "}
                  <span className={cn("font-semibold tabular-nums", timeLeftSeconds <= 60 ? "text-rose-700" : "text-slate-900")}>
                    {isAttemptSubmitted ? "00:00" : formatTimeLeft(timeLeftSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 min-h-0">
        {/* Question panel */}
        <Card className="min-h-0">
          <CardContent className="p-0 h-full flex flex-col min-h-0">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                  Q{currentIndex + 1}
                </Badge>
                <span className="text-sm text-slate-600">
                  Mark: {currentQuestion?.marks ?? 0}
                </span>
                {currentQuestion && markedForReview.includes(currentQuestion.id) && (
                  <Badge className="bg-violet-100 text-violet-800 border border-violet-200/80">Marked</Badge>
                )}
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 min-h-0 flex flex-col gap-3">
              {currentQuestion?.imageUrl ? (
                <ExamQuestionImageFrame
                  src={currentQuestion.imageUrl}
                  alt={`Question ${currentIndex + 1} figure`}
                  questionNo={currentQuestion.questionNo ?? currentIndex + 1}
                />
              ) : null}

              {currentQuestion?.text?.trim() ? (
                <div className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.text}
                </div>
              ) : null}

              <div className="mt-auto pt-2 grid grid-cols-5 gap-2 shrink-0">
                {currentQuestion?.options?.slice(0, 5).map((opt, idx) => {
                  const selected = answers[currentQuestion.id] === idx;
                  const correctIndex = correctIndexById.get(currentQuestion.id);
                  const showCorrect = showAnswers && correctIndex != null;
                  const isCorrect = showCorrect && correctIndex === idx;
                  const isWrongSelected = showCorrect && selected && correctIndex !== idx;
                  const letter = String.fromCharCode(65 + idx);
                  const label = (opt || "").trim() || letter;
                  const isLetterOnly = label.toUpperCase() === letter;

                  return (
                    <button
                      key={idx}
                      type="button"
                      title={label}
                      className={cn(
                        "h-11 rounded-xl border bg-white transition-all flex items-center justify-center gap-2",
                        "border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
                        "active:scale-[0.99]",
                        selected && "border-indigo-600 bg-indigo-600 text-white shadow-sm",
                        isCorrect && "border-emerald-600 bg-emerald-600 text-white shadow-sm",
                        isWrongSelected && "border-rose-600 bg-rose-600 text-white shadow-sm",
                      )}
                      onClick={() => handleSelect(idx)}
                      disabled={!isAttemptActive}
                    >
                      <span
                        className={cn(
                          "h-7 w-7 rounded-full grid place-items-center text-xs font-bold border",
                          selected || isCorrect || isWrongSelected
                            ? "border-white/60 bg-white/15 text-white"
                            : "border-slate-300 bg-white text-slate-700",
                        )}
                        aria-hidden="true"
                      >
                        {letter}
                      </span>
                      <span className={cn("text-sm font-semibold", isLetterOnly && "sr-only")}>
                        {label}
                      </span>
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

            <div className="border-t border-slate-200 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toggleMarkForReview();
                    goNext();
                  }}
                  disabled={!isAttemptActive || currentIndex === questions.length - 1}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Mark for Review &amp; Next
                </Button>
                <Button variant="outline" size="sm" onClick={handleClear} disabled={!isAttemptActive}>
                  Clear Response
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => void handleManualSave().then(goNext)}
                  disabled={!isAttemptActive || saving || submitting || currentIndex === questions.length - 1}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save &amp; Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <Card className="min-h-0">
          <CardContent className="p-4 h-full flex flex-col min-h-0">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Candidate</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 truncate" title={user.name}>
                    {user.name || "Student"}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {user.studentId || user.studentRecordId || "ID not available"}
                  </div>
                </div>
                <div
                  className="relative w-[84px] h-[108px] rounded-sm border-[3px] border-slate-800 bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0"
                  title="Student photo"
                >
                  {studentPhotoSrc ? (
                    <img
                      src={studentPhotoSrc}
                      alt=""
                      className="max-w-full max-h-full w-full h-full object-contain object-center"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm font-bold text-indigo-700 tabular-nums px-1 text-center select-none">
                      {initialsFromName(user.name || "Student")}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  Answered: <span className="font-semibold text-slate-900">{answeredCount}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  Marked: <span className="font-semibold text-slate-900">{reviewCount}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
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
                      ? "bg-violet-600 text-white border-violet-600"
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
              <LegendChip color="bg-violet-600" label="Marked" />
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

