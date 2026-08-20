import type { EnrollmentForm } from "./enrollment-types";

function fmt(val?: string) {
  return val?.trim() || "—";
}

function fmtDate(val?: string) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return val;
  }
}

function row(label: string, value: string, half = false) {
  return `
    <div class="field${half ? " half" : ""}">
      <div class="field-label">${label}</div>
      <div class="field-value">${value}</div>
    </div>`;
}

export function downloadEnrollmentPDF(form: EnrollmentForm): void {
  const p = form.personalDetails;
  const a = form.addressDetails;
  const ed = form.educationalDetails;
  const o = form.otherDetails;
  const b = form.batchDetails;
  const t = form.termsAndConditions;

  const termsAgreed = Object.values(t).filter(Boolean).length;

  const educationRows = ed.records
    .map(
      (r) => `
      <tr>
        <td>${r.tier}</td>
        <td>${r.majorStream}</td>
        <td>${r.percentageOfMarks}%</td>
        <td>${r.yearOfPassing}</td>
      </tr>`,
    )
    .join("");

  const workStatusLabel: Record<string, string> = {
    private_emp: "Private Employee",
    govt_emp: "Government Employee",
    housewife: "Housewife",
    aspirant: "Aspirant / Student",
  };

  const modeLabel: Record<string, string> = {
    upi: "UPI",
    credit_card: "Credit Card",
    bank_transfer: "Bank Transfer",
    cash: "Cash",
  };

  const photoBlock = p.photoURL
    ? `<img src="${p.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;" />`
    : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:9pt;">
         <div style="font-size:22pt;margin-bottom:4px;">📷</div>
         <div>Affix Photo</div>
       </div>`;

  const signatureBlock = p.signatureURL
    ? `<img src="${p.signatureURL}" style="max-height:40px;max-width:140px;object-fit:contain;" />`
    : `<div style="height:36px;"></div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Enrollment Form — ${p.studentName}</title>
<style>
  @page {
    size: A4;
    margin: 14mm 16mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Arial", sans-serif;
    font-size: 9.5pt;
    color: #1e293b;
    background: #fff;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2.5px solid #1e3a8a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .header-logo {
    font-size: 8pt;
    color: #1e3a8a;
    font-weight: bold;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .header-title {
    font-size: 15pt;
    font-weight: 800;
    color: #1e3a8a;
    line-height: 1.1;
  }
  .header-sub {
    font-size: 9pt;
    color: #475569;
    margin-top: 2px;
  }
  .header-appno {
    font-size: 8pt;
    color: #64748b;
    margin-top: 6px;
    border: 1px solid #cbd5e1;
    padding: 3px 7px;
    border-radius: 3px;
    display: inline-block;
  }
  .photo-box {
    width: 82px;
    height: 100px;
    border: 1.5px solid #94a3b8;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* ── Sections ── */
  .section {
    margin-bottom: 9px;
    break-inside: avoid;
  }
  .section-title {
    background: #1e3a8a;
    color: #fff;
    font-size: 9pt;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 2px;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 10px;
  }
  .field {
    width: calc(50% - 5px);
  }
  .field.full { width: 100%; }
  .field.third { width: calc(33.33% - 7px); }
  .field-label {
    font-size: 7.5pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1px;
  }
  .field-value {
    font-size: 9pt;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 2px;
    min-height: 16px;
  }

  /* ── Education table ── */
  .edu-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  .edu-table th {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    text-align: left;
    font-size: 7.5pt;
    color: #475569;
    text-transform: uppercase;
  }
  .edu-table td {
    border: 1px solid #e2e8f0;
    padding: 4px 6px;
  }

  /* ── Page 2 ── */
  .page-break { page-break-before: always; }

  /* ── Terms ── */
  .terms-list {
    padding-left: 14px;
  }
  .terms-list li {
    font-size: 8pt;
    color: #475569;
    margin-bottom: 2px;
  }

  /* ── Signature row ── */
  .sig-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 16px;
    gap: 12px;
  }
  .sig-box {
    flex: 1;
    text-align: center;
  }
  .sig-line {
    border-bottom: 1.5px solid #334155;
    min-height: 44px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 3px;
    margin-bottom: 3px;
  }
  .sig-label {
    font-size: 7.5pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .office-box {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 8px 12px;
    min-height: 72px;
    font-size: 8pt;
    color: #64748b;
  }
  .office-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    color: #94a3b8;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════ PAGE 1 ═══════════════════════ -->

<div class="header">
  <div>
    <div class="header-logo">Karthikeyan Analysis Study Circle</div>
    <div class="header-title">Student Enrollment Form</div>
    <div class="header-sub">Official Application for Course Enrollment</div>
    <div class="header-appno">Application No: ________________________</div>
  </div>
  <div class="photo-box">${photoBlock}</div>
</div>

<!-- I. Personal Details -->
<div class="section">
  <div class="section-title">I. Personal Details</div>
  <div class="fields">
    ${row("Student Name", fmt(p.studentName))}
    ${row("Father's Name", fmt(p.fatherName))}
    ${row("Date of Birth", fmtDate(p.dateOfBirth))}
    ${row("Gender", fmt(p.gender?.charAt(0).toUpperCase() + p.gender?.slice(1)))}
    ${row("Caste / Category", fmt(p.caste?.toUpperCase()))}
    ${row("Mobile No.", fmt(p.mobileNo))}
    ${row("WhatsApp No.", fmt(p.whatsappNo))}
    ${row("Telegram No.", fmt(p.telegramNo))}
    <div class="field full">
      <div class="field-label">E-Mail ID</div>
      <div class="field-value">${fmt(p.email)}</div>
    </div>
  </div>
</div>

<!-- II. Address Details -->
<div class="section">
  <div class="section-title">II. Address Details</div>
  <div class="fields">
    ${row("Door No.", fmt(a.doorNo))}
    ${row("Street / Nagar", fmt(a.streetNagar))}
    ${row("District", fmt(a.district))}
    ${row("State", fmt(a.state))}
    ${row("Pincode", fmt(a.pincode))}
  </div>
</div>

<!-- V. Batch & Payment Details -->
<div class="section">
  <div class="section-title">V. Batch & Payment Details</div>
  <div class="fields">
    ${row("Batch Name", fmt(b.batchName))}
    ${row("Date of Payment", fmtDate(b.dateOfPayment))}
    ${row("Batch Start Date", fmtDate(b.batchDurationStart))}
    ${row("Batch End Date", fmtDate(b.batchDurationEnd))}
    ${row("Mode of Transaction", fmt(modeLabel[b.modeOfTransaction] || b.modeOfTransaction))}
  </div>
</div>

<!-- ═══════════════════════ PAGE 2 ═══════════════════════ -->
<div class="page-break"></div>

<!-- Re-print name for identification on back page -->
<div style="font-size:8pt;color:#64748b;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">
  <strong>${fmt(p.studentName)}</strong> &nbsp;|&nbsp; ${fmt(b.batchName)} &nbsp;|&nbsp; (continued)
</div>

<!-- III. Educational Details -->
<div class="section">
  <div class="section-title">III. Educational Details</div>
  ${
    ed.records.length === 0
      ? `<p style="font-size:8pt;color:#94a3b8;padding:4px 0;">No education records provided.</p>`
      : `<table class="edu-table">
           <thead>
             <tr>
               <th>Tier</th>
               <th>Major / Stream</th>
               <th>% of Marks</th>
               <th>Year of Passing</th>
             </tr>
           </thead>
           <tbody>${educationRows}</tbody>
         </table>`
  }
</div>

<!-- IV. Other Details -->
<div class="section">
  <div class="section-title">IV. Other Details</div>
  <div class="fields">
    ${row("Marital Status", fmt(o.maritalStatus?.charAt(0).toUpperCase() + o.maritalStatus?.slice(1)))}
    ${row("Work Status", fmt(workStatusLabel[o.workStatus] || o.workStatus))}
    ${
      o.natureOfWork
        ? `<div class="field full"><div class="field-label">Nature of Work</div><div class="field-value">${fmt(o.natureOfWork)}</div></div>`
        : ""
    }
  </div>
</div>

<!-- VI. Terms & Conditions -->
<div class="section">
  <div class="section-title">VI. Terms & Conditions</div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <span style="font-size:9pt;font-weight:600;color:${termsAgreed === 5 ? "#16a34a" : "#dc2626"};">
      ${termsAgreed} / 5 terms agreed
    </span>
    ${termsAgreed === 5 ? '<span style="color:#16a34a;font-size:9pt;">✓ All accepted</span>' : ""}
  </div>
  <ol class="terms-list">
    ${[
      "I confirm the information provided is true and accurate.",
      "I agree to abide by all rules and regulations of Karthikeyan Analysis Study Circle.",
      "I will not share or distribute proprietary course content without prior permission.",
      "I accept the terms of the refund policy as stated in the course materials.",
      "I have read and understood the privacy policy and data handling practices.",
    ]
      .map(
        (text, i) =>
          `<li style="color:${t[`term${i + 1}` as keyof typeof t] ? "#1e293b" : "#94a3b8"};">${
            t[`term${i + 1}` as keyof typeof t] ? "☑" : "☐"
          } ${text}</li>`,
      )
      .join("")}
  </ol>
</div>

<!-- Signature Section -->
<div class="sig-row">
  <div class="sig-box">
    <div class="sig-line">${signatureBlock}</div>
    <div class="sig-label">Student Signature</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">Date</div>
  </div>
  <div style="flex:1.5;">
    <div class="office-label">For Office Use Only</div>
    <div class="office-box">
      <div style="margin-bottom:6px;">Enrollment No: _____________________</div>
      <div style="margin-bottom:6px;">Verified by: _________________________</div>
      <div>Date: ____________________________</div>
    </div>
  </div>
</div>

</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Please allow pop-ups for this site to generate PDFs.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Small delay to ensure images/styles are fully rendered before print dialog
  setTimeout(() => {
    win.print();
  }, 600);
}
