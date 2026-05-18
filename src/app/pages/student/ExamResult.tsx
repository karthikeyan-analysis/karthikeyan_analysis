import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import bannerImage from "../../../banner.jpeg";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { getAttempt, getExamTest, listPrivateQuestions, listPublicQuestions } from "../../features/exams/examApi";
import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "../../features/exams/types";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
function formatEta(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

function escapeHtml(input: string) {
  return (input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    // Prefer per-attempt hard end, not schedule end.
    const hardEndAtMs = attempt.hardEndAt ? new Date(attempt.hardEndAt).getTime() : null;
    if (hardEndAtMs != null) return Date.now() >= hardEndAtMs;
    return true;
  }, [attempt, test]);

  useEffect(() => {
    if (!attempt || attempt.status !== "submitted") return;
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
  }, [attempt, keys, testId]);

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
  const studentName = user.name?.trim() || "Student";
  const studentIdValue = user.studentId?.trim() || user.studentRecordId?.trim() || "-";
  const watermarkText = `${studentName} • ${studentIdValue}`;

  const downloadPdf = () => {
    const passportInner = user.photoURL?.trim()
      ? `<img src="${escapeHtml(user.photoURL.trim())}" alt="" />`
      : `<div class="profile-fallback">${escapeHtml(initialsFromName(studentName))}</div>`;

    // Lightweight "Download as PDF": open print-friendly window and let user save as PDF.
    const rows = questions.map((q, idx) => {
      const selected = attempt.answers?.[q.id] ?? null;
      const correct = keys ? correctIndexById.get(q.id) : undefined;
      const status =
        selected == null ? "Unanswered" : correct == null ? "Answered" : selected === correct ? "Correct" : "Wrong";

      const optionsHtml = q.options
        .map((opt, oi) => {
          const isSelected = selected === oi;
          const isCorrect = correct != null && correct === oi;
          const pill = isCorrect
            ? `<span class="pill pill-correct">Correct</span>`
            : isSelected && correct != null && !isCorrect
              ? `<span class="pill pill-wrong">Your answer</span>`
              : isSelected
                ? `<span class="pill pill-selected">Your answer</span>`
                : "";
          return `<div class="opt ${isCorrect ? "opt-correct" : isSelected && correct != null && !isCorrect ? "opt-wrong" : ""}">
            <span class="opt-letter">${String.fromCharCode(65 + oi)}.</span>
            <span class="opt-text">${escapeHtml(opt)}</span>
            ${pill}
          </div>`;
        })
        .join("");

      const imgHtml = q.imageUrl
        ? `<div class="img-wrap"><img src="${escapeHtml(q.imageUrl)}" alt="Q${idx + 1}" /></div>`
        : "";

      return `<div class="q">
        <div class="q-head">
          <div class="q-title">Q${idx + 1}. ${escapeHtml(q.text || "")}</div>
          <div class="q-meta">
            <span class="badge">${q.marks} mark</span>
            <span class="badge badge-${status.toLowerCase()}">${status}</span>
          </div>
        </div>
        ${imgHtml}
        <div class="opts">${optionsHtml}</div>
      </div>`;
    });

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(test.title)} - Result</title>
  <style>
    *{box-sizing:border-box}
    body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin:24px; color:#0f172a}
    .watermark{position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:0}
    .watermark-text{font-size:42px; font-weight:800; color:#475569; opacity:.09; transform:rotate(-28deg); white-space:nowrap}
    .content{position:relative; z-index:1}
    .header-strip{display:flex; align-items:center; justify-content:center; margin-bottom:14px; border:1px solid #e2e8f0; border-radius:14px; background:#fff; padding:12px}
    .banner{display:flex; justify-content:center; align-items:center; width:100%}
    .banner img{max-height:74px; max-width:100%; object-fit:contain}
    .result-row{display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start; justify-content:space-between; margin-bottom:2px}
    .result-main{flex:1; min-width:200px}
    .profile-passport{width:92px;height:118px;border:3px solid #1e293b;border-radius:2px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-sizing:border-box}
    .profile-passport img{max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto}
    .profile-fallback{font-size:16px;font-weight:800;color:#4338ca;text-align:center;padding:4px;word-break:break-all}
    .h1{font-size:20px; font-weight:800; margin:0}
    .sub{margin-top:6px; color:#475569; font-size:12px}
    .student{margin-top:8px; display:flex; gap:8px; flex-wrap:wrap}
    .student-chip{font-size:12px; border:1px solid #cbd5e1; border-radius:999px; padding:4px 10px; background:#f8fafc}
    .kpis{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; margin-top:14px}
    .kpi{border:1px solid #e2e8f0; border-radius:12px; padding:10px}
    .kpi .l{font-size:11px; color:#64748b}
    .kpi .v{font-size:16px; font-weight:800; margin-top:2px}
    .q{border:1px solid #e2e8f0; border-radius:14px; padding:14px; margin-top:12px}
    .q-head{display:flex; justify-content:space-between; gap:12px; align-items:flex-start}
    .q-title{font-weight:700; font-size:13px; white-space:pre-wrap}
    .q-meta{display:flex; gap:8px; flex-wrap:wrap}
    .badge{border:1px solid #cbd5e1; padding:3px 8px; border-radius:999px; font-size:11px; color:#0f172a}
    .badge-correct{border-color:#86efac; background:#ecfdf5}
    .badge-wrong{border-color:#fda4af; background:#fff1f2}
    .badge-unanswered{border-color:#cbd5e1; background:#f8fafc}
    .badge-answered{border-color:#cbd5e1; background:#f8fafc}
    .img-wrap{margin-top:10px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:#f8fafc}
    img{max-width:100%; display:block}
    .opts{margin-top:10px; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px}
    .opt{border:1px solid #e2e8f0; border-radius:10px; padding:8px; font-size:12px; display:flex; gap:8px; align-items:flex-start}
    .opt-letter{font-weight:800; color:#334155}
    .opt-correct{border-color:#86efac; background:#ecfdf5}
    .opt-wrong{border-color:#fda4af; background:#fff1f2}
    .pill{margin-left:auto; font-size:10px; padding:2px 6px; border-radius:999px; border:1px solid #cbd5e1; white-space:nowrap}
    .pill-correct{border-color:#34d399; color:#065f46; background:#d1fae5}
    .pill-wrong{border-color:#fb7185; color:#881337; background:#ffe4e6}
    .pill-selected{border-color:#94a3b8; color:#334155; background:#f1f5f9}
    @media print { body{margin:12px} .opts{grid-template-columns:1fr} }
  </style>
</head>
<body>
  <div class="watermark"><div class="watermark-text">${escapeHtml(watermarkText)}</div></div>
  <div class="content">
    <div class="header-strip">
      <div class="banner"><img src="${escapeHtml(bannerImage)}" alt="EduHub banner" /></div>
    </div>
    <div class="result-row">
      <div class="result-main">
        <div class="h1">Result</div>
        <div class="sub"><b>${escapeHtml(test.title)}</b> • ${escapeHtml(test.subject)} • Submitted at: ${escapeHtml(
          attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-",
        )}</div>
        <div class="student">
          <span class="student-chip">Student Name: ${escapeHtml(studentName)}</span>
          <span class="student-chip">Student ID: ${escapeHtml(studentIdValue)}</span>
        </div>
      </div>
      <div class="profile-passport">${passportInner}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="l">Score</div><div class="v">${scoreValue} / ${maxScoreValue}</div></div>
      <div class="kpi"><div class="l">Percent</div><div class="v">${percent}%</div></div>
      <div class="kpi"><div class="l">Answered</div><div class="v">${answeredCount} / ${questions.length}</div></div>
      <div class="kpi"><div class="l">Time limit</div><div class="v">${formatEta((test.durationMinutes || 0) * 60)}</div></div>
    </div>
    ${rows.join("")}
  </div>
  <script>window.focus(); setTimeout(() => window.print(), 300);</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blocked. Please allow popups to download PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

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
                {user.photoURL?.trim() ? (
                  <img
                    src={user.photoURL.trim()}
                    alt=""
                    className="max-w-full max-h-full w-full h-full object-contain object-center"
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
                <div className="text-xs text-slate-500">Download</div>
                <div className="mt-2">
                  <Button variant="outline" onClick={downloadPdf} disabled={!keys && test.showAnswersAfter !== "never"}>
                    <Download className="w-4 h-4 mr-2" /> Download PDF
                  </Button>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Exports questions, your answers, correct answers, and score.
                </div>
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

