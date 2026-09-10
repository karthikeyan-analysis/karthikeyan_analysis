import type { EnrollmentForm } from "./enrollment-types";
import bannerImage from "../../../banner.jpeg";

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
  const p = form.personalDetails || ({} as any);
  const a = form.addressDetails || ({} as any);
  const ed = form.educationalDetails || { records: [] };
  const o = form.demographicDetails || form.otherDetails || ({} as any);
  const b = form.batchDetails || ({} as any);
  const t = form.termsAndConditions || ({} as any);

  const bannerUrl =
    typeof bannerImage === "string" &&
    (bannerImage.startsWith("data:") || bannerImage.startsWith("http"))
      ? bannerImage
      : new URL(bannerImage, window.location.origin).href;

  const termsAgreed = t.agreedAllTerms
    ? 5
    : Object.values(t).filter(Boolean).length;

  const educationRows = (ed?.records || [])
    .map(
      (r) => `
      <tr>
        <td>${r.degree || r.tier || "—"}</td>
        <td>${r.major === "Other" ? r.otherMajor || "Other" : r.major || r.majorStream || "—"}</td>
        <td>${r.percentage || r.percentageOfMarks || "—"}%</td>
        <td>${r.pstm || r.yearOfPassing || "—"}</td>
      </tr>`,
    )
    .join("");

  const workStatusLabel: Record<string, string> = {
    private_emp: "Private Employee",
    govt_emp: "Government Employee",
    housewife: "Housewife",
    aspirant: "Aspirant / Student",
    "Government Employee": "Government Employee",
    "Private Employee": "Private Employee",
    "Full-time Aspirant": "Full-time Aspirant",
    "Home Maker": "Home Maker",
  };

  const modeLabel: Record<string, string> = {
    upi: "UPI",
    credit_card: "Credit Card",
    bank_transfer: "Bank Transfer",
    cash: "Cash",
  };

  const photoBlock = p.photoURL
    ? `<img src="${p.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;" alt="Student Photo" />`
    : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:8pt;background:#f8fafc;">
         <div style="font-size:20pt;margin-bottom:2px;">📷</div>
         <div>Affix Photo</div>
       </div>`;

  const signatureBlock = p.signatureURL
    ? `<img src="${p.signatureURL}" style="max-height:38px;max-width:140px;object-fit:contain;" alt="Signature" />`
    : `<div style="height:36px;"></div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<base href="${window.location.origin}/" />
