import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "./types";
import type { ResolvedParticipant } from "./participantUtils";
import { resolveStudentPhotoDisplayUrl } from "../students/studentPhotoUrl";

function escapeHtml(input: string) {
  return (input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatResponseSheetTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function safeResponseSheetFileName(name: string) {
  return (name || "response-sheet").replace(/[\\/:*?"<>|]+/g, "_");
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

export type ResponseSheetParticipant = Pick<
  ResolvedParticipant,
  "name" | "email" | "studentId" | "studentRecordId" | "isGuest" | "photoURL"
>;

export type ResponseSheetPdfParams = {
  test: ExamTest;
  attempt: ExamAttempt;
  questions: ExamQuestionPublic[];
  keys?: ExamQuestionPrivate[] | null;
  participant: ResponseSheetParticipant;
  bannerImage: string;
  photoURL?: string | null;
  generatedBy?: "student" | "admin";
};

export function buildResponseSheetHtml({
  test,
  attempt,
  questions,
  keys,
  participant,
  bannerImage,
  photoURL,
  generatedBy = "student",
}: ResponseSheetPdfParams) {
  const correctIndexById = new Map((keys || []).map((k) => [k.id, k.correctIndex]));
  const answeredCount = Object.values(attempt.answers || {}).filter((v) => v != null).length;
  const scoreValue = attempt.score ?? 0;
  const maxScoreValue = attempt.maxScore ?? test.totalMarks;
  const percent = maxScoreValue ? Math.round((scoreValue / maxScoreValue) * 1000) / 10 : 0;
  const studentName = participant.name || participant.email || "Student";
  const studentId = participant.studentId || participant.email || participant.studentRecordId || attempt.uid;
  const displayPhoto = resolveStudentPhotoDisplayUrl(photoURL || participant.photoURL);
  const passportInner = displayPhoto
    ? `<img src="${escapeHtml(displayPhoto)}" alt="" />`
    : `<div class="profile-fallback">${escapeHtml(initialsFromName(studentName))}</div>`;

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
          <span class="radio ${isSelected ? "radio-selected" : ""}"><span></span></span>
          <span class="opt-letter">${String.fromCharCode(65 + oi)}.</span>
          <span class="opt-text">${escapeHtml(opt)}</span>
          ${pill}
        </div>`;
      })
      .join("");

    const imgHtml = q.imageUrl
      ? `<div class="img-wrap"><img src="${escapeHtml(q.imageUrl)}" alt="Q${idx + 1}" /></div>`
      : "";

    return `<section class="q">
      <div class="q-head">
        <div class="q-title">Q${idx + 1}. ${escapeHtml(q.text || "")}</div>
        <div class="q-meta">
          <span class="badge">${q.marks} mark</span>
          <span class="badge badge-${status.toLowerCase()}">${status}</span>
        </div>
      </div>
      ${imgHtml}
      <div class="opts">${optionsHtml}</div>
    </section>`;
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(test.title)} - Response Sheet</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:20px;color:#0f172a;background:#fff}
    .watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .watermark-text{font-size:42px;font-weight:900;color:#475569;opacity:.07;transform:rotate(-28deg);white-space:nowrap}
    .content{position:relative;z-index:1}
    .top{border:1px solid #e2e8f0;border-radius:18px;padding:12px 16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;background:#fff}
    .top img{max-height:72px;max-width:100%;object-fit:contain}
    .hero{border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:linear-gradient(135deg,#f8fafc,#fff);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start}
    .label{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
    .h1{font-size:24px;font-weight:900;margin:4px 0 0}
    .sub{font-size:12px;color:#475569;margin-top:6px}
    .chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .chip{font-size:11px;border:1px solid #cbd5e1;border-radius:999px;padding:4px 10px;background:#fff;color:#334155}
    .profile-passport{width:92px;height:118px;border:3px solid #1e293b;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 18px rgba(15,23,42,.12)}
    .profile-passport img{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain}
    .profile-fallback{font-size:16px;font-weight:900;color:#4338ca;text-align:center;padding:4px}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 18px}
    .kpi{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#fff}
    .kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:800}
    .kpi .v{font-size:20px;font-weight:900;margin-top:4px}
    .q{border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-top:12px;background:#fff;break-inside:avoid}
    .q-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .q-title{font-weight:800;font-size:13px;white-space:pre-wrap;line-height:1.45}
    .q-meta{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .badge{border:1px solid #cbd5e1;padding:3px 8px;border-radius:999px;font-size:11px;color:#0f172a;background:#fff;white-space:nowrap}
    .badge-correct{border-color:#86efac;background:#ecfdf5;color:#065f46}
    .badge-wrong{border-color:#fda4af;background:#fff1f2;color:#9f1239}
    .badge-unanswered,.badge-answered{background:#f8fafc}
    .img-wrap{margin-top:10px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:8px;display:flex;align-items:center;justify-content:center}
    .img-wrap img{max-width:100%;height:auto;object-fit:contain;display:block}
    .opts{margin-top:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .opt{border:1px solid #e2e8f0;border-radius:12px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:flex-start}
    .radio{width:14px;height:14px;border:2px solid #94a3b8;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;margin-top:1px}
    .radio span{width:6px;height:6px;border-radius:999px;background:transparent}
    .radio-selected{border-color:#4f46e5}
    .radio-selected span{background:#4f46e5}
    .opt-letter{font-weight:900;color:#334155;flex:0 0 auto}
    .opt-text{flex:1}
    .opt-correct{border-color:#86efac;background:#ecfdf5}
    .opt-wrong{border-color:#fda4af;background:#fff1f2}
    .pill{margin-left:auto;font-size:10px;padding:2px 6px;border-radius:999px;border:1px solid #cbd5e1;white-space:nowrap}
    .pill-correct{border-color:#34d399;color:#065f46;background:#d1fae5}
    .pill-wrong{border-color:#fb7185;color:#881337;background:#ffe4e6}
    .pill-selected{border-color:#94a3b8;color:#334155;background:#f1f5f9}
    .footer{margin-top:16px;font-size:10px;color:#64748b;text-align:right}
    @media print{body{margin:12px}.opts{grid-template-columns:1fr}.top img{max-height:62px}.watermark-text{font-size:34px}}
  </style>
</head>
<body>
  <div class="watermark"><div class="watermark-text">${escapeHtml(`${studentName} • ${studentId}`)}</div></div>
  <main class="content">
    <div class="top"><img src="${escapeHtml(bannerImage)}" alt="Karthikeyan Analysis" /></div>
    <section class="hero">
      <div>
        <div class="label">Response Sheet</div>
        <div class="h1">${escapeHtml(test.title)}</div>
        <div class="sub">${escapeHtml(test.subject)} • Submitted: ${escapeHtml(
          attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-",
        )}</div>
        <div class="chips">
          <span class="chip">Name: ${escapeHtml(studentName)}</span>
          <span class="chip">ID: ${escapeHtml(studentId)}</span>
          <span class="chip">${participant.isGuest ? "Guest participant" : "Enrolled student"}</span>
        </div>
      </div>
      <div class="profile-passport">${passportInner}</div>
    </section>
    <section class="kpis">
      <div class="kpi"><div class="l">Score</div><div class="v">${scoreValue} / ${maxScoreValue}</div></div>
      <div class="kpi"><div class="l">Percentage</div><div class="v">${percent}%</div></div>
      <div class="kpi"><div class="l">Answered</div><div class="v">${answeredCount} / ${questions.length}</div></div>
      <div class="kpi"><div class="l">Duration</div><div class="v">${formatResponseSheetTime((test.durationMinutes || 0) * 60)}</div></div>
    </section>
    ${rows.join("")}
    <div class="footer">Generated by ${generatedBy === "admin" ? "Admin Panel" : "Student Portal"} • ${escapeHtml(new Date().toLocaleString())}</div>
  </main>
  <script>window.focus(); setTimeout(() => window.print(), 350);</script>
</body>
</html>`;
}

export function openResponseSheetPdf(params: ResponseSheetPdfParams) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup blocked. Please allow popups to download PDF.");
    return;
  }
  w.document.open();
  w.document.write(buildResponseSheetHtml(params));
  w.document.close();
}
