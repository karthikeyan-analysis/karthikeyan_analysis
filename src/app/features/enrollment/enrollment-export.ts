import * as XLSX from "xlsx";
import type { EnrollmentForm } from "./enrollment-types";
import { Timestamp } from "firebase/firestore";

/**
 * Convert enrollment forms to flat structure for Excel export
 */
function flattenEnrollmentForm(form: EnrollmentForm): Record<string, any> {
  const formatDate = (date: any): string => {
    if (!date) return "";
    if (date instanceof Timestamp)
      return date.toDate().toISOString().split("T")[0];
    if (date instanceof Date) return date.toISOString().split("T")[0];
    return String(date);
  };

  return {
    // Metadata
    "Form ID": form.id,
    Status: form.status,
    "Submitted By": form.submittedBy,
    "Batch ID": form.batchId,
    "Created At": formatDate(form.createdAt),
    "Updated At": formatDate(form.updatedAt),

    // Personal Details
    "Student Name": form.personalDetails.studentName,
    "Father's Name": form.personalDetails.fatherName,
    "Date of Birth": form.personalDetails.dateOfBirth,
    Gender: form.personalDetails.gender,
    Caste: form.personalDetails.caste,
    "Mobile No": form.personalDetails.mobileNo,
    "WhatsApp No": form.personalDetails.whatsappNo,
    "Telegram No": form.personalDetails.telegramNo || "",
    Email: form.personalDetails.email,

    // Address Details
    "Door No": form.addressDetails.doorNo,
    "Street/Nagar": form.addressDetails.streetNagar,
    District: form.addressDetails.district,
    State: form.addressDetails.state,
    Pincode: form.addressDetails.pincode,

    // Educational Details (comma-separated)
    Education: form.educationalDetails.records
      .map(
        (r) =>
          `${r.tier} (${r.majorStream}: ${r.percentageOfMarks}% - ${r.yearOfPassing})`,
      )
      .join("; "),

    // Other Details
    "Marital Status": form.otherDetails.maritalStatus,
    "Work Status": form.otherDetails.workStatus,
    "Nature of Work": form.otherDetails.natureOfWork || "",

    // Batch Details
    "Batch Name": form.batchDetails.batchName,
    "Batch Duration Start": form.batchDetails.batchDurationStart,
    "Batch Duration End": form.batchDetails.batchDurationEnd,
    "Date of Payment": form.batchDetails.dateOfPayment,
    "Mode of Transaction": form.batchDetails.modeOfTransaction,

    // Terms & Conditions
    "Term 1 Agreed": form.termsAndConditions.term1,
    "Term 2 Agreed": form.termsAndConditions.term2,
    "Term 3 Agreed": form.termsAndConditions.term3,
    "Term 4 Agreed": form.termsAndConditions.term4,
    "Term 5 Agreed": form.termsAndConditions.term5,
  };
}

/**
 * Export enrollment forms to Excel by badge/batch
 */
export async function exportEnrollmentFormsToExcel(
  forms: EnrollmentForm[],
  batchName?: string,
): Promise<void> {
  if (forms.length === 0) {
    alert("No enrollment forms to export");
    return;
  }

  // Group forms by batch
  const groupedByBatch = new Map<string, EnrollmentForm[]>();
  forms.forEach((form) => {
    const key = form.batchId || "Unknown";
    if (!groupedByBatch.has(key)) {
      groupedByBatch.set(key, []);
    }
    groupedByBatch.get(key)!.push(form);
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add a sheet for each batch
  groupedByBatch.forEach((batchForms, batchId) => {
    const flatData = batchForms.map((form) => flattenEnrollmentForm(form));
    const worksheet = XLSX.utils.json_to_sheet(flatData);

    // Auto-fit column widths
    const maxWidth = 30;
    const colWidths = Object.keys(flatData[0] || {}).map((key) => ({
      wch: Math.min(maxWidth, key.length + 2),
    }));
    worksheet["!cols"] = colWidths;

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      batchName || batchId.substring(0, 31), // Sheet name limit is 31 chars
    );
  });

  // Generate and download file
  const fileName = `Enrollment_Forms_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export single batch enrollment forms
 */
export async function exportBatchEnrollmentForms(
  forms: EnrollmentForm[],
  batchName: string,
): Promise<void> {
  if (forms.length === 0) {
    alert(`No enrollment forms found for batch: ${batchName}`);
    return;
  }

  const flatData = forms.map((form) => flattenEnrollmentForm(form));
  const worksheet = XLSX.utils.json_to_sheet(flatData);

  // Auto-fit column widths
  const maxWidth = 30;
  const colWidths = Object.keys(flatData[0] || {}).map((key) => ({
    wch: Math.min(maxWidth, key.length + 2),
  }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, batchName.substring(0, 31));

  const fileName = `${batchName}_Enrollments_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export to CSV format
 */
export async function exportEnrollmentFormsToCSV(
  forms: EnrollmentForm[],
  fileName: string = "enrollment_forms.csv",
): Promise<void> {
  if (forms.length === 0) {
    alert("No enrollment forms to export");
    return;
  }

  const flatData = forms.map((form) => flattenEnrollmentForm(form));
  const worksheet = XLSX.utils.json_to_sheet(flatData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  // Download CSV
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/csv;charset=utf-8," + encodeURIComponent(csv),
  );
  element.setAttribute("download", fileName);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
