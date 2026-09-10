import { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// BATCH ENROLLMENT CONFIGURATION (Admin / Editable Box)
// ─────────────────────────────────────────────────────────────
export interface BatchEnrollmentConfig {
  batchId: string;
  courseName: string; // Online Live Crash Course Name (e.g. "TNPSC COMBINED STATISTICAL SERVICES EXAMINATION - ONLINE LIVE CRASH COURSE")
  startingDate: string; // Dynamic / Editable starting date
  duration: string; // Dynamic / Editable duration (e.g. "60 Days / 120 Hours")
  note?: string; // Optional admin banner notes/instructions for students
  isOpen: boolean; // Whether enrollment is currently open
  updatedAt?: Timestamp | Date | string;
}

// ─────────────────────────────────────────────────────────────
// SCHEDULED ENROLLMENT FORMS (Multiple forms under any batch)
// ─────────────────────────────────────────────────────────────
export interface ScheduledEnrollmentForm {
  id: string;
  formTitle: string; // Display title, e.g. "Crash Course October Batch Enrollment"
  batchId: string; // Target Batch ID
  batchName?: string;
  courseName: string; // Online Live Crash Course Name
  startingDate: string; // Starting date
  duration: string; // Duration e.g. "60 Days / 120 Hours"
  note?: string; // Banner note / instructions
  scheduleStart?: string; // Optional ISO string for scheduled start
  scheduleEnd?: string; // Optional ISO string for deadline / expiry
  status: "active" | "scheduled" | "closed";
  isOpen: boolean; // Manual master toggle
  createdAt: Timestamp | Date | any;
  updatedAt?: Timestamp | Date | any;
}

// ─────────────────────────────────────────────────────────────
// SECTION A: PERSONAL & CONTACT DETAILS
// ─────────────────────────────────────────────────────────────
export interface PersonalDetails {
  gender: "male" | "female" | "other" | string;
  candidateName: string; // Auto CAPITAL LETTERS live
  initials: string; // Auto CAPITAL LETTERS live
  studentName: string; // Full composite: `${candidateName} ${initials}`.trim()
  fatherName: string; // Forced CAPITAL LETTERS live
  email: string; // Standard font (normal case, no forced capitalization)
  mobileNo: string;
  whatsappNo: string;
  isWhatsappSameAsMobile?: boolean; // Checkbox to auto-sync mobile to whatsapp
  caste?: "general" | "bc" | "mbc" | "sc" | "st" | string;
  telegramNo?: string;
  photoURL?: string;
  signatureURL?: string;
}

// ─────────────────────────────────────────────────────────────
// SECTION B: ADDRESS BREAKDOWN DETAILS
// ─────────────────────────────────────────────────────────────
export interface AddressDetails {
  doorNo: string;
  streetName: string;
  streetNagar?: string; // backward compat alias
  taluk: string;
  district: string;
  pincode: string;
  state?: string;
}

// ─────────────────────────────────────────────────────────────
// SECTION C: EDUCATIONAL QUALIFICATIONS (Dynamic Table)
// ─────────────────────────────────────────────────────────────
export type AllowedDegree = "BSc" | "MSc" | "MPhil" | "PhD";

export interface EducationRecord {
  degree: AllowedDegree | string; // Hierarchical order: BSc first -> MSc -> MPhil/PhD
  major: "Mathematics" | "Statistics" | "Economics" | "Other" | string;
  otherMajor?: string; // Visible when major === "Other"
  percentage: string; // Normal text/numeric input
  pstm: "Yes" | "No" | string; // Puzhkal Kudinila Padithavar / Tamil Medium
  // Legacy / export compatibility aliases:
  tier?: "UG" | "PG" | "Other" | string;
  majorStream?: "Maths" | "Statistics" | "Economics" | string;
  percentageOfMarks?: string;
  yearOfPassing?: string;
}

export interface EducationalDetails {
  records: EducationRecord[];
}

// ─────────────────────────────────────────────────────────────
// SECTION D: DEMOGRAPHIC & BACKGROUND DETAILS
// ─────────────────────────────────────────────────────────────
export type WorkStatusOption =
  | "Government Employee"
  | "Private Employee"
  | "Full-time Aspirant"
  | "Home Maker"
  | string;

export interface DemographicDetails {
  dateOfBirth: string; // Date picker format: YYYY-MM-DD
  maritalStatus: "Married" | "Unmarried" | string;
  workStatus: WorkStatusOption;
  departmentName?: string; // Conditional sub-field when workStatus === "Government Employee"
  previousTnpscExperience: "First Attempt" | "Already Appeared" | string;
  // Legacy compatibility:
  natureOfWork?: string;
}

// Legacy alias for OtherDetails:
export type OtherDetails = DemographicDetails;

// ─────────────────────────────────────────────────────────────
// SECTION E: BATCH DETAILS
// ─────────────────────────────────────────────────────────────
export interface BatchDetails {
  batchName: string;
  courseName?: string;
  batchDurationStart?: string;
  batchDurationEnd?: string;
  dateOfPayment?: string;
  modeOfTransaction?: "upi" | "credit_card" | "bank_transfer" | "cash" | string;
}

// ─────────────────────────────────────────────────────────────
// SECTION F: DECLARATION & TERMS
// ─────────────────────────────────────────────────────────────
export interface TermsAndConditions {
  agreedAllTerms: boolean; // Final checkbox: "I Agree to the above Declaration & Terms and Conditions."
  term1?: boolean;
  term2?: boolean;
  term3?: boolean;
  term4?: boolean;
  term5?: boolean;
  term6?: boolean;
  term7?: boolean;
  term8?: boolean;
  term9?: boolean;
  term10?: boolean;
}

// ─────────────────────────────────────────────────────────────
// COMBINED ENROLLMENT FORM & APPLICATION
// ─────────────────────────────────────────────────────────────
export interface EnrollmentForm {
  id: string;
  createdAt: Timestamp | Date | any;
  updatedAt: Timestamp | Date | any;
  status: "submitted" | "approved" | "rejected" | "draft" | "completed";
  approvalStatus: "pending" | "approved" | "rejected";
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  submittedBy: string; // Candidate email
  batchId: string;
  batchName?: string;
  courseName?: string;
  scheduledFormId?: string;
  scheduledFormTitle?: string;

  // Generated Login Credentials
  portalUsername: string; // e.g. "KA-2026-XXXX"
  portalPassword: string; // e.g. "Pass@4921"
  studentId?: string; // Unique student identifier e.g. "STU-XXXX"

  // Form Sections
  personalDetails: PersonalDetails;
  addressDetails: AddressDetails;
  educationalDetails: EducationalDetails;
  demographicDetails: DemographicDetails;
  otherDetails: DemographicDetails; // alias for export/pdf
  batchDetails: BatchDetails;
  termsAndConditions: TermsAndConditions;

  // Shareable link info
  shareableLink?: string;
  shareableTokenExpiry?: Timestamp | Date;
}

// ─────────────────────────────────────────────────────────────
// FORM SUBMISSION DTO
// ─────────────────────────────────────────────────────────────
export interface EnrollmentFormDTO {
  batchId: string;
  batchName?: string;
  courseName?: string;
  scheduledFormId?: string;
  scheduledFormTitle?: string;
  personalDetails: PersonalDetails;
  addressDetails: AddressDetails;
  educationalDetails: EducationalDetails;
  demographicDetails: DemographicDetails;
  otherDetails?: DemographicDetails;
  batchDetails?: BatchDetails;
  termsAndConditions: TermsAndConditions;
}

// ─────────────────────────────────────────────────────────────
// SHAREABLE LINK DTO
// ─────────────────────────────────────────────────────────────
export interface ShareableFormLink {
  id: string;
  formId: string;
  batchId: string;
  token: string;
  createdAt: Timestamp | Date;
  expiresAt?: Timestamp | Date;
  clickCount: number;
  lastClickedAt?: Timestamp | Date;
  status: "active" | "expired" | "revoked";
}

// ─────────────────────────────────────────────────────────────
// EXPORT OPTIONS
// ─────────────────────────────────────────────────────────────
export interface ExportOptions {
  batchIds: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeFields: (keyof EnrollmentForm)[];
  format: "xlsx" | "csv" | "json";
}
