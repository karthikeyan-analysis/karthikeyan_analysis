import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import bannerImage from "../../../banner.jpeg";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CheckCheck,
  KeyRound,
  Loader2,
  ShieldAlert,
  ArrowRight,
  Printer,
} from "lucide-react";
import {
  CourseHeaderBox,
  PersonalContactForm,
  AddressBreakdownForm,
  EducationalQualificationsForm,
  DemographicDetailsForm,
  DeclarationTermsForm,
} from "../../features/enrollment/enrollment-form-components";
import type {
  PersonalDetails,
  AddressDetails,
  EducationalDetails,
  DemographicDetails,
  TermsAndConditions,
  BatchEnrollmentConfig,
  EnrollmentFormDTO,
} from "../../features/enrollment/enrollment-types";
import {
  getBatchById,
  getBatchEnrollmentConfig,
  getScheduledEnrollmentFormById,
  computeScheduledFormStatus,
  getShareableLinkByToken,
  recordShareableLinkClick,
  submitBatchEnrollment,
} from "../../features/enrollment/enrollment-utils";

export default function PublicEnrollmentForm() {
  const params = useParams<{ token?: string; batchId?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resolved Batch & Scheduled Form Info
  const [batchId, setBatchId] = useState<string>("");
  const [batchName, setBatchName] = useState<string>("");
  const [config, setConfig] = useState<BatchEnrollmentConfig | null>(null);
  const [scheduledFormId, setScheduledFormId] = useState<string>("");
  const [scheduledFormTitle, setScheduledFormTitle] = useState<string>("");

  // Success State with Generated Credentials
  const [submittedResult, setSubmittedResult] = useState<{
    formId: string;
    username: string;
    password: string;
    studentId: string;
    candidateName: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Form State
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>({
    gender: "male",
    candidateName: "",
    initials: "",
    studentName: "",
    fatherName: "",
    email: "",
    mobileNo: "",
    whatsappNo: "",
    isWhatsappSameAsMobile: false,
  });

  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    doorNo: "",
    streetName: "",
    taluk: "",
    district: "",
    pincode: "",
  });

  const [educationalDetails, setEducationalDetails] =
    useState<EducationalDetails>({
      records: [
        {
          degree: "BSc",
          major: "Statistics",
          otherMajor: "",
          percentage: "",
          pstm: "No",
        },
      ],
    });

  const [demographicDetails, setDemographicDetails] =
    useState<DemographicDetails>({
      dateOfBirth: "",
      maritalStatus: "Unmarried",
      workStatus: "Full-time Aspirant",
      departmentName: "",
      previousTnpscExperience: "First Attempt",
    });

  const [terms, setTerms] = useState<TermsAndConditions>({
    agreedAllTerms: false,
  });

  // Resolve batch from URL (:batchId or :token)
  useEffect(() => {
    let cancelled = false;

    const resolveBatch = async () => {
      setLoading(true);
      setError(null);

      try {
        const lookupId = params.batchId || params.token || "";

        if (!lookupId) {
          setError(
            "No enrollment form or batch specified. Please check the link.",
          );
          setLoading(false);
          return;
        }

        // 1. Check if lookupId is a Scheduled Enrollment Form
        const scheduledForm = await getScheduledEnrollmentFormById(lookupId);
        if (scheduledForm && !cancelled) {
          const statusCheck = computeScheduledFormStatus(scheduledForm);
          if (statusCheck.status !== "active") {
            setError(
              statusCheck.message ||
                "Admissions for this form are currently closed.",
            );
            setLoading(false);
            return;
          }

          setScheduledFormId(scheduledForm.id);
          setScheduledFormTitle(scheduledForm.formTitle);
          setBatchId(scheduledForm.batchId);
          setBatchName(scheduledForm.batchName || "");
          setConfig({
            batchId: scheduledForm.batchId,
            courseName: scheduledForm.courseName,
            startingDate: scheduledForm.startingDate,
            duration: scheduledForm.duration,
            note: scheduledForm.note,
            isOpen: scheduledForm.isOpen,
          });
          setLoading(false);
          return;
        }

        // 2. Fallback: Lookup by token in shareableFormLinks or direct batchId
        let resolvedBatchId = lookupId;
        if (params.token) {
          const link = await getShareableLinkByToken(params.token);
          if (link) {
            resolvedBatchId = link.batchId;
            void recordShareableLinkClick(link.id);
          }
        }

        // Fetch batch and enrollment config in parallel
        const [batch, enrollmentConfig] = await Promise.all([
          getBatchById(resolvedBatchId),
          getBatchEnrollmentConfig(resolvedBatchId),
        ]);

        if (cancelled) return;

        if (!batch) {
          setError(
            "The requested batch was not found. Please contact the administrator.",
          );
          setLoading(false);
          return;
        }

        if (enrollmentConfig && enrollmentConfig.isOpen === false) {
          setError(
            "Enrollment for this batch is currently closed by the administrator.",
          );
          setLoading(false);
          return;
        }

        setBatchId(batch.id);
        setBatchName(batch.name);
        setConfig(enrollmentConfig);
      } catch (err: any) {
        console.error("Batch resolution error:", err);
        if (!cancelled) {
          setError("Failed to load enrollment form. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolveBatch();

    return () => {
      cancelled = true;
    };
  }, [params.batchId, params.token]);

  const handleCopyCredentials = () => {
    if (!submittedResult) return;
    const text = `KARTHIKEYAN TNPSC STUDY CIRCLE\nStudent Portal Login Credentials\nUsername: ${submittedResult.username}\nPassword: ${submittedResult.password}\nStudent ID: ${submittedResult.studentId}\nStatus: Pending Admin Approval`;
    navigator.clipboard.writeText(text);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const missing: string[] = [];
    if (!personalDetails.candidateName.trim()) missing.push("Candidate Name");
    if (!personalDetails.initials.trim()) missing.push("Initials");
    if (!personalDetails.fatherName.trim()) missing.push("Father's Name");
    if (!personalDetails.email.trim()) missing.push("Email ID");
    if (!personalDetails.mobileNo.trim()) missing.push("Contact Number");
    if (!personalDetails.whatsappNo.trim()) missing.push("WhatsApp Number");

    if (!addressDetails.doorNo.trim()) missing.push("Door Number");
    if (!addressDetails.streetName.trim()) missing.push("Street Name");
    if (!addressDetails.taluk.trim()) missing.push("Taluk");
    if (!addressDetails.district.trim()) missing.push("District");
    if (!addressDetails.pincode.trim()) missing.push("Pincode");

    if (educationalDetails.records.length === 0) {
      missing.push("At least one degree qualification (B.Sc.)");
    } else {
      educationalDetails.records.forEach((r, idx) => {
        if (!r.percentage.trim()) missing.push(`Percentage for Row ${idx + 1}`);
        if (r.major === "Other" && !r.otherMajor?.trim()) {
          missing.push(`Specific Major for Row ${idx + 1}`);
        }
      });
    }

    if (!demographicDetails.dateOfBirth) missing.push("Date of Birth");
    if (
      demographicDetails.workStatus === "Government Employee" &&
      !demographicDetails.departmentName?.trim()
    ) {
      missing.push("Government Department Name");
    }

    if (!terms.agreedAllTerms) {
      missing.push("You must agree to the Declaration & Terms and Conditions");
    }

    if (missing.length > 0) {
      setError(
        `Please complete the following required fields:\n• ${missing.join("\n• ")}`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: EnrollmentFormDTO = {
        batchId,
        batchName,
        courseName: config?.courseName || batchName,
        scheduledFormId: scheduledFormId || undefined,
        scheduledFormTitle: scheduledFormTitle || undefined,
        personalDetails: {
          ...personalDetails,
          studentName:
            `${personalDetails.candidateName.trim()} ${personalDetails.initials.trim()}`.trim(),
        },
        addressDetails,
        educationalDetails,
        demographicDetails,
        termsAndConditions: terms,
      };

      const result = await submitBatchEnrollment(payload);

      setSubmittedResult({
        ...result,
        candidateName: payload.personalDetails.studentName,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(
        err?.message ||
          "Failed to submit enrollment application. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-600" />
          <p className="text-sm font-semibold text-slate-700">
            Loading batch enrollment form...
          </p>
        </div>
      </div>
    );
  }

  // Success & Credentials Screen (Official Receipt & Acknowledgement)
  if (submittedResult) {
    const registrationDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="min-h-screen bg-slate-100/70 py-6 sm:py-10 px-3 sm:px-6 print:bg-white print:p-0 print:min-h-0">
        <div className="max-w-2xl mx-auto space-y-4 print:max-w-full print:space-y-0">
          <Card className="border border-slate-200 shadow-lg overflow-hidden bg-white print:border-none print:shadow-none print:rounded-none">
            {/* Top Official Banner Image */}
            <div className="w-full bg-white px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-center border-b border-slate-100">
              <img
                src={bannerImage}
                alt="Karthikeyan Analysis Study Circle Banner"
                className="w-full max-w-xl max-h-20 sm:max-h-28 object-contain"
              />
            </div>

            {/* Receipt Document Header Strip */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center sm:text-left print:bg-slate-900 print:text-white">
              <div>
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest block">
                  Official Registration Acknowledgement
                </span>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  Enrollment Receipt &amp; Credentials Slip
                </h1>
              </div>
              <div className="text-center sm:text-right">
                <span className="text-[11px] text-slate-400 block">
                  Date &amp; Time
                </span>
                <span className="text-xs font-semibold text-slate-200">
                  {registrationDate}
                </span>
              </div>
            </div>

            <CardContent className="p-5 sm:p-7 space-y-5">
              {/* Verification Status Alert */}
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 flex items-start gap-3 text-amber-900">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                      Verification Status:
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200/80 text-amber-900">
                      Pending Admin Approval
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Your batch enrollment application has been recorded
                    successfully. The institute administrator will verify your
                    qualifications. Once approved, you will be authorized to log
                    in via <strong>Continue with Google</strong> using your
                    registered email (<code>{personalDetails.email}</code>) or
                    with the student portal credentials below.
                  </p>
                </div>
              </div>

              {/* Student & Course Details Grid */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                  Application Summary
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">
                      Candidate Name:
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {submittedResult.candidateName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">
                      Student ID / Reg No:
                    </span>
                    <span className="font-bold text-indigo-700 font-mono text-sm">
                      {submittedResult.studentId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">
                      Enrolled Batch:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {batchName || config?.courseName || "Crash Course"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Course Name:</span>
                    <span className="font-semibold text-slate-800">
                      {config?.courseName ||
                        batchName ||
                        "Online Live Crash Course"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">
                      Registered Email:
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {personalDetails.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">
                      Contact Number:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {personalDetails.mobileNo}
                      {personalDetails.whatsappNo
                        ? ` (WA: ${personalDetails.whatsappNo})`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Generated Credentials Box */}
              <div className="rounded-xl border-2 border-indigo-100 bg-white p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    <span>Student Portal Login Credentials</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyCredentials}
                    className="text-xs gap-1.5 h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 print:hidden"
                  >
                    {copiedCreds ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Details
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Portal Username
                    </span>
                    <span className="text-base font-bold text-indigo-900 font-mono mt-0.5 block">
                      {submittedResult.username}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Portal Password
                    </span>
                    <span className="text-base font-bold text-indigo-900 font-mono mt-0.5 block">
                      {submittedResult.password}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  * Please save or print this receipt. You will need these
                  credentials to access live CBT tests, classes, and study
                  materials once your registration is approved.
                </p>
              </div>

              {/* Print-only Official Footer */}
              <div className="hidden print:block pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">
                  Karthikeyan Analysis Study Circle &amp; Learning Resources
                </p>
                <p>
                  Premier Coaching Institute for Tamil Nadu Statistical Services
                  (TNPSC) &amp; TRB Exams
                </p>
                <p className="text-slate-400">
                  This is a computer-generated enrollment acknowledgement slip.
                  No physical signature is required.
                </p>
              </div>

              {/* Navigation & Print Actions (Hidden on print) */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3 print:hidden">
                <Button
                  onClick={() => navigate("/login")}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold h-10 text-sm"
                >
                  Go to Student Login <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="sm:w-auto text-slate-700 border-slate-300 gap-2 h-10 text-sm font-semibold"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  Print / Save Receipt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Course Header & Information Box */}
        <CourseHeaderBox config={config} batchName={batchName} />

        {/* Error Notice */}
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-red-800">
                Action Required
              </span>
              <p className="text-xs sm:text-sm whitespace-pre-line">{error}</p>
            </div>
          </div>
        )}

        {/* Enrollment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal & Contact Details */}
          <PersonalContactForm
            data={personalDetails}
            onChange={setPersonalDetails}
          />

          {/* Section 2: Address Breakdown Details */}
          <AddressBreakdownForm
            data={addressDetails}
            onChange={setAddressDetails}
          />

          {/* Section 3: Educational Qualifications Table */}
          <EducationalQualificationsForm
            data={educationalDetails}
            onChange={setEducationalDetails}
          />

          {/* Section 4: Demographic & Background Details */}
          <DemographicDetailsForm
            data={demographicDetails}
            onChange={setDemographicDetails}
          />

          {/* Section 5: Declaration & Terms */}
          <DeclarationTermsForm terms={terms} onChange={setTerms} />

          {/* Submit Button */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              Make sure all details are accurate before submitting. Credentials
              will be generated upon submission.
            </div>

            <Button
              type="submit"
              disabled={submitting || !terms.agreedAllTerms}
              className={`w-full sm:w-auto px-8 py-3 text-base font-bold transition-all shadow-md ${
                terms.agreedAllTerms
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white cursor-pointer"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                "Submit Application & Generate Credentials"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
