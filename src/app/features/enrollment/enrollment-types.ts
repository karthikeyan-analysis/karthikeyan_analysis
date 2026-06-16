import { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// SECTION A: PERSONAL DETAILS
// ─────────────────────────────────────────────────────────────
export interface PersonalDetails {
  studentName: string;
  fatherName: string;
  dateOfBirth: string; // ISO format: YYYY-MM-DD
  gender: "male" | "female" | "other";
  caste: "general" | "bc" | "mbc" | "sc" | "st";
  mobileNo: string;
  whatsappNo: string;
  telegramNo?: string;
  email: string;
  photoURL?: string; // File upload URL
}

// ─────────────────────────────────────────────────────────────
// SECTION B: ADDRESS DETAILS
// ─────────────────────────────────────────────────────────────
export interface AddressDetails {
  doorNo: string;
  streetNagar: string;
  district: string;
  state: string;
  pincode: string;
}

// ─────────────────────────────────────────────────────────────
// SECTION C: EDUCATIONAL DETAILS
// ─────────────────────────────────────────────────────────────
export interface EducationRecord {
  tier: "UG" | "PG" | "Other"; // Under Graduate, Post Graduate, Other
  majorStream: "Maths" | "Statistics" | "Economics"; // Only valid for UG/PG
  percentageOfMarks: string; // Number as string
  yearOfPassing: string; // Year as string
}

export interface EducationalDetails {
  records: EducationRecord[];
}

// ─────────────────────────────────────────────────────────────
// SECTION D: OTHER DETAILS
// ─────────────────────────────────────────────────────────────
export interface OtherDetails {
  maritalStatus: "married" | "unmarried";
  workStatus: "private_emp" | "govt_emp" | "housewife" | "aspirant";
  natureOfWork?: string; // Conditional: shown if workStatus is "private_emp" or "govt_emp"
}

// ─────────────────────────────────────────────────────────────
// SECTION E: BATCH DETAILS
// ─────────────────────────────────────────────────────────────
export interface BatchDetails {
  batchName: string; // e.g., "STAT WIN"
  batchDurationStart: string; // ISO format: YYYY-MM-DD
  batchDurationEnd: string; // ISO format: YYYY-MM-DD
  dateOfPayment: string; // ISO format: YYYY-MM-DD
  modeOfTransaction: "upi" | "credit_card" | "bank_transfer" | "cash";
}

// ─────────────────────────────────────────────────────────────
// SECTION F: TERMS & CONDITIONS
// ─────────────────────────────────────────────────────────────
export interface TermsAndConditions {
  term1: boolean; // Acceptance of terms
  term2: boolean;
  term3: boolean;
  term4: boolean;
  term5: boolean;
}

// ─────────────────────────────────────────────────────────────
// COMBINED ENROLLMENT FORM
// ─────────────────────────────────────────────────────────────
export interface EnrollmentForm {
  // Metadata
  id: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  status: "draft" | "submitted" | "completed";
  submittedBy: string; // User email or ID
  batchId: string; // Reference to batch badge

  // Form sections
  personalDetails: PersonalDetails;
  addressDetails: AddressDetails;
  educationalDetails: EducationalDetails;
  otherDetails: OtherDetails;
  batchDetails: BatchDetails;
  termsAndConditions: TermsAndConditions;

  // Shareable link metadata
  shareableLink?: string; // Generated URL/token
  shareableTokenExpiry?: Timestamp | Date; // Optional expiry
}

// ─────────────────────────────────────────────────────────────
// SHAREABLE LINK DTO
// ─────────────────────────────────────────────────────────────
export interface ShareableFormLink {
  id: string;
  formId: string;
  batchId: string;
  token: string; // Unique random token
  createdAt: Timestamp | Date;
  expiresAt?: Timestamp | Date;
  clickCount: number;
  lastClickedAt?: Timestamp | Date;
  status: "active" | "expired" | "revoked";
}

// ─────────────────────────────────────────────────────────────
// FORM SUBMISSION DTO (for API/Firestore)
// ─────────────────────────────────────────────────────────────
export interface EnrollmentFormDTO {
  personalDetails: PersonalDetails;
  addressDetails: AddressDetails;
  educationalDetails: EducationalDetails;
  otherDetails: OtherDetails;
  batchDetails: BatchDetails;
  termsAndConditions: TermsAndConditions;
  batchId: string;
}

// ─────────────────────────────────────────────────────────────
// FILTER & EXPORT OPTIONS
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
