import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
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

  // Resolved Batch Info
  const [batchId, setBatchId] = useState<string>("");
  const [batchName, setBatchName] = useState<string>("");
  const [config, setConfig] = useState<BatchEnrollmentConfig | null>(null);

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
        let resolvedBatchId = params.batchId || "";

        if (!resolvedBatchId && params.token) {
          // Attempt to match token from shareableFormLinks
          const link = await getShareableLinkByToken(params.token);
          if (link) {
            resolvedBatchId = link.batchId;
            void recordShareableLinkClick(link.id);
          } else {
            // Fallback: token in URL might be a raw batchId
            resolvedBatchId = params.token;
          }
        }

        if (!resolvedBatchId) {
          setError("No batch specified for enrollment. Please check the link.");
          setLoading(false);
          return;
        }

        // Fetch batch and enrollment config in parallel
        const [batch, enrollmentConfig] = await Promise.all([
          getBatchById(resolvedBatchId),
          getBatchEnrollmentConfig(resolvedBatchId),
        ]);

        if (cancelled) return;

        if (!batch) {
          setError("The requested batch was not found. Please contact the administrator.");
          setLoading(false);
          return;
        }

        if (enrollmentConfig && enrollmentConfig.isOpen === false) {
          setError("Enrollment for this batch is currently closed by the administrator.");
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
      setError(`Please complete the following required fields:\n• ${missing.join("\n• ")}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: EnrollmentFormDTO = {
        batchId,
        batchName,
        courseName: config?.courseName || batchName,
        personalDetails: {
          ...personalDetails,
          studentName: `${personalDetails.candidateName.trim()} ${personalDetails.initials.trim()}`.trim(),
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
      setError(err?.message || "Failed to submit enrollment application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-600" />
          <p className="text-sm font-semibold text-slate-700">Loading batch enrollment form...</p>
        </div>
      </div>
    );
  }

  // Success & Credentials Screen
  if (submittedResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-emerald-200 shadow-xl overflow-hidden bg-white">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-emerald-100" />
              <h1 className="text-2xl md:text-3xl font-extrabold">Application Registered!</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Your batch enrollment application has been recorded successfully.
              </p>
            </div>

            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Approval Notice Banner */}
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
                <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                    Verification Status: Pending Admin Approval
                  </span>
                  <p className="text-xs md:text-sm text-amber-800 leading-relaxed">
                    The institute administrator must verify and approve your registration before your student account is activated. Once approved, you will be authorized to log in via <strong>Continue with Google</strong> using your registered email (<code>{personalDetails.email}</code>) or with the portal credentials below.
                  </p>
                </div>
              </div>

              {/* Generated Credentials Box */}
              <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold">
                    <KeyRound className="w-5 h-5 text-indigo-600" />
                    <span>Your Student Portal Login Credentials</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyCredentials}
                    className="text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  >
                    {copiedCreds ? (
                      <>
                        <CheckCheck className="w-4 h-4 text-emerald-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Details
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">Candidate Name</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{submittedResult.candidateName}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">Student ID / Reg No</span>
                    <span className="text-sm font-bold text-indigo-700 font-mono mt-0.5 block">{submittedResult.studentId}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">Portal Username</span>
                    <span className="text-base font-bold text-indigo-900 font-mono mt-0.5 block">{submittedResult.username}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">Portal Password</span>
                    <span className="text-base font-bold text-indigo-900 font-mono mt-0.5 block">{submittedResult.password}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  * Please save or screenshot these credentials. You will need them to access CBT tests, study material, and live classes once the admin approves your account.
                </p>
              </div>

              {/* Navigation Action */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => navigate("/login")}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold"
                >
                  Go to Student Login <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="sm:w-auto text-slate-700 border-slate-300"
                >
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
          <DeclarationTermsForm
            terms={terms}
            onChange={setTerms}
          />

          {/* Submit Button */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              Make sure all details are accurate before submitting. Credentials will be generated upon submission.
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