<title>Enrollment Form — ${p.studentName || form.id}</title>
<style>
  @page {
    size: A4;
    margin: 10mm 14mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 9pt;
    color: #0f172a;
    background: #fff;
    line-height: 1.35;
  }

  /* ── Banner Container ── */
  .banner-wrap {
    text-align: center;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 6px;
    margin-bottom: 8px;
    background: #ffffff;
  }
  .banner-img {
    max-width: 100%;
    max-height: 52px;
    width: auto;
    object-fit: contain;
    display: block;
    margin: 0 auto;
  }

  /* ── Header Row ── */
  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 8px;
    margin-bottom: 8px;
    gap: 12px;
  }
  .header-left {
    flex: 1;
  }
  .doc-badge {
    display: inline-block;
    font-size: 7pt;
    font-weight: 700;
    color: #1e3a8a;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 2px 7px;
    border-radius: 3px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  .header-title {
    font-size: 13pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
  }
  .header-sub {
    font-size: 8.5pt;
    color: #475569;
    margin-top: 2px;
  }
  .meta-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 6px;
  }
  .meta-pill {
    font-size: 7.5pt;
    color: #334155;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .photo-box {
    width: 78px;
    height: 96px;
    border: 1.5px solid #94a3b8;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
    background: #f8fafc;
  }

  /* ── Sections ── */
  .section {
    margin-bottom: 8px;
    break-inside: avoid;
  }
  .section-title {
    background: #1e3a8a;
    color: #fff;
    font-size: 8pt;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 2px;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .field {
    width: calc(50% - 4px);
  }
  .field.full { width: 100%; }
  .field.third { width: calc(33.33% - 6px); }
  .field-label {
    font-size: 7pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1px;
    font-weight: 600;
  }
  .field-value {
    font-size: 8.5pt;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 2px;
    min-height: 15px;
    color: #0f172a;
    word-break: break-word;
  }

  /* ── Education table ── */
  .edu-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  .edu-table th {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    text-align: left;
    font-size: 7pt;
    color: #334155;
    text-transform: uppercase;
    font-weight: 700;
  }
  .edu-table td {
    border: 1px solid #e2e8f0;
    padding: 4px 6px;
  }

  /* ── Page 2 ── */
  .page-break { page-break-before: always; }
  .page2-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1.5px solid #1e3a8a;
    padding-bottom: 4px;
    margin-bottom: 10px;
    font-size: 7.5pt;
    color: #64748b;
  }
  .page2-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .page2-logo {
    max-height: 22px;
    width: auto;
    object-fit: contain;
  }

  /* ── Terms ── */
  .terms-list {
    padding-left: 14px;
    font-size: 7.5pt;
    color: #475569;
  }
  .terms-list li {
    margin-bottom: 2px;
    line-height: 1.3;
  }

  /* ── Signature row ── */
  .sig-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 14px;
    gap: 12px;
    break-inside: avoid;
  }
  .sig-box {
    flex: 1;
    text-align: center;
  }
  .sig-line {
    border-bottom: 1.5px solid #334155;
    min-height: 40px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 2px;
    margin-bottom: 3px;
  }
  .sig-label {
    font-size: 7pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: 600;
  }

  .office-box {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 7.5pt;
    color: #475569;
    background: #f8fafc;
  }
  .office-label {
    font-size: 7pt;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.3px;
    margin-bottom: 3px;
    font-weight: 700;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════ PAGE 1 ═══════════════════════ -->

<div class="banner-wrap">
  <img src="${bannerUrl}" alt="Karthikeyan Analysis Study Circle" class="banner-img" />
</div>

<div class="header-row">
  <div class="header-left">
    <div class="doc-badge">Official Admission Application</div>
    <div class="header-title">${fmt(p.studentName)}</div>
    <div class="header-sub">Course: <strong>${fmt(b.batchName || form.batchName || form.courseName || "TNPSC Course")}</strong></div>
    <div class="meta-pills">
      <span class="meta-pill"><strong>App ID:</strong> ${fmt(form.id ? form.id.slice(-8).toUpperCase() : form.studentId || "PENDING")}</span>
      <span class="meta-pill"><strong>User ID:</strong> ${fmt(form.portalUsername || "—")}</span>
      <span class="meta-pill"><strong>Status:</strong> ${fmt((form.approvalStatus || form.status || "Submitted").toUpperCase())}</span>
    </div>
  </div>
  <div class="photo-box">${photoBlock}</div>
</div>

<!-- I. Personal Details -->
<div class="section">
  <div class="section-title">I. Personal Details</div>
  <div class="fields">
    ${row("Candidate's Name", fmt(p.candidateName || p.studentName))}
    ${row("Initials", fmt(p.initials))}
    ${row("Father's Name", fmt(p.fatherName))}
    ${row("Gender", fmt(p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : undefined))}
    ${row("Date of Birth", fmtDate((p as any).dateOfBirth || o.dateOfBirth))}
    ${row("Caste / Category", fmt(p.caste?.toUpperCase()))}
    ${row("Mobile No.", fmt(p.mobileNo))}
    ${row("WhatsApp No.", fmt(p.whatsappNo))}
    ${row("Telegram No.", fmt(p.telegramNo))}
    <div class="field">
      <div class="field-label">E-Mail ID</div>
      <div class="field-value">${fmt(p.email)}</div>
    </div>
  </div>
</div>

<!-- II. Address Details -->
<div class="section">
  <div class="section-title">II. Address Breakdown Details</div>
  <div class="fields">
    ${row("Door No.", fmt(a.doorNo))}
    ${row("Street / Nagar", fmt(a.streetName || (a as any).streetNagar))}
    ${(a as any).taluk ? row("Taluk", fmt((a as any).taluk)) : ""}
    ${row("District", fmt(a.district))}
    ${row("State", fmt(a.state || "Tamil Nadu"))}
    ${row("Pincode", fmt(a.pincode))}
  </div>
</div>

<!-- V. Batch & Payment Details -->
<div class="section">
  <div class="section-title">III. Batch & Payment Details</div>
  <div class="fields">
    ${row("Batch Name", fmt(b.batchName || form.batchName))}
    ${row("Date of Payment", fmtDate(b.dateOfPayment))}
    ${row("Batch Start Date", fmtDate(b.batchDurationStart))}
    ${row("Batch End Date", fmtDate(b.batchDurationEnd))}
    ${row("Mode of Transaction", fmt(modeLabel[b.modeOfTransaction] || b.modeOfTransaction))}
  </div>
</div>

<!-- ═══════════════════════ PAGE 2 ═══════════════════════ -->
<div class="page-break"></div>

<div class="page2-header">
  <div class="page2-brand">
    <img src="${bannerUrl}" alt="Logo" class="page2-logo" />
    <span><strong>Karthikeyan Analysis Study Circle</strong> &bull; Student Application Dossier (Continued)</span>
  </div>
  <div>
    <strong>${fmt(p.studentName)}</strong> &nbsp;|&nbsp; ${fmt(b.batchName || form.batchName)}
  </div>
</div>

<!-- IV. Educational Details -->
<div class="section">
  <div class="section-title">IV. Educational Qualifications</div>
  ${
    ed.records.length === 0
      ? `<p style="font-size:8pt;color:#94a3b8;padding:4px 0;">No education records provided.</p>`
      : `<table class="edu-table">
           <thead>
             <tr>
               <th>Degree / Tier</th>
               <th>Major / Stream</th>
               <th>% of Marks</th>
               <th>PSTM / Passing Year</th>
             </tr>
           </thead>
           <tbody>${educationRows}</tbody>
         </table>`
  }
</div>

<!-- V. Demographic & Background Details -->
<div class="section">
  <div class="section-title">V. Demographic & Background Details</div>
  <div class="fields">
    ${row("Marital Status", fmt(o.maritalStatus ? o.maritalStatus.charAt(0).toUpperCase() + o.maritalStatus.slice(1) : undefined))}
    ${row("Work Status", fmt(workStatusLabel[o.workStatus] || o.workStatus))}
    ${
      (o as any).departmentName
        ? row("Department Name", fmt((o as any).departmentName))
        : ""
    }
    ${
      (o as any).previousTnpscExperience
        ? row("Previous TNPSC Exam", fmt((o as any).previousTnpscExperience))
        : ""
    }
    ${
      o.natureOfWork
        ? `<div class="field full"><div class="field-label">Nature of Work</div><div class="field-value">${fmt(o.natureOfWork)}</div></div>`
        : ""
    }
  </div>
</div>

<!-- VI. Terms & Conditions -->
<div class="section">
  <div class="section-title">VI. Declaration & Terms & Conditions</div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <span style="font-size:8.5pt;font-weight:600;color:${termsAgreed >= 5 || t.agreedAllTerms ? "#16a34a" : "#dc2626"};">
      ${termsAgreed >= 5 || t.agreedAllTerms ? "5 / 5 terms agreed" : `${termsAgreed} / 5 terms agreed`}
    </span>
    ${termsAgreed >= 5 || t.agreedAllTerms ? '<span style="color:#16a34a;font-size:8pt;">✓ All declarations accepted</span>' : ""}
  </div>
  <ol class="terms-list">
    ${[
      "I confirm the information provided is true, complete, and accurate to the best of my knowledge.",
      "I agree to abide by all rules, regulations, and guidelines of Karthikeyan Analysis Study Circle.",
      "I will not share, record, or distribute proprietary course content or materials without prior written permission.",
      "I accept the terms of the fee payment and refund policy as stated in the course prospectus.",
      "I have read and understood the student code of conduct, privacy policy, and admission terms.",
    ]
      .map(
        (text, i) =>
          `<li style="color:${t.agreedAllTerms || t[`term${i + 1}` as keyof typeof t] ? "#1e293b" : "#94a3b8"};">${
            t.agreedAllTerms || t[`term${i + 1}` as keyof typeof t] ? "☑" : "☐"
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
  <div style="flex:1.4;">
    <div class="office-label">For Office Verification Only</div>
    <div class="office-box">
      <div style="margin-bottom:4px;">Enrollment No: _____________________</div>
      <div style="margin-bottom:4px;">Verified by: _________________________</div>
      <div>Date: ____________________________</div>
    </div>
  </div>
</div>

</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=750");
  if (!win) {
    alert("Please allow pop-ups for this site to generate PDFs.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();

  // Ensure styles & banner image are fully loaded before opening the print dialog
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // Ignore if closed
    }
  }, 700);
}
