import type { ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "./types";
import { formatPartLabel } from "./examScoring";

function escapeHtml(input: string) {
  return (input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(name: string) {
  return (name || "test-preview").replace(/[\\/:*?"<>|]+/g, "_");
}

function optionLetter(index?: number) {
  if (index == null || index < 0) return "-";
  return String.fromCharCode(65 + index);
}

type AdminPreviewPdfParams = {
  test: ExamTest;
  questions: ExamQuestionPublic[];
  keys: ExamQuestionPrivate[];
};

function buildAdminPreviewHtml({ test, questions, keys }: AdminPreviewPdfParams) {
  const keyById = new Map(keys.map((key) => [key.id, key.correctIndex]));
  const missingKeys = questions.filter((question) => !keyById.has(question.id)).length;
  const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);

  const questionCards = questions.map((question, index) => {
    const correctIndex = keyById.get(question.id);
    const correctLetter = optionLetter(correctIndex);
    const correctText =
      correctIndex == null ? "" : String(question.options?.[correctIndex] || "").trim();
    const imageHtml = question.imageUrl
      ? `<div class="image-wrap"><img src="${escapeHtml(question.imageUrl)}" alt="Question ${index + 1}" /></div>`
      : "";
    const optionsHtml = (question.options || [])
      .map((option, optionIndex) => {
        const isCorrect = optionIndex === correctIndex;
        return `<div class="option ${isCorrect ? "correct" : ""}">
          <span class="option-letter">${optionLetter(optionIndex)}.</span>
          <span class="option-text">${escapeHtml(option)}</span>
          ${isCorrect ? `<span class="correct-pill">Correct Answer</span>` : ""}
        </div>`;
      })
      .join("");

    return `<section class="question">
      <div class="question-header">
        <div>
          <div class="question-no">Question ${index + 1}</div>
          <div class="question-text">${escapeHtml(question.text || "").replaceAll("\n", "<br />")}</div>
        </div>
        <div class="marks">${escapeHtml(String(question.marks || 0))} mark${Number(question.marks || 0) === 1 ? "" : "s"}</div>
      </div>
      ${imageHtml}
      <div class="options">${optionsHtml}</div>
      <div class="answer-key">
        Answer: <strong>${escapeHtml(correctLetter)}</strong>
        ${correctText ? ` - ${escapeHtml(correctText)}` : ""}
        ${correctIndex == null ? `<span class="missing">Missing answer key</span>` : ""}
      </div>
    </section>`;
  });

  // Group by part/section when the test is a multi-part test, mirroring the
  // student-facing response sheet's structure.
  const partsList =
    test.partsMode === "multi"
      ? [...(test.parts || [])].sort((a, b) => a.order - b.order)
      : [];
  let questionHtml: string;
  if (partsList.length) {
    const partById = new Map(partsList.map((p) => [p.id, p]));
    const idxsByPart = new Map<string, number[]>();
    const unassignedIdxs: number[] = [];
    questions.forEach((q, idx) => {
      if (q.partId && partById.has(q.partId)) {
        const arr = idxsByPart.get(q.partId) || [];
        arr.push(idx);
        idxsByPart.set(q.partId, arr);
      } else {
        unassignedIdxs.push(idx);
      }
    });
    const sections: string[] = [];
    const partHeader = (label: string, idxs: number[]) => {
      const marks = idxs.reduce((sum, i) => sum + Number(questions[i]!.marks || 0), 0);
      return `<div class="part-header">
        <span class="part-header-title">${escapeHtml(label)}</span>
        <span class="part-header-stats">${idxs.length} question${idxs.length === 1 ? "" : "s"} • ${marks} marks</span>
      </div>`;
    };
    for (const part of partsList) {
      const idxs = idxsByPart.get(part.id) || [];
      if (!idxs.length) continue;
      sections.push(partHeader(formatPartLabel(part), idxs));
      idxs.forEach((i) => sections.push(questionCards[i]!));
    }
    if (unassignedIdxs.length) {
      sections.push(partHeader("Other Questions", unassignedIdxs));
      unassignedIdxs.forEach((i) => sections.push(questionCards[i]!));
    }
    questionHtml = sections.join("");
  } else {
    questionHtml = questionCards.join("");
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(safeFileName(test.title))} - Preview Answer Key</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Inter,Arial,sans-serif;margin:20px;color:#0f172a;background:#fff}
    .top{border:1px solid #cbd5e1;border-radius:16px;padding:18px;margin-bottom:16px;background:linear-gradient(135deg,#f8fafc,#fff)}
    .label{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#4f46e5}
    h1{font-size:24px;margin:6px 0 4px}
    .sub{font-size:12px;color:#475569}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    .chip{border:1px solid #cbd5e1;border-radius:999px;padding:5px 10px;font-size:11px;background:#fff}
    .warning{border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:12px}
    .part-header{break-inside:avoid;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:9px 14px;margin-top:16px}
    .part-header-title{font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#3730a3}
    .part-header-stats{font-size:11px;color:#4338ca}
    .question{break-inside:avoid;border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-top:12px;background:#fff}
    .question-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .question-no{font-size:11px;font-weight:900;text-transform:uppercase;color:#4f46e5;letter-spacing:.08em}
    .question-text{font-size:14px;font-weight:800;line-height:1.5;margin-top:5px;white-space:normal}
    .marks{border:1px solid #cbd5e1;border-radius:999px;padding:4px 9px;font-size:11px;white-space:nowrap;background:#f8fafc}
    .image-wrap{margin-top:10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:8px;text-align:center}
    .image-wrap img{max-width:100%;height:auto;max-height:520px;object-fit:contain}
    .options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
    .option{border:1px solid #e2e8f0;border-radius:12px;padding:9px;font-size:12px;display:flex;gap:8px;align-items:flex-start}
    .option.correct{border-color:#22c55e;background:#ecfdf5}
    .option-letter{font-weight:900;color:#334155}
    .option-text{flex:1}
    .correct-pill{margin-left:auto;font-size:10px;border:1px solid #22c55e;background:#dcfce7;color:#166534;border-radius:999px;padding:2px 7px;white-space:nowrap}
    .answer-key{margin-top:10px;border-radius:10px;background:#eef2ff;color:#312e81;padding:8px 10px;font-size:12px}
    .missing{margin-left:8px;color:#b91c1c;font-weight:800}
    .footer{margin-top:18px;text-align:right;font-size:10px;color:#64748b}
    .toolbar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:-20px -20px 16px;padding:10px 20px;background:#0f172a;color:#e2e8f0;font-size:12px}
    .toolbar button{border:0;border-radius:8px;padding:7px 14px;font-weight:800;font-size:12px;cursor:pointer;background:#4f46e5;color:#fff}
    .toolbar button.secondary{background:#334155}
    .toolbar button:disabled{opacity:.5;cursor:wait}
    #pvStatus{flex:1;min-width:200px}
    .img-failed{outline:2px solid #ef4444;outline-offset:2px}
    @media print{body{margin:12px}.toolbar{display:none}.options{grid-template-columns:1fr}.image-wrap img{max-height:420px}}
  </style>
</head>
<body>
  <div class="toolbar">
    <span id="pvStatus">Loading question images…</span>
    <button type="button" id="pvRetry" class="secondary" style="display:none">⟳ Retry missing images</button>
    <button type="button" id="pvPrint" disabled>⬇ Save as PDF</button>
  </div>
  <section class="top">
    <div class="label">Admin Preview Copy - Not For Publishing</div>
    <h1>${escapeHtml(test.title)}</h1>
    <div class="sub">${escapeHtml(test.subject || "Subject")} • ${escapeHtml(new Date(test.startAt).toLocaleString())} to ${escapeHtml(new Date(test.endAt).toLocaleString())}</div>
    <div class="chips">
      <span class="chip">${questions.length} questions</span>
      <span class="chip">${totalMarks} marks</span>
      <span class="chip">Duration: ${test.durationMinutes || 0} minutes</span>
      <span class="chip">Status: ${escapeHtml(test.status || "draft")}</span>
    </div>
  </section>
  ${
    missingKeys
      ? `<div class="warning">${missingKeys} question${missingKeys === 1 ? "" : "s"} missing answer keys. Please fix before publishing.</div>`
      : ""
  }
  ${questionHtml || `<div class="warning">No questions uploaded yet.</div>`}
  <div class="footer">Generated from Admin Panel • ${escapeHtml(new Date().toLocaleString())}</div>
  <script>
    (function () {
      // Printing before the question images finish downloading saved PDFs with
      // blank image questions. Wait for every image (with retries) first.
      var MAX_RETRIES = 3;
      var HARD_LIMIT_MS = 180000;
      var images = Array.prototype.slice.call(document.querySelectorAll(".image-wrap img"));
      var status = document.getElementById("pvStatus");
      var printBtn = document.getElementById("pvPrint");
      var retryBtn = document.getElementById("pvRetry");

      function isLoaded(img) { return img.complete && img.naturalWidth > 0; }
      function withRetryParam(url, n) {
        if (!url || url.indexOf("data:") === 0) return url;
        return url.replace(/[?&]_pv_retry=[0-9]+$/, "") + (url.indexOf("?") >= 0 ? "&" : "?") + "_pv_retry=" + n;
      }
      function loadImage(img) {
        return new Promise(function (resolve) {
          if (isLoaded(img)) { resolve(true); return; }
          var original = img.getAttribute("src") || "";
          var attempt = 0;
          var done = false;
          function finish(ok) {
            if (done) return;
            done = true;
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
            resolve(ok);
          }
          function onLoad() { if (isLoaded(img)) finish(true); else onError(); }
          function onError() {
            attempt += 1;
            if (attempt <= MAX_RETRIES) {
              setTimeout(function () { img.src = withRetryParam(original, attempt); }, 400 * attempt);
            } else {
              finish(false);
            }
          }
          img.addEventListener("load", onLoad);
          img.addEventListener("error", onError);
          if (img.complete && img.naturalWidth === 0) onError();
        });
      }
      function failed() { return images.filter(function (img) { return !isLoaded(img); }); }
      function label(img) {
        var q = img.closest(".question");
        var no = q && q.querySelector(".question-no");
        return no ? (no.textContent || "").replace("Question", "Q").trim() : "?";
      }
      function loadAll() {
        var loaded = images.filter(isLoaded).length;
        status.textContent = "Loading question images… " + loaded + " / " + images.length;
        var pending = images.map(function (img) {
          var was = isLoaded(img);
          return loadImage(img).then(function (ok) {
            if (!was && ok) { loaded += 1; status.textContent = "Loading question images… " + loaded + " / " + images.length; }
          });
        });
        return Promise.race([Promise.all(pending), new Promise(function (r) { setTimeout(r, HARD_LIMIT_MS); })]);
      }
      function ready(autoPrint) {
        var bad = failed();
        images.forEach(function (img) { img.classList.toggle("img-failed", !isLoaded(img)); });
        printBtn.disabled = false;
        retryBtn.disabled = false;
        if (bad.length) {
          retryBtn.style.display = "";
          printBtn.textContent = "Print anyway";
          status.textContent = "Could not load images for: " + bad.map(label).join(", ") + ". Retry before saving.";
        } else {
          retryBtn.style.display = "none";
          printBtn.textContent = "⬇ Save as PDF";
          status.textContent = "All " + document.querySelectorAll(".question").length + " questions ready — choose 'Save as PDF' in the print dialog.";
          if (autoPrint) requestAnimationFrame(function () { requestAnimationFrame(function () { window.print(); }); });
        }
      }
      printBtn.addEventListener("click", function () { window.print(); });
      retryBtn.addEventListener("click", function () {
        retryBtn.disabled = true;
        printBtn.disabled = true;
        failed().forEach(function (img) { img.src = withRetryParam(img.getAttribute("src") || "", Date.now()); });
        loadAll().then(function () { ready(false); });
      });

      window.focus();
      if (!images.length) { ready(true); return; }
      loadAll().then(function () { ready(true); });
    })();
  </script>
</body>
</html>`;
}

/**
 * Call synchronously inside the click handler (before any await) so the
 * browser treats it as a user gesture and doesn't block the popup.
 */
export function openAdminPreviewWindow(): Window | null {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(
      `<!doctype html><title>Preparing preview…</title><body style="font-family:Arial,sans-serif;padding:40px;color:#475569">Preparing question paper preview…</body>`,
    );
  }
  return win;
}

export function openAdminPreviewPdf(
  params: AdminPreviewPdfParams,
  preOpened?: Window | null,
) {
  const win = preOpened && !preOpened.closed ? preOpened : window.open("", "_blank");
  if (!win) {
    alert("Popup blocked. Please allow popups to download the preview PDF.");
    return;
  }

  win.document.open();
  win.document.write(buildAdminPreviewHtml(params));
  win.document.close();
}
