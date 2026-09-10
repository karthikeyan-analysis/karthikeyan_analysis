import React, { useState } from "react";
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
} from "lucide-react";
import type {
  PersonalDetails,
  AddressDetails,
  EducationalDetails,
  EducationRecord,
  DemographicDetails,
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
}

export function CourseHeaderBox({ config, batchName }: CourseHeaderBoxProps) {
  const courseTitle =
    config?.courseName?.trim() ||
    batchName?.trim() ||
    "ONLINE LIVE CRASH COURSE";

  return (
    <div className="space-y-4">
      {/* Colorful Institute Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/2 -top-10 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-widest text-indigo-100 border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              Official Batch Enrollment Portal
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight drop-shadow-sm">
              KARTHIKEYAN TNPSC STUDY CIRCLE
            </h1>
            <p className="text-sm md:text-base text-indigo-100 max-w-2xl font-medium">
              Premier Coaching Institute for Tamil Nadu Statistical Services
              &amp; Competitive Examinations
            </p>
          </div>

          <div className="shrink-0 bg-white/10 backdrop-blur-md border border-white/25 px-5 py-4 rounded-xl text-center shadow-inner">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest block">
              Enrollment Status
            </span>
            <span className="text-base md:text-lg font-bold text-white flex items-center justify-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              {config?.isOpen === false
                ? "Admissions Closed"
                : "Admissions Open"}
            </span>
          </div>
        </div>
      </div>

      {/* Editable Course Information Box (Displayed to Student) */}
      <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-900 font-bold text-base md:text-lg border-b border-indigo-100 pb-3 mb-4">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <span>Course Information</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 bg-white/80 border border-indigo-100 p-3.5 rounded-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Online Live Crash Course Name
            </span>
            <span className="text-base md:text-lg font-bold text-indigo-950 mt-1 block">
              {courseTitle}
            </span>
          </div>

          <div className="bg-white/80 border border-indigo-100 p-3.5 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Starting Date
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                {config?.startingDate?.trim() || "To be announced / Immediate"}
              </span>
            </div>
          </div>

          <div className="bg-white/80 border border-indigo-100 p-3.5 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Course Duration
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                {config?.duration?.trim() || "Complete Syllabus Coverage"}
              </span>
            </div>
          </div>

          <div className="bg-white/80 border border-indigo-100 p-3.5 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Mode of Instruction
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                100% Live Online CBT &amp; Classes
              </span>
            </div>
          </div>
        </div>

        {config?.note?.trim() && (
          <div className="mt-4 p-3 bg-amber-50/90 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
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
}

export function PersonalContactForm({
  data,
  onChange,
}: PersonalContactFormProps) {
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

export function EducationalQualificationsForm({
  data,
  onChange,
}: EducationalQualificationsFormProps) {
  const records = data.records || [];

  const hasBSc = records.some((r) => r.degree === "BSc");
  const hasMSc = records.some((r) => r.degree === "MSc");

  // Determine allowed next degree based on strict hierarchy
  const getNextAllowedDegrees = (): AllowedDegree[] => {
    if (!hasBSc) return ["BSc"];
    if (!hasMSc) return ["MSc"];
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
          disabled={hasBSc && hasMSc && records.length >= 4}
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
            sequential order (must add <strong>B.Sc.</strong> first before
            unlocking <strong>M.Sc.</strong>, and M.Sc. before unlocking{" "}
            <strong>M.Phil. / Ph.D.</strong>).
          </span>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <GraduationCap className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              No educational qualifications added yet
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Click below to start with your first degree (B.Sc.)
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleAddRow}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add B.Sc. Degree
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
                  <th className="p-3">PSTM (Tamil Medium) *</th>
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
                          {index === 0 && <option value="BSc">B.Sc.</option>}
                          {index === 1 && <option value="MSc">M.Sc.</option>}
                          {index >= 2 && (
                            <>
                              <option value="MPhil">M.Phil.</option>
                              <option value="PhD">Ph.D.</option>
                            </>
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

                      {/* PSTM Dropdown */}
                      <td className="p-3 min-w-[130px]">
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
// 5. DECLARATION, TERMS & SUBMISSION
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
  "I confirm that I have read, understood, and agreed to all the above terms and conditions and undertake to follow the rules and guidelines of the institute throughout the course.",
];

interface DeclarationTermsFormProps {
  terms: TermsAndConditions;
  onChange: (terms: TermsAndConditions) => void;
}

export function DeclarationTermsForm({
  terms,
  onChange,
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

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
            5
          </span>
          Declaration &amp; Terms and Conditions
        </h2>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto space-y-3">
          <p className="font-bold text-slate-900 uppercase tracking-wide">
            DECLARATION &amp; TERMS AND CONDITIONS
          </p>
          <p>
            By submitting this application, I acknowledge and agree to the
            following terms and conditions:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-800 font-normal">
            {DECLARATION_TERMS_LIST.map((text, i) => (
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

      {/* Personal Info */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-1">
          Personal &amp; Contact Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
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
            <span className="font-semibold text-slate-800">{p?.mobileNo}</span>
          </div>
          <div>
            <span className="text-slate-500">WhatsApp:</span>{" "}
            <span className="font-semibold text-slate-800">
              {p?.whatsappNo}
            </span>
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
                <th className="p-2">PSTM (Tamil Medium)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ed?.records?.map((r, i) => (
                <tr key={i}>
                  <td className="p-2 font-semibold">{r.degree || r.tier}</td>
                  <td className="p-2">
                    {r.major === "Other"
                      ? r.otherMajor
                      : r.major || r.majorStream}
                  </td>
                  <td className="p-2">
                    {r.percentage || r.percentageOfMarks}%
                  </td>
                  <td className="p-2">{r.pstm || "No"}</td>
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
    </div>
  );
}
