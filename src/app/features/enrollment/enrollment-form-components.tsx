import React, { useState } from "react";
import bannerImage from "../../../banner.jpeg";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Plus,
  Trash2,
  Camera,
  X,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  Info,
  ShieldCheck,
  AlertCircle,
  GraduationCap,
  FileCheck,
  Upload,
  User,
  CreditCard,
} from "lucide-react";
import type {
  PersonalDetails,
  AddressDetails,
  EducationalDetails,
  EducationRecord,
  DemographicDetails,
  BatchDetails,
  BatchEnrollmentConfig,
  TermsAndConditions,
  AllowedDegree,
  EnrollmentForm,
} from "./enrollment-types";

const INPUT_CLS =
  "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm";
const LABEL_CLS =
  "block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5";
const SELECT_CLS =
  "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm";

// ─────────────────────────────────────────────────────────────
// 1. HEADER & COURSE INFORMATION (Admin / Editable Box Display)
// ─────────────────────────────────────────────────────────────
interface CourseHeaderBoxProps {
  config?: BatchEnrollmentConfig | null;
  batchName?: string;
  onEditBatchDetails?: () => void;
  canEdit?: boolean;
}

export function CourseHeaderBox({
  config,
  batchName,
  onEditBatchDetails,
  canEdit,
}: CourseHeaderBoxProps) {
  const courseTitle =
    config?.courseName?.trim() ||
    batchName?.trim() ||
    "ONLINE LIVE CRASH COURSE";

  const resolvedBatchName =
    batchName?.trim() || config?.batchId || "Crash Course Batch";

  const startDate =
    config?.batchStartDate?.trim() ||
    config?.startingDate?.trim() ||
    "To be announced / Immediate";

  const endDate =
    config?.batchEndDate?.trim() ||
    config?.duration?.trim() ||
    "Complete Syllabus Coverage";

  return (
    <div className="space-y-4">
      {/* Official Institute Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Official Banner Image */}
        <div className="w-full bg-white px-3 py-4 sm:px-6 sm:py-6 flex items-center justify-center">
          <img
            src={bannerImage}
            alt="Karthikeyan Analysis Study Circle & Learning Resources"
            className="w-full max-w-3xl max-h-24 sm:max-h-32 md:max-h-40 object-contain"
          />
        </div>

        {/* Clean Sub-header Bar */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Official Batch Enrollment Portal</span>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && onEditBatchDetails && (
              <button
                type="button"
                onClick={onEditBatchDetails}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition"
              >
                <span>Edit Batch Details</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Enrollment Status:
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  config?.isOpen === false
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    config?.isOpen === false
                      ? "bg-rose-500"
                      : "bg-emerald-500 animate-pulse"
                  }`}
                />
                {config?.isOpen === false
                  ? "Admissions Closed"
                  : "Admissions Open"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Course & Batch Information Box (Clean, Professional, Explicit Fields) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base md:text-lg">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Batch &amp; Course Information</span>
          </div>
          {canEdit && onEditBatchDetails && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEditBatchDetails}
              className="text-xs font-semibold gap-1.5 h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              Modify Details
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Batch Name */}
          <div className="sm:col-span-2 bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Batch Name
            </span>
            <span className="text-base font-bold text-indigo-900 mt-1 block">
              {resolvedBatchName}
            </span>
          </div>

          {/* Batch Start Date */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Batch Start Date
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                {startDate}
              </span>
            </div>
          </div>

          {/* Batch End Date */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Batch End Date
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                {endDate}
              </span>
            </div>
          </div>

          {/* Course Name Banner */}
          <div className="sm:col-span-2 md:col-span-3 bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Course Name
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 mt-1 block">
              {courseTitle}
            </span>
          </div>

          {/* Mode of Instruction */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Instruction Mode
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                100% Live CBT
              </span>
            </div>
          </div>
        </div>

        {config?.note?.trim() && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{config.note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. PERSONAL & CONTACT DETAILS
// ─────────────────────────────────────────────────────────────
interface PersonalContactFormProps {
  data: PersonalDetails;
  onChange: (data: PersonalDetails) => void;
  photoFile?: File | null;
  photoPreview?: string | null;
  onPhotoFileChange?: (file: File | null) => void;
}

export function PersonalContactForm({
  data,
  onChange,
  photoFile,
  photoPreview,
  onPhotoFileChange,
}: PersonalContactFormProps) {
  const [photoError, setPhotoError] = useState<string | null>(null);

  const set = (key: keyof PersonalDetails, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const handleCandidateNameChange = (val: string) => {
    const uppercaseVal = val.toUpperCase();
    const fullName =
      `${uppercaseVal} ${(data.initials || "").toUpperCase()}`.trim();
    onChange({
      ...data,
      candidateName: uppercaseVal,
      studentName: fullName,
    });
  };

  const handleInitialsChange = (val: string) => {
    const uppercaseVal = val.toUpperCase();
    const fullName =
      `${(data.candidateName || "").toUpperCase()} ${uppercaseVal}`.trim();
    onChange({
      ...data,
      initials: uppercaseVal,
      studentName: fullName,
    });
  };

  const handleMobileChange = (val: string) => {
    const nextWhatsapp = data.isWhatsappSameAsMobile ? val : data.whatsappNo;
    onChange({
      ...data,
      mobileNo: val,
      whatsappNo: nextWhatsapp,
    });
  };

  const handleSyncWhatsappToggle = (checked: boolean) => {
    onChange({
      ...data,
      isWhatsappSameAsMobile: checked,
      whatsappNo: checked ? data.mobileNo : data.whatsappNo,
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError(
        "Please select a valid image file (JPG, JPEG, PNG, or WEBP).",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(
        "Image file size exceeds 5MB limit. Please choose a smaller photo.",
      );
      return;
    }

    if (onPhotoFileChange) {
      onPhotoFileChange(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoError(null);
    if (onPhotoFileChange) {
      onPhotoFileChange(null);
    }
    set("photoURL", "");
  };

  const currentPhoto = photoPreview || data.photoURL;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            1
          </span>
          Personal &amp; Contact Details
        </h2>
      </div>

      <CardContent className="p-6 space-y-5">
        {/* Passport Size Photo Upload Section */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Photo Preview Frame */}
            <div className="shrink-0 text-center">
              <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-lg border-2 border-dashed border-slate-300 bg-white overflow-hidden flex flex-col items-center justify-center shadow-xs relative">
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt="Passport Photo Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-3 space-y-1">
                    <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                    <span className="text-[11px] font-semibold text-slate-600 block">
                      Passport Photo
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      35mm x 45mm
                    </span>
                  </div>
                )}
              </div>
              {currentPhoto && (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />{" "}
                    Selected
                  </span>
                </div>
              )}
            </div>

            {/* Upload Controls & Guidelines */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Student Passport Size Photo *
                </label>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Please upload a recent, formal front-facing passport
                  photograph with a light or white background. This will be
                  stored securely and displayed on your official admission
                  receipt, application PDF, and student portal identity.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>
                    {currentPhoto ? "Change Photo" : "Upload Passport Photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>

                {currentPhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-medium rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {photoError && (
                <div className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-md">
                  {photoError}
                </div>
              )}

              <div className="text-[11px] text-slate-400 space-y-0.5">
                <div>
                  • Accepted formats: JPG, JPEG, PNG, WEBP (Max size: 5MB)
                </div>
                <div>
                  • Face should be clearly visible, upright and without
                  hats/sunglasses
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gender Dropdown placed near the top */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={LABEL_CLS}>Gender *</label>
            <select
              className={SELECT_CLS}
              value={data.gender || "male"}
              onChange={(e) => set("gender", e.target.value)}
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Candidate Name */}
          <div className="sm:col-span-2 grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={LABEL_CLS}>Candidate's Name *</label>
              <input
                className={INPUT_CLS}
                placeholder="FIRST & LAST NAME"
                value={data.candidateName || ""}
                onChange={(e) => handleCandidateNameChange(e.target.value)}
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Auto-converted to CAPITAL LETTERS
              </span>
            </div>
            <div>
              <label className={LABEL_CLS}>Initials *</label>
              <input
                className={INPUT_CLS}
                placeholder="E.G. K / S"
                value={data.initials || ""}
                onChange={(e) => handleInitialsChange(e.target.value)}
                maxLength={6}
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                CAPITALS
              </span>
            </div>
          </div>
        </div>

        {/* Father's Name and Email ID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLS}>Father's Name *</label>
            <input
              className={INPUT_CLS}
              placeholder="FATHER'S FULL NAME"
              value={data.fatherName || ""}
              onChange={(e) => set("fatherName", e.target.value.toUpperCase())}
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Forced CAPITAL LETTERS
            </span>
          </div>

          <div>
            <label className={LABEL_CLS}>Email ID *</label>
            <input
              type="email"
              className={INPUT_CLS}
              placeholder="student@example.com"
              value={data.email || ""}
              onChange={(e) =>
                set("email", e.target.value.toLowerCase().trim())
              }
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Standard font (used for student portal &amp; Google login)
            </span>
          </div>
        </div>

        {/* Contact & WhatsApp Numbers with Sync Checkbox */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Contact Number *</label>
              <input
                type="tel"
                className={INPUT_CLS}
                placeholder="10-digit mobile number"
                value={data.mobileNo || ""}
                onChange={(e) => handleMobileChange(e.target.value)}
                maxLength={12}
                required
              />
            </div>

            <div>
              <label className={LABEL_CLS}>WhatsApp Number *</label>
              <input
                type="tel"
                className={`${INPUT_CLS} ${data.isWhatsappSameAsMobile ? "bg-slate-100 text-slate-500" : ""}`}
                placeholder="10-digit WhatsApp number"
                value={data.whatsappNo || ""}
                onChange={(e) => set("whatsappNo", e.target.value)}
                disabled={data.isWhatsappSameAsMobile}
                maxLength={12}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-1 text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={Boolean(data.isWhatsappSameAsMobile)}
              onChange={(e) => handleSyncWhatsappToggle(e.target.checked)}
            />
            <span>WhatsApp number is the same as Contact number</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 2B. ADDRESS BREAKDOWN DETAILS
// ─────────────────────────────────────────────────────────────
interface AddressFormProps {
  data: AddressDetails;
  onChange: (data: AddressDetails) => void;
}

export function AddressBreakdownForm({ data, onChange }: AddressFormProps) {
  const set = (key: keyof AddressDetails, value: string) => {
    onChange({
      ...data,
      [key]: value,
      streetNagar: key === "streetName" ? value : data.streetNagar,
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            2
          </span>
          Address Details
        </h2>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL_CLS}>Door Number *</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. 12/4B"
              value={data.doorNo || ""}
              onChange={(e) => set("doorNo", e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Street Name *</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. Bharathi Nagar, 2nd Cross Street"
              value={data.streetName || data.streetNagar || ""}
              onChange={(e) => set("streetName", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Taluk *</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. Madurai South"
              value={data.taluk || ""}
              onChange={(e) => set("taluk", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>District *</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. Madurai"
              value={data.district || ""}
              onChange={(e) => set("district", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Pincode *</label>
            <input
              className={INPUT_CLS}
              placeholder="6-digit Pincode"
              value={data.pincode || ""}
              onChange={(e) => set("pincode", e.target.value)}
              maxLength={6}
              required
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. EDUCATIONAL QUALIFICATIONS (Dynamic Table Format)
// ─────────────────────────────────────────────────────────────
interface EducationalQualificationsFormProps {
  data: EducationalDetails;
  onChange: (data: EducationalDetails) => void;
}

export function formatDegreeName(degree?: string): string {
  if (!degree) return "—";
  switch (degree) {
    case "BSc":
      return "B.Sc.";
    case "BA":
      return "B.A.";
    case "MSc":
      return "M.Sc.";
    case "MA":
      return "M.A.";
    case "MPhil":
      return "M.Phil.";
    case "PhD":
      return "Ph.D.";
    default:
      return degree;
  }
}

export function EducationalQualificationsForm({
  data,
  onChange,
}: EducationalQualificationsFormProps) {
  const records = data.records || [];

  const hasUG = records.some((r) => r.degree === "BSc" || r.degree === "BA");
  const hasPG = records.some((r) => r.degree === "MSc" || r.degree === "MA");

  // Determine allowed next degree based on strict hierarchy
  const getNextAllowedDegrees = (): AllowedDegree[] => {
    if (!hasUG) return ["BSc", "BA"];
    if (!hasPG) return ["MSc", "MA"];
    return ["MPhil", "PhD"];
  };

  const handleAddRow = () => {
    const allowed = getNextAllowedDegrees();
    if (allowed.length === 0) return;

    const newRecord: EducationRecord = {
      degree: allowed[0],
      major: "Statistics",
      otherMajor: "",
      percentage: "",
      pstm: "No",
      passingYear: "",
    };

    onChange({ records: [...records, newRecord] });
  };

  const handleRemoveRow = (index: number) => {
    const updated = records.filter((_, i) => i !== index);
    onChange({ records: updated });
  };

  const handleUpdateRow = (
    index: number,
    updates: Partial<EducationRecord>,
  ) => {
    const updated = [...records];
    updated[index] = { ...updated[index], ...updates };
    onChange({ records: updated });
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            3
          </span>
          Educational Qualifications
        </h2>

        <Button
          type="button"
          size="sm"
          onClick={handleAddRow}
          disabled={hasUG && hasPG && records.length >= 4}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Degree Row
        </Button>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>Hierarchical Rule:</strong> Degree selection follows a
            sequential order (must add{" "}
            <strong>Bachelor's (B.Sc. / B.A.)</strong> first before unlocking{" "}
            <strong>Master's (M.Sc. / M.A.)</strong>, and Master's before
            unlocking <strong>M.Phil. / Ph.D.</strong>).
          </span>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <GraduationCap className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              No educational qualifications added yet
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Click below to start with your Bachelor's degree (B.Sc. or B.A.)
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleAddRow}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Bachelor's Degree
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Degree *</th>
                  <th className="p-3">Subject / Major *</th>
                  <th className="p-3">Percentage (%) *</th>
                  <th className="p-3">PSTM Applicable? *</th>
                  <th className="p-3">Passing Year *</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {records.map((rec, index) => {
                  return (
                    <tr key={index} className="hover:bg-slate-50/80">
                      {/* Degree Dropdown with Strict Order */}
                      <td className="p-3 min-w-[130px]">
                        <select
                          className={SELECT_CLS}
                          value={rec.degree}
                          onChange={(e) =>
                            handleUpdateRow(index, {
                              degree: e.target.value as AllowedDegree,
                            })
                          }
                        >
                          {index === 0 && (
                            <>
                              <option value="BSc">B.Sc.</option>
                              <option value="BA">B.A.</option>
                            </>
                          )}
                          {index === 1 && (
                            <>
                              <option value="MSc">M.Sc.</option>
                              <option value="MA">M.A.</option>
                            </>
                          )}
                          {index >= 2 && (
                            <>
                              <option value="MPhil">M.Phil.</option>
                              <option value="PhD">Ph.D.</option>
                              <option value="MSc">M.Sc.</option>
                              <option value="MA">M.A.</option>
                            </>
                          )}
                          {rec.degree &&
                            ![
                              "BSc",
                              "BA",
                              "MSc",
                              "MA",
                              "MPhil",
                              "PhD",
                            ].includes(rec.degree) && (
                              <option value={rec.degree}>{rec.degree}</option>
                            )}
                        </select>
                      </td>

                      {/* Subject / Major Dropdown (Maths, Stats, Econ, Other) */}
                      <td className="p-3 min-w-[190px]">
                        <select
                          className={SELECT_CLS}
                          value={rec.major}
                          onChange={(e) =>
                            handleUpdateRow(index, { major: e.target.value })
                          }
                        >
                          <option value="Mathematics">Mathematics</option>
                          <option value="Statistics">Statistics</option>
                          <option value="Economics">Economics</option>
                          <option value="Other">Other</option>
                        </select>

                        {rec.major === "Other" && (
                          <input
                            className={`${INPUT_CLS} mt-2`}
                            placeholder="Enter Subject / Major"
                            value={rec.otherMajor || ""}
                            onChange={(e) =>
                              handleUpdateRow(index, {
                                otherMajor: e.target.value,
                              })
                            }
                            required
                          />
                        )}
                      </td>

                      {/* Percentage Field */}
                      <td className="p-3 min-w-[120px]">
                        <input
                          type="text"
                          className={INPUT_CLS}
                          placeholder="e.g. 78.5%"
                          value={rec.percentage || ""}
                          onChange={(e) =>
                            handleUpdateRow(index, {
                              percentage: e.target.value,
                            })
                          }
                          required
                        />
                      </td>

                      {/* PSTM Applicable? Dropdown */}
                      <td className="p-3 min-w-[120px]">
                        <select
                          className={SELECT_CLS}
                          value={rec.pstm || "No"}
                          onChange={(e) =>
                            handleUpdateRow(index, { pstm: e.target.value })
                          }
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </td>

                      {/* Passing Year */}
                      <td className="p-3 min-w-[120px]">
                        <input
                          type="text"
                          className={INPUT_CLS}
                          placeholder="e.g. 2024"
                          maxLength={6}
                          value={rec.passingYear || rec.yearOfPassing || ""}
                          onChange={(e) =>
                            handleUpdateRow(index, {
                              passingYear: e.target.value,
                              yearOfPassing: e.target.value,
                            })
                          }
                          required
                        />
                      </td>

                      {/* Remove Row */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                          title="Remove degree"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. DEMOGRAPHIC & BACKGROUND DETAILS
// ─────────────────────────────────────────────────────────────
interface DemographicDetailsFormProps {
  data: DemographicDetails;
  onChange: (data: DemographicDetails) => void;
}

export function DemographicDetailsForm({
  data,
  onChange,
}: DemographicDetailsFormProps) {
  const set = (key: keyof DemographicDetails, value: any) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            4
          </span>
          Demographic &amp; Background Details
        </h2>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Date of Birth */}
          <div>
            <label className={LABEL_CLS}>Date of Birth (DOB) *</label>
            <input
              type="date"
              className={INPUT_CLS}
              value={data.dateOfBirth || ""}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              required
            />
          </div>

          {/* Marital Status */}
          <div>
            <label className={LABEL_CLS}>Marital Status *</label>
            <select
              className={SELECT_CLS}
              value={data.maritalStatus || "Unmarried"}
              onChange={(e) => set("maritalStatus", e.target.value)}
              required
            >
              <option value="Unmarried">Unmarried</option>
              <option value="Married">Married</option>
            </select>
          </div>

          {/* Previous TNPSC Exam Experience */}
          <div>
            <label className={LABEL_CLS}>
              Previous TNPSC Exam Experience *
            </label>
            <select
              className={SELECT_CLS}
              value={data.previousTnpscExperience || "First Attempt"}
              onChange={(e) => set("previousTnpscExperience", e.target.value)}
              required
            >
              <option value="First Attempt">First Attempt</option>
              <option value="Already Appeared">Already Appeared</option>
            </select>
          </div>

          {/* Work Status */}
          <div className="sm:col-span-2 md:col-span-3">
            <label className={LABEL_CLS}>Work Status *</label>
            <select
              className={SELECT_CLS}
              value={data.workStatus || "Full-time Aspirant"}
              onChange={(e) => set("workStatus", e.target.value)}
              required
            >
              <option value="Full-time Aspirant">Full-time Aspirant</option>
              <option value="Government Employee">Government Employee</option>
              <option value="Private Employee">Private Employee</option>
              <option value="Home Maker">Home Maker</option>
            </select>
          </div>

          {/* Conditional Sub-field when Government Employee */}
          {data.workStatus === "Government Employee" && (
            <div className="sm:col-span-2 md:col-span-3 bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
              <label className={LABEL_CLS}>Government Department Name *</label>
              <input
                className={INPUT_CLS}
                placeholder="e.g. Department of Economics & Statistics / Revenue"
                value={data.departmentName || ""}
                onChange={(e) => set("departmentName", e.target.value)}
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Required for candidates currently employed in Government service
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. BATCH & PAYMENT DETAILS
// ─────────────────────────────────────────────────────────────
interface BatchPaymentDetailsFormProps {
  data: BatchDetails;
  onChange: (data: BatchDetails) => void;
  batchName?: string;
  courseName?: string;
}

export function BatchPaymentDetailsForm({
  data,
  onChange,
  batchName,
  courseName,
}: BatchPaymentDetailsFormProps) {
  const set = (key: keyof BatchDetails, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const resolvedBatchName =
    batchName?.trim() ||
    data.batchName?.trim() ||
    courseName?.trim() ||
    "Batch";

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            5
          </span>
          Batch &amp; Payment Details
        </h2>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Target Batch Name */}
          <div className="md:col-span-3 bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Enrolled Batch
            </span>
            <span className="text-base font-bold text-indigo-900 mt-1 block">
              {resolvedBatchName}
            </span>
          </div>

          {/* Date of Payment */}
          <div>
            <label className={LABEL_CLS}>Date of Payment *</label>
            <input
              type="date"
              className={INPUT_CLS}
              value={data.dateOfPayment || ""}
              onChange={(e) => set("dateOfPayment", e.target.value)}
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Type or select payment date
            </span>
          </div>

          {/* Mode of Transaction */}
          <div>
            <label className={LABEL_CLS}>Mode of Transaction *</label>
            <select
              className={SELECT_CLS}
              value={data.modeOfTransaction || "UPI"}
              onChange={(e) => set("modeOfTransaction", e.target.value)}
              required
            >
              <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
              <option value="Online Payment">
                Online Payment (Net Banking / Gateway)
              </option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
            </select>
          </div>

          {/* Transaction Reference / UTR Number (Optional) */}
          <div>
            <label className={LABEL_CLS}>
              Transaction ID / UTR No. (Optional)
            </label>
            <input
              type="text"
              className={INPUT_CLS}
              placeholder="e.g. 423901928312"
              value={data.transactionId || ""}
              onChange={(e) => set("transactionId", e.target.value)}
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Reference number from payment receipt
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. DECLARATION, TERMS & SUBMISSION
// ─────────────────────────────────────────────────────────────
export const DECLARATION_TERMS_LIST = [
  "Fees once paid are strictly non-refundable under any circumstances.",
  "This batch consists entirely of LIVE Online Classes. If I miss any live class, it will be my responsibility. Daily class recordings will be provided for reference. The recordings will be accessible only until the completion of the respective batch and will not be available thereafter.",
  "All Class Tests and Mock Tests will be conducted exclusively in LIVE CBT Mode. If I fail to attend a CBT test, no second attempt will be provided, and the question paper will not be shared separately in PDF format.",
  "Since the classes and tests are conducted in a LIVE and monitored environment, I am required to keep my video ON throughout the test until its completion. Failure to comply may result in appropriate action.",
  "Test-related doubts, discussions, and clarifications will be addressed only during the designated time slots. I understand that the institute gives high priority to conducting tests according to the scheduled time.",
  "Any misconduct, inappropriate behaviour, or disturbance during LIVE classes or tests may result in my immediate removal from the session and/or termination from the batch.",
  "I agree not to share, distribute, reproduce, or circulate any study materials provided by the institute, including notes, books, test questions, PDFs, recordings, or other course materials, with any other person. If such unauthorized sharing is found, the institute reserves the right to terminate my enrollment from the batch without refund.",
  "Class schedules and test schedules are subject to change depending on the official examination dates, notifications, or other academic requirements. Any such changes will be communicated by the institute.",
  "I will strictly adhere to the academic schedule, attendance requirements, and test rules prescribed by the institute for this batch.",
  "I confirm that I have read, understood, and agreed to all the above terms and conditions and undertake to follow the rules and guidelines of the institute throughout the course.",
];

interface DeclarationTermsFormProps {
  terms: TermsAndConditions;
  onChange: (terms: TermsAndConditions) => void;
  isStep2?: boolean;
  /**
   * Batch-specific instructions shown above the terms list (e.g. a Test
   * Batch's custom instructions). Omit to show nothing extra.
   */
  customInstructions?: string;
  /**
   * Batch-specific terms & conditions text that REPLACES the default
   * DECLARATION_TERMS_LIST for this rendering only. Omit/empty to keep the
   * default shared terms — every other batch is unaffected either way.
   */
  customTerms?: string;
  /**
   * Admin-customized declaration terms array (e.g. from scheduledForm or config).
   */
  termsList?: string[];
}

export function DeclarationTermsForm({
  terms,
  onChange,
  isStep2 = false,
  customInstructions,
  customTerms,
  termsList,
}: DeclarationTermsFormProps) {
  const toggleFinalAgree = (checked: boolean) => {
    onChange({
      ...terms,
      agreedAllTerms: checked,
      term1: checked,
      term2: checked,
      term3: checked,
      term4: checked,
      term5: checked,
      term6: checked,
      term7: checked,
      term8: checked,
      term9: checked,
      term10: checked,
    });
  };

  const effectiveTerms: string[] =
    termsList && termsList.length > 0
      ? termsList
      : customTerms?.trim()
        ? customTerms
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : DECLARATION_TERMS_LIST;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            {isStep2 ? "2" : "6"}
          </span>
          Declaration &amp; Terms and Conditions
        </h2>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto space-y-3">
          <p className="font-bold text-slate-900 uppercase tracking-wide">
            DECLARATION &amp; TERMS AND CONDITIONS
          </p>
          {customInstructions?.trim() ? (
            <p className="whitespace-pre-wrap font-medium text-slate-900">
              {customInstructions.trim()}
            </p>
          ) : null}
          <p>
            By submitting this application, I acknowledge and agree to the
            following terms and conditions:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-800 font-normal">
            {effectiveTerms.map((text, i) => (
              <li key={i} className="pl-1">
                <span className="font-medium text-slate-900">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Final Mandatory Checkbox */}
        <div className="pt-3 border-t border-slate-200">
          <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition-colors select-none">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 mt-0.5"
              checked={Boolean(terms.agreedAllTerms)}
              onChange={(e) => toggleFinalAgree(e.target.checked)}
              required
            />
            <span className="text-sm font-bold text-indigo-950">
              I read and confirm the above details are correct, and I agree to
              the above Declaration &amp; Terms and Conditions. *
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. ENROLLMENT FORM PREVIEW FOR ADMIN DIALOG & PDF
// ─────────────────────────────────────────────────────────────
interface EnrollmentFormPreviewProps {
  form: EnrollmentForm;
}

export function EnrollmentFormPreview({ form }: EnrollmentFormPreviewProps) {
  const p = form.personalDetails;
  const a = form.addressDetails;
  const ed = form.educationalDetails;
  const d = form.demographicDetails || form.otherDetails;

  return (
    <div className="space-y-6 text-sm">
      {/* Credentials Banner for Admin */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
            Generated Student Credentials
          </span>
          <div className="text-sm font-semibold text-slate-900 mt-0.5">
            Username:{" "}
            <code className="bg-white px-2 py-0.5 rounded border border-indigo-200 font-mono text-indigo-700">
              {form.portalUsername}
            </code>
            {" • "}Password:{" "}
            <code className="bg-white px-2 py-0.5 rounded border border-indigo-200 font-mono text-indigo-700">
              {form.portalPassword}
            </code>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            form.approvalStatus === "approved"
              ? "bg-emerald-100 text-emerald-800"
              : form.approvalStatus === "rejected"
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {form.approvalStatus === "approved"
            ? "Approved"
            : form.approvalStatus === "rejected"
              ? "Rejected"
              : "Pending Approval"}
        </span>
      </div>

      {/* Personal Info with Passport Photo */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-1">
          Personal &amp; Contact Details
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
          {/* Passport Photo */}
          <div className="shrink-0 text-center">
            {p?.photoURL ? (
              <img
                src={p.photoURL}
                alt="Candidate Passport Photo"
                className="w-24 h-32 object-cover rounded-lg border-2 border-slate-300 shadow-sm"
              />
            ) : (
              <div className="w-24 h-32 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-2">
                <Camera className="w-6 h-6 mb-1 text-slate-300" />
                <span className="text-[10px] text-slate-400">No Photo</span>
              </div>
            )}
            <span className="text-[10px] font-semibold text-slate-500 block mt-1">
              Passport Photo
            </span>
          </div>

          {/* Details Grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs w-full">
            <div>
              <span className="text-slate-500">Candidate Name:</span>{" "}
              <span className="font-semibold text-slate-800">
                {p?.studentName || p?.candidateName}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Gender:</span>{" "}
              <span className="font-semibold text-slate-800 capitalize">
                {p?.gender}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Father's Name:</span>{" "}
              <span className="font-semibold text-slate-800">
                {p?.fatherName}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Email:</span>{" "}
              <span className="font-semibold text-slate-800">{p?.email}</span>
            </div>
            <div>
              <span className="text-slate-500">Mobile:</span>{" "}
              <span className="font-semibold text-slate-800">
                {p?.mobileNo}
              </span>
            </div>
            <div>
              <span className="text-slate-500">WhatsApp:</span>{" "}
              <span className="font-semibold text-slate-800">
                {p?.whatsappNo}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-1">
          Address Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <span className="text-slate-500">Door No:</span>{" "}
            <span className="font-semibold text-slate-800">{a?.doorNo}</span>
          </div>
          <div>
            <span className="text-slate-500">Street Name:</span>{" "}
            <span className="font-semibold text-slate-800">
              {a?.streetName || a?.streetNagar}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Taluk:</span>{" "}
            <span className="font-semibold text-slate-800">{a?.taluk}</span>
          </div>
          <div>
            <span className="text-slate-500">District:</span>{" "}
            <span className="font-semibold text-slate-800">{a?.district}</span>
          </div>
          <div>
            <span className="text-slate-500">Pincode:</span>{" "}
            <span className="font-semibold text-slate-800">{a?.pincode}</span>
          </div>
        </div>
      </div>

      {/* Educational Qualifications Table */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-1">
          Educational Qualifications
        </h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 font-bold text-slate-700">
              <tr>
                <th className="p-2">Degree</th>
                <th className="p-2">Major / Subject</th>
                <th className="p-2">Percentage</th>
                <th className="p-2">PSTM Applicable</th>
                <th className="p-2">Passing Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ed?.records?.map((r, i) => (
                <tr key={i}>
                  <td className="p-2 font-semibold">
                    {formatDegreeName(r.degree || r.tier)}
                  </td>
                  <td className="p-2">
                    {r.major === "Other"
                      ? r.otherMajor
                      : r.major || r.majorStream}
                  </td>
                  <td className="p-2">
                    {r.percentage || r.percentageOfMarks}%
                  </td>
                  <td className="p-2">{r.pstm || "No"}</td>
                  <td className="p-2">
                    {r.passingYear || r.yearOfPassing || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demographics */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-1">
          Demographic &amp; Background Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <span className="text-slate-500">Date of Birth:</span>{" "}
            <span className="font-semibold text-slate-800">
              {d?.dateOfBirth}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Marital Status:</span>{" "}
            <span className="font-semibold text-slate-800">
              {d?.maritalStatus}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Work Status:</span>{" "}
            <span className="font-semibold text-slate-800">
              {d?.workStatus}
            </span>
          </div>
          {d?.departmentName && (
            <div className="col-span-2">
              <span className="text-slate-500">Department:</span>{" "}
              <span className="font-semibold text-slate-800">
                {d.departmentName}
              </span>
            </div>
          )}
          <div>
            <span className="text-slate-500">TNPSC Experience:</span>{" "}
            <span className="font-semibold text-slate-800">
              {d?.previousTnpscExperience}
            </span>
          </div>
        </div>
      </div>

      {/* Batch & Payment Details */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-1">
          Batch &amp; Payment Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <span className="text-slate-500">Batch Name:</span>{" "}
            <span className="font-semibold text-slate-800">
              {form.batchDetails?.batchName || form.batchName || "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Date of Payment:</span>{" "}
            <span className="font-semibold text-slate-800">
              {form.batchDetails?.dateOfPayment || "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Mode of Transaction:</span>{" "}
            <span className="font-semibold text-slate-800">
              {form.batchDetails?.modeOfTransaction || "—"}
            </span>
          </div>
          {form.batchDetails?.transactionId && (
            <div>
              <span className="text-slate-500">Transaction ID / UTR:</span>{" "}
              <span className="font-semibold text-slate-800">
                {form.batchDetails.transactionId}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
