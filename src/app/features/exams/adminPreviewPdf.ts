import type { ExamQuestionPrivate, ExamQuestionPublic, ExamTest } from "./types";

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

  const questionHtml = questions
    .map((question, index) => {
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
    })
    .join("");

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
    @media print{body{margin:12px}.options{grid-template-columns:1fr}.image-wrap img{max-height:420px}}
  </style>
</head>
<body>
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
  <script>window.focus(); setTimeout(() => window.print(), 350);</script>
</body>
</html>`;
}

export function openAdminPreviewPdf(params: AdminPreviewPdfParams) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked. Please allow popups to download the preview PDF.");
    return;
  }

  win.document.open();
  win.document.write(buildAdminPreviewHtml(params));
  win.document.close();
}
