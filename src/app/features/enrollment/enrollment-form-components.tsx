import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, Trash2, Camera, PenLine, X } from "lucide-react";
import type {
  PersonalDetails,
  AddressDetails,
  EducationalDetails,
  EducationRecord,
  OtherDetails,
  BatchDetails,
  TermsAndConditions,
} from "./enrollment-types";

const INPUT_CLS =
  "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const LABEL_CLS = "block text-sm font-medium text-slate-700 mb-2";
const SELECT_CLS =
  "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// ─────────────────────────────────────────────────────────────
// I. PERSONAL DETAILS SECTION
// ─────────────────────────────────────────────────────────────
interface PersonalDetailsFormProps {
  data: PersonalDetails;
  onChange: (data: PersonalDetails) => void;
}

export function PersonalDetailsForm({
  data,
  onChange,
}: PersonalDetailsFormProps) {
  const set = (key: keyof PersonalDetails, value: any) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        I. Personal Details
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLS}>Student Name *</label>
          <input
            className={INPUT_CLS}
            placeholder="Full name"
            value={data.studentName}
            onChange={(e) => set("studentName", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Father's Name *</label>
          <input
            className={INPUT_CLS}
            placeholder="Father's full name"
            value={data.fatherName}
            onChange={(e) => set("fatherName", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Date of Birth *</label>
          <input
            type="date"
            className={INPUT_CLS}
            value={data.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Photo Upload</label>
          <div className="flex items-start gap-3">
            {data.photoURL ? (
              <div className="relative shrink-0">
                <img
                  src={data.photoURL}
                  alt="Student photo"
                  className="w-24 h-28 object-cover rounded border border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => set("photoURL", "")}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="photo-upload"
                className="flex flex-col items-center justify-center w-24 h-28 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 text-center"
              >
                <Camera className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-[10px] text-slate-500">Affix Photo</span>
              </label>
            )}
            <div className="flex flex-col justify-end gap-1 pt-16">
              <label
                htmlFor="photo-upload"
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                {data.photoURL ? "Change photo" : "Upload photo"}
              </label>
              <span className="text-[10px] text-slate-400">JPG / PNG, passport size</span>
            </div>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => set("photoURL", ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>Gender *</label>
          <select
            className={SELECT_CLS}
            value={data.gender}
            onChange={(e) => set("gender", e.target.value as any)}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Caste *</label>
          <select
            className={SELECT_CLS}
            value={data.caste}
            onChange={(e) => set("caste", e.target.value as any)}
          >
            <option value="">Select caste</option>
            <option value="general">General</option>
            <option value="bc">BC</option>
            <option value="mbc">MBC</option>
            <option value="sc">SC</option>
            <option value="st">ST</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Mobile No. *</label>
          <input
            type="tel"
            className={INPUT_CLS}
            placeholder="+91 XXXXXXXXXX"
            value={data.mobileNo}
            onChange={(e) => set("mobileNo", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>WhatsApp No. *</label>
          <input
            type="tel"
            className={INPUT_CLS}
            placeholder="+91 XXXXXXXXXX"
            value={data.whatsappNo}
            onChange={(e) => set("whatsappNo", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Telegram No.</label>
          <input
            type="tel"
            className={INPUT_CLS}
            placeholder="Telegram handle"
            value={data.telegramNo || ""}
            onChange={(e) => set("telegramNo", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>E-Mail ID *</label>
          <input
            type="email"
            className={INPUT_CLS}
            placeholder="email@example.com"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// II. ADDRESS DETAILS SECTION
// ─────────────────────────────────────────────────────────────
interface AddressDetailsFormProps {
  data: AddressDetails;
  onChange: (data: AddressDetails) => void;
}

export function AddressDetailsForm({
  data,
  onChange,
}: AddressDetailsFormProps) {
  const set = (key: keyof AddressDetails, value: string) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        II. Address Details
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLS}>Door No. *</label>
          <input
            className={INPUT_CLS}
            placeholder="Door/House number"
            value={data.doorNo}
            onChange={(e) => set("doorNo", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Street / Nagar *</label>
          <input
            className={INPUT_CLS}
            placeholder="Street name"
            value={data.streetNagar}
            onChange={(e) => set("streetNagar", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>District *</label>
          <input
            className={INPUT_CLS}
            placeholder="District"
            value={data.district}
            onChange={(e) => set("district", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>State *</label>
          <input
            className={INPUT_CLS}
            placeholder="State"
            value={data.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL_CLS}>Pincode *</label>
          <input
            type="number"
            className={INPUT_CLS}
            placeholder="6-digit pincode"
            value={data.pincode}
            onChange={(e) => set("pincode", e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// III. EDUCATIONAL DETAILS SECTION
// ─────────────────────────────────────────────────────────────
interface EducationalDetailsFormProps {
  data: EducationalDetails;
  onChange: (data: EducationalDetails) => void;
}

export function EducationalDetailsForm({
  data,
  onChange,
}: EducationalDetailsFormProps) {
  const addRecord = () => {
    const newRecord: EducationRecord = {
      tier: "UG",
      majorStream: "Maths",
      percentageOfMarks: "",
      yearOfPassing: "",
    };
    onChange({
      records: [...data.records, newRecord],
    });
  };

  const updateRecord = (index: number, record: EducationRecord) => {
    const updated = [...data.records];
    updated[index] = record;
    onChange({ records: updated });
  };

  const removeRecord = (index: number) => {
    onChange({
      records: data.records.filter((_, i) => i !== index),
    });
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">
          III. Educational Details
        </h2>
        <Button
          type="button"
          onClick={addRecord}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Education
        </Button>
      </div>

      <div className="space-y-4">
        {data.records.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No education records added. Click "Add Education" to get started.
          </p>
        ) : (
          data.records.map((record, index) => (
            <EducationRecordRow
              key={index}
              record={record}
              onChange={(updated) => updateRecord(index, updated)}
              onRemove={() => removeRecord(index)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function EducationRecordRow({
  record,
  onChange,
  onRemove,
}: {
  record: EducationRecord;
  onChange: (record: EducationRecord) => void;
  onRemove: () => void;
}) {
  const set = (key: keyof EducationRecord, value: any) => {
    onChange({ ...record, [key]: value });
  };

  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-700">Education Record</span>
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLS}>Tier *</label>
          <select
            className={SELECT_CLS}
            value={record.tier}
            onChange={(e) => set("tier", e.target.value as any)}
          >
            <option value="UG">Under Graduate (UG)</option>
            <option value="PG">Post Graduate (PG)</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLS}>Major/Stream *</label>
          <select
            className={SELECT_CLS}
            value={record.majorStream}
            onChange={(e) => set("majorStream", e.target.value as any)}
          >
            <option value="Maths">Maths</option>
            <option value="Statistics">Statistics</option>
            <option value="Economics">Economics</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLS}>Percentage of Marks *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className={INPUT_CLS}
            placeholder="e.g. 85.5"
            value={record.percentageOfMarks}
            onChange={(e) => set("percentageOfMarks", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Year of Passing *</label>
          <input
            type="number"
            className={INPUT_CLS}
            placeholder="e.g. 2024"
            value={record.yearOfPassing}
            onChange={(e) => set("yearOfPassing", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// IV. OTHER DETAILS SECTION
// ─────────────────────────────────────────────────────────────
interface OtherDetailsFormProps {
  data: OtherDetails;
  onChange: (data: OtherDetails) => void;
}

export function OtherDetailsForm({ data, onChange }: OtherDetailsFormProps) {
  const set = (key: keyof OtherDetails, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const showNatureOfWork =
    data.workStatus === "private_emp" || data.workStatus === "govt_emp";

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        IV. Other Details
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLS}>Marital Status *</label>
          <select
            className={SELECT_CLS}
            value={data.maritalStatus}
            onChange={(e) => set("maritalStatus", e.target.value as any)}
          >
            <option value="">Select...</option>
            <option value="married">Married</option>
            <option value="unmarried">Unmarried</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLS}>Work Status *</label>
          <select
            className={SELECT_CLS}
            value={data.workStatus}
            onChange={(e) => set("workStatus", e.target.value as any)}
          >
            <option value="">Select...</option>
            <option value="private_emp">Private Employee</option>
            <option value="govt_emp">Government Employee</option>
            <option value="housewife">Housewife</option>
            <option value="aspirant">Aspirant</option>
          </select>
        </div>

        {showNatureOfWork && (
          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Nature of Work *</label>
            <input
              className={INPUT_CLS}
              placeholder="Describe your current occupation"
              value={data.natureOfWork || ""}
              onChange={(e) => set("natureOfWork", e.target.value)}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// V. BATCH DETAILS SECTION
// ─────────────────────────────────────────────────────────────
interface BatchDetailsFormProps {
  data: BatchDetails;
  onChange: (data: BatchDetails) => void;
}

export function BatchDetailsForm({ data, onChange }: BatchDetailsFormProps) {
  const set = (key: keyof BatchDetails, value: string) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        V. Batch Details
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLS}>Batch Name *</label>
          <input
            className={INPUT_CLS}
            placeholder="e.g., STAT WIN"
            value={data.batchName}
            onChange={(e) => set("batchName", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Batch Duration - Start *</label>
          <input
            type="date"
            className={INPUT_CLS}
            value={data.batchDurationStart}
            onChange={(e) => set("batchDurationStart", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Batch Duration - End *</label>
          <input
            type="date"
            className={INPUT_CLS}
            value={data.batchDurationEnd}
            onChange={(e) => set("batchDurationEnd", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Date of Payment *</label>
          <input
            type="date"
            className={INPUT_CLS}
            value={data.dateOfPayment}
            onChange={(e) => set("dateOfPayment", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLS}>Mode of Transaction *</label>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { value: "upi", label: "UPI" },
              { value: "credit_card", label: "Credit Card" },
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "cash", label: "Cash" },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => set("modeOfTransaction", mode.value)}
                className={`px-4 py-2 rounded-lg border-2 transition font-medium ${
                  data.modeOfTransaction === mode.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// VI. TERMS & CONDITIONS SECTION
// ─────────────────────────────────────────────────────────────

const TERMS_TEXT = [
  "I hereby confirm that the information provided in this form is true and accurate to the best of my knowledge.",
  "I agree to abide by all rules and regulations of Karthikeyan Analysis Study Circle.",
  "I understand that the course content is proprietary and I shall not share or distribute it without prior permission.",
  "I accept the terms of the refund policy as stated in the course materials.",
  "I acknowledge that I have read and understood the privacy policy and data handling practices.",
];

interface TermsAndConditionsFormProps {
  data: TermsAndConditions;
  onChange: (data: TermsAndConditions) => void;
}

export function TermsAndConditionsForm({
  data,
  onChange,
}: TermsAndConditionsFormProps) {
  const setTerm = (index: number, checked: boolean) => {
    const terms = Object.keys(data) as (keyof TermsAndConditions)[];
    const termKey = terms[index];
    onChange({ ...data, [termKey]: checked });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        VI. Terms & Conditions
      </h2>
      <div className="space-y-3">
        {TERMS_TEXT.map((text, idx) => (
          <label
            key={idx}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition ${
              data[`term${idx + 1}` as keyof TermsAndConditions]
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white hover:border-blue-300"
            }`}
          >
            <input
              type="checkbox"
              checked={data[`term${idx + 1}` as keyof TermsAndConditions]}
              onChange={(e) => setTerm(idx, e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-blue-600"
            />
            <span className="text-sm leading-relaxed text-slate-700">
              {text}
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// VII. SIGNATURE SECTION
// ─────────────────────────────────────────────────────────────
interface SignatureSectionProps {
  signatureURL?: string;
  onChange: (signatureURL: string) => void;
}

export function SignatureSection({ signatureURL, onChange }: SignatureSectionProps) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        VII. Signature
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Upload a scanned/photographed copy of your signature. This will appear on the printed enrollment form.
      </p>
      <div className="flex items-start gap-4">
        {signatureURL ? (
          <div className="relative">
            <div className="border-2 border-slate-300 rounded-lg p-2 bg-white">
              <img
                src={signatureURL}
                alt="Signature"
                className="h-16 max-w-xs object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
              title="Remove signature"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="signature-upload"
            className="flex flex-col items-center justify-center w-48 h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50"
          >
            <PenLine className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs text-slate-500">Upload Signature</span>
          </label>
        )}
        <div className="flex flex-col gap-1 pt-1">
          <label
            htmlFor="signature-upload"
            className="text-xs text-indigo-600 hover:underline cursor-pointer"
          >
            {signatureURL ? "Change signature" : "Upload signature image"}
          </label>
          <span className="text-[10px] text-slate-400">PNG / JPG of your handwritten signature</span>
        </div>
        <input
          id="signature-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => onChange(ev.target?.result as string);
              reader.readAsDataURL(file);
            }
          }}
        />
      </div>
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="flex items-end justify-between">
          <div>
            <div className="w-52 border-b-2 border-slate-400 mb-1" />
            <p className="text-xs text-slate-500">Student Signature</p>
          </div>
          <div>
            <div className="w-36 border-b-2 border-slate-400 mb-1" />
            <p className="text-xs text-slate-500">Date</p>
          </div>
          <div>
            <div className="w-40 border-b-2 border-slate-400 mb-1" />
            <p className="text-xs text-slate-500">For Office Use Only</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
