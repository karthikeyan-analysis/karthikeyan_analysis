import type { ExamAttempt, ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "./types";
import type { ResolvedParticipant } from "./participantUtils";
import { getStudentPhotoDisplayCandidates } from "../students/studentPhotoUrl";

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

function jsonAttr(value: string[]) {
  return escapeHtml(JSON.stringify(value));
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
  const photoCandidates = getStudentPhotoDisplayCandidates(photoURL || participant.photoURL);
  const passportInner = photoCandidates.length
    ? `<img src="${escapeHtml(photoCandidates[0])}" data-fallback-srcs="${jsonAttr(photoCandidates)}" data-fallback-index="0" alt="" />`
    : `<div class="profile-fallback">${escapeHtml(initialsFromName(studentName))}</div>`;
  const submittedLabel = attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-";
  const generatedLabel = new Date().toLocaleString();

  const questionStatuses = questions.map((q) => {
    const selected = attempt.answers?.[q.id] ?? null;
    const correct = keys ? correctIndexById.get(q.id) : undefined;
    const status =
      selected == null ? "Unanswered" : correct == null ? "Answered" : selected === correct ? "Correct" : "Wrong";
    return { selected, correct, status };
  });

  const correctCount = questionStatuses.filter((q) => q.status === "Correct").length;
  const wrongCount = questionStatuses.filter((q) => q.status === "Wrong").length;
  const unansweredCount = questionStatuses.filter((q) => q.status === "Unanswered").length;

  const rows = questions.map((q, idx) => {
    const { selected, correct, status } = questionStatuses[idx]!;
    const selectedLetter =
      selected == null || typeof selected !== "number" ? "-" : String.fromCharCode(65 + selected);
    const correctLetter =
      correct == null || typeof correct !== "number" ? "-" : String.fromCharCode(65 + correct);

    const optionsHtml = q.options
      .map((opt, oi) => {
        const isSelected = selected === oi;
        const isCorrect = correct != null && correct === oi;
        const marker = isCorrect
          ? `<span class="option-note correct-note">Correct</span>`
          : isSelected
            ? `<span class="option-note selected-note">Selected</span>`
            : "";
        return `<div class="option-line ${isCorrect ? "is-correct" : ""} ${isSelected && !isCorrect ? "is-selected" : ""}">
          <span class="option-letter">${String.fromCharCode(65 + oi)}.</span>
          <span class="option-text">${escapeHtml(opt)}</span>${marker}
        </div>`;
      })
      .join("");

    const imgHtml = q.imageUrl
      ? `<div class="img-wrap"><img src="${escapeHtml(q.imageUrl)}" alt="Q${idx + 1}" /></div>`
      : "";

    return `<section class="question-row">
      <div class="q-head">
        <div class="q-title">Q${idx + 1}. ${escapeHtml(q.text || "")}</div>
        <div class="q-meta">
          <span>${q.marks} mark${Number(q.marks || 0) === 1 ? "" : "s"}</span>
          <span class="status status-${status.toLowerCase()}">${status}</span>
        </div>
      </div>
      ${imgHtml}
      <div class="options-list">${optionsHtml}</div>
      <div class="answer-summary">
        <span>Your answer: <strong>${escapeHtml(selectedLetter)}</strong></span>
        <span>Correct answer: <strong>${escapeHtml(correctLetter)}</strong></span>
      </div>
    </section>`;
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(test.title)} - Response Sheet</title>
  <style>
    *{box-sizing:border-box}
    @page{size:A4;margin:14mm 12mm}
    body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;color:#111827;background:#fff;font-size:12px;line-height:1.45}
    .watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .watermark-text{font-size:42px;font-weight:900;color:#64748b;opacity:.045;transform:rotate(-28deg);white-space:nowrap}
    .content{position:relative;z-index:1}
    .sheet-header{border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:12px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center}
    .brand{display:flex;align-items:center;gap:12px;min-width:0}
    .brand img{height:58px;max-width:220px;object-fit:contain}
    .doc-title{text-align:right}
    .doc-title .eyebrow{font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#4f46e5}
    .doc-title h1{font-size:20px;line-height:1.1;margin:4px 0 0;color:#111827}
    .exam-title{font-size:14px;font-weight:800;margin:0 0 3px;color:#111827}
    .muted{color:#64748b}
    .candidate-block{display:grid;grid-template-columns:1fr 96px;gap:14px;margin-bottom:12px}
    .info-card{border:1px solid #d1d5db;border-radius:10px;overflow:hidden;background:#fff}
    .section-title{background:#f3f4f6;border-bottom:1px solid #d1d5db;padding:7px 10px;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#374151}
    .info-grid{display:grid;grid-template-columns:1fr 1fr}
    .info-item{padding:8px 10px;border-bottom:1px solid #e5e7eb;min-height:43px}
    .info-item:nth-child(odd){border-right:1px solid #e5e7eb}
    .info-item:nth-last-child(-n+2){border-bottom:0}
    .info-label{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}
    .info-value{font-size:12px;font-weight:700;color:#111827;margin-top:2px}
    .profile-passport{width:96px;height:122px;border:2px solid #111827;border-radius:4px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .profile-passport img{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain}
    .profile-fallback{font-size:16px;font-weight:900;color:#4338ca;text-align:center;padding:4px}
    .score-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border:1px solid #111827;border-radius:10px;overflow:hidden;margin:10px 0 14px}
    .score-cell{padding:9px 8px;text-align:center;border-right:1px solid #d1d5db;background:#fff}
    .score-cell:last-child{border-right:0}
    .score-label{font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}
    .score-value{font-size:18px;font-weight:900;color:#111827;margin-top:2px}
    .score-value.good{color:#047857}.score-value.bad{color:#be123c}
    .review-title{font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#111827;border-bottom:1px solid #111827;padding-bottom:6px;margin:16px 0 6px}
    .question-row{break-inside:avoid;border-bottom:1px solid #e5e7eb;padding:10px 0}
    .q-head{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}
    .q-title{font-weight:800;font-size:12px;white-space:pre-wrap;line-height:1.45;color:#111827}
    .q-meta{display:flex;gap:6px;align-items:center;font-size:10px;color:#64748b;white-space:nowrap}
    .status{border-radius:999px;padding:2px 7px;font-size:10px;font-weight:800}
    .status-correct{background:#dcfce7;color:#166534}
    .status-wrong{background:#ffe4e6;color:#9f1239}
    .status-unanswered{background:#f3f4f6;color:#4b5563}
    .status-answered{background:#e0e7ff;color:#3730a3}
    .img-wrap{margin-top:8px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;padding:6px;text-align:center}
    .img-wrap img{max-width:100%;height:auto;max-height:360px;object-fit:contain}
    .options-list{margin-top:7px;display:grid;grid-template-columns:1fr 1fr;gap:3px 24px}
    .option-line{display:flex;gap:5px;align-items:baseline;padding:2px 0;font-size:11px;color:#374151}
    .option-letter{font-weight:900;color:#111827;min-width:18px}
    .option-text{flex:1}
    .option-line.is-correct{color:#065f46;font-weight:700}
    .option-line.is-selected:not(.is-correct){color:#9f1239;font-weight:700}
    .option-note{font-size:9px;font-weight:900;text-transform:uppercase;margin-left:5px;white-space:nowrap}
    .correct-note{color:#047857}.selected-note{color:#be123c}
    .answer-summary{margin-top:7px;background:#f8fafc;border-left:3px solid #4f46e5;padding:5px 8px;font-size:11px;display:flex;gap:18px;flex-wrap:wrap}
    .footer{margin-top:14px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9px;color:#64748b;text-align:right}
    .save-bar{position:sticky;top:0;z-index:100;background:#4f46e5;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #3730a3}
    .save-btn{background:#fff;color:#4f46e5;border:none;border-radius:6px;padding:7px 18px;font-weight:800;font-size:13px;cursor:pointer;letter-spacing:.02em}
    .save-btn:hover{background:#e0e7ff}
    .save-hint{font-size:12px;opacity:.85}
    @media print{.save-bar{display:none!important}.brand img{height:50px}.watermark-text{font-size:34px}.question-row{padding:8px 0}.img-wrap img{max-height:300px}}
  </style>
</head>
<body>
  <div class="save-bar">
    <button class="save-btn" onclick="window.print()">⬇ Save as PDF</button>
    <span class="save-hint">Click → choose "Save as PDF" in the print dialog</span>
  </div>
  <div class="watermark"><div class="watermark-text">${escapeHtml(`${studentName} • ${studentId}`)}</div></div>
  <main class="content">
    <header class="sheet-header">
      <div class="brand">
        <img src="${escapeHtml(bannerImage)}" alt="Karthikeyan Analysis" />
        <div>
          <p class="exam-title">${escapeHtml(test.title)}</p>
          <div class="muted">${escapeHtml(test.subject || "Exam")} • Official response sheet</div>
        </div>
      </div>
      <div class="doc-title">
        <div class="eyebrow">Result</div>
        <h1>Exam Result Sheet</h1>
      </div>
    </header>
    <section class="candidate-block">
      <div class="info-card">
        <div class="section-title">Candidate & Exam Details</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Candidate Name</div>
            <div class="info-value">${escapeHtml(studentName)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Student ID</div>
            <div class="info-value">${escapeHtml(studentId)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Participant Type</div>
            <div class="info-value">${participant.isGuest ? "Guest participant" : "Enrolled student"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Submitted At</div>
            <div class="info-value">${escapeHtml(submittedLabel)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Total Questions</div>
            <div class="info-value">${questions.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Duration</div>
            <div class="info-value">${formatResponseSheetTime((test.durationMinutes || 0) * 60)}</div>
          </div>
        </div>
      </div>
      <div class="profile-passport">${passportInner}</div>
    </section>
    <section class="score-strip">
      <div class="score-cell"><div class="score-label">Score</div><div class="score-value">${scoreValue}/${maxScoreValue}</div></div>
      <div class="score-cell"><div class="score-label">Percentage</div><div class="score-value">${percent}%</div></div>
      <div class="score-cell"><div class="score-label">Answered</div><div class="score-value">${answeredCount}</div></div>
      <div class="score-cell"><div class="score-label">Correct</div><div class="score-value good">${correctCount}</div></div>
      <div class="score-cell"><div class="score-label">Wrong</div><div class="score-value bad">${wrongCount}</div></div>
      <div class="score-cell"><div class="score-label">Unanswered</div><div class="score-value">${unansweredCount}</div></div>
    </section>
    <div class="review-title">Question Wise Response Review</div>
    ${rows.join("")}
    <div class="footer">Generated by ${generatedBy === "admin" ? "Admin Panel" : "Student Portal"} • ${escapeHtml(generatedLabel)}</div>
  </main>
  <script>
    (function () {
      function fallbackUrls(img) {
        try { return JSON.parse(img.getAttribute("data-fallback-srcs") || "[]"); } catch (e) { return []; }
      }

      function loadImage(img) {
        return new Promise(function (resolve) {
          var urls = fallbackUrls(img);
          var index = Number(img.getAttribute("data-fallback-index") || "0");
          var done = false;
          var timeoutId = null;

          function finish() {
            if (done) return;
            done = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          }

          function tryNext() {
            index += 1;
            if (index < urls.length) {
              img.setAttribute("data-fallback-index", String(index));
              img.src = urls[index];
              timeoutId = setTimeout(tryNext, 3500);
              return;
            }
            finish();
          }

          if (img.complete && img.naturalWidth > 0) {
            finish();
            return;
          }

          img.addEventListener("load", finish, { once: true });
          img.addEventListener("error", tryNext);
          timeoutId = setTimeout(tryNext, 3500);
        });
      }

      function waitForImages() {
        var images = Array.prototype.slice.call(document.images || []);
        if (!images.length) return Promise.resolve();
        return Promise.all(images.map(loadImage));
      }

      window.focus();
      waitForImages();
    })();
  </script>
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

/**
 * Auto-downloads the response sheet as a PDF without opening a print dialog.
 * Renders the full HTML in a hidden same-origin iframe, captures with html2canvas,
 * then saves via jsPDF. Falls back to the print-window approach if capture fails.
 */
/**
 * Downloads HTML content as a file using a temporary anchor click.
 * Does NOT open a new window, so popup blockers are irrelevant.
 */
function downloadAsHtml(htmlContent: string, filename: string) {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadResponseSheetPdf(
  params: ResponseSheetPdfParams,
  filename = "response-sheet.pdf",
): Promise<void> {
  let html2canvas: ((el: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>) | null = null;
  let jsPDF: any = null;
  try {
    [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
  } catch {
    // Libraries failed to load — download as HTML so student can open and print
    downloadAsHtml(buildResponseSheetHtml(params), filename.replace(/\.pdf$/i, ".html"));
    return;
  }

  const htmlContent = buildResponseSheetHtml(params);

  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    top: "0",
    left: "-9999px",
    width: "794px",
    height: "1px",
    border: "none",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("iframe load timeout")), 15_000);

      iframe.onload = async () => {
        clearTimeout(timeout);
        try {
          const iframeDoc = iframe.contentDocument;
          if (!iframeDoc) { reject(new Error("iframe contentDocument unavailable")); return; }

          // Remove elements that don't belong in the PDF or cause html2canvas issues
          const saveBar = iframeDoc.querySelector(".save-bar") as HTMLElement | null;
          if (saveBar) saveBar.remove();
          // position:fixed causes html2canvas to render the watermark on every page;
          // switching to absolute makes it appear once at the correct vertical position.
          const watermark = iframeDoc.querySelector(".watermark") as HTMLElement | null;
          if (watermark) watermark.style.position = "absolute";

          // Wait for custom fonts (Inter) so text renders at the correct dimensions
          try { if ((iframeDoc as any).fonts) await (iframeDoc as any).fonts.ready; } catch {}

          // Wait for all images
          const images = Array.from(iframeDoc.querySelectorAll("img"));
          await Promise.allSettled(
            images.map(
              (img) =>
                new Promise<void>((res) => {
                  if (img.complete && img.naturalWidth > 0) { res(); return; }
                  img.addEventListener("load", () => res(), { once: true });
                  img.addEventListener("error", () => res(), { once: true });
                  setTimeout(res, 6_000);
                }),
            ),
          );

          // Let the browser re-paint after font/image changes so scrollHeight is accurate
          await new Promise<void>((res) => setTimeout(res, 300));

          // Measure full document height — use the max of both to be safe
          const scrollH = Math.max(
            iframeDoc.documentElement.scrollHeight,
            iframeDoc.body.scrollHeight,
          );

          // Expand the iframe so the browser lays out the full content
          iframe.style.height = `${scrollH}px`;

          // Wait for the height change to propagate through browser layout
          await new Promise<void>((res) => setTimeout(res, 150));

          // Re-measure after reflow in case content grew (e.g. images)
          const finalH = Math.max(
            iframeDoc.documentElement.scrollHeight,
            iframeDoc.body.scrollHeight,
          );

          // Capture the body at full content size.
          // Explicit width + height are critical — without them html2canvas uses the
          // element's visible (clipped) size, which inside a tiny hidden iframe may
          // omit everything below the first screenful.
          const canvas = await html2canvas!(iframeDoc.body, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            windowWidth: 794,
            windowHeight: finalH,
            width: 794,
            height: finalH,
            scrollX: 0,
            scrollY: 0,
          });

          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const imgH = (canvas.height * pageW) / canvas.width;
          const imgData = canvas.toDataURL("image/jpeg", 0.92);

          let y = 0;
          while (y < imgH) {
            if (y > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, -y, pageW, imgH);
            y += pageH;
          }

          pdf.save(filename);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("iframe failed to load"));
      };

      // srcdoc avoids blob: URL CSP restrictions that can block iframe loading on some hosts
      iframe.srcdoc = htmlContent;
    });
  } catch {
    // Fallback: download as HTML — no popup, no new window
    downloadAsHtml(htmlContent, filename.replace(/\.pdf$/i, ".html"));
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}
