import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  PersonalDetailsForm,
  AddressDetailsForm,
  EducationalDetailsForm,
  OtherDetailsForm,
  BatchDetailsForm,
  TermsAndConditionsForm,
} from "../../features/enrollment/enrollment-form-components";
import type {
  EnrollmentFormDTO,
  PersonalDetails,
  AddressDetails,
  EducationalDetails,
  OtherDetails,
  BatchDetails,
  TermsAndConditions,
} from "../../features/enrollment/enrollment-types";
import {
  getShareableLinkByToken,
  createEnrollmentForm,
  recordShareableLinkClick,
} from "../../features/enrollment/enrollment-utils";

export default function PublicEnrollmentForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<string>("");

  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>({
    studentName: "",
    fatherName: "",
    dateOfBirth: "",
    gender: "male",
    caste: "general",
    mobileNo: "",
    whatsappNo: "",
    email: "",
  });

  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    doorNo: "",
    streetNagar: "",
    district: "",
    state: "",
    pincode: "",
  });

  const [educationalDetails, setEducationalDetails] =
    useState<EducationalDetails>({
      records: [],
    });

  const [otherDetails, setOtherDetails] = useState<OtherDetails>({
    maritalStatus: "unmarried",
    workStatus: "aspirant",
  });

  const [batchDetails, setBatchDetails] = useState<BatchDetails>({
    batchName: "",
    batchDurationStart: "",
    batchDurationEnd: "",
    dateOfPayment: "",
    modeOfTransaction: "upi",
  });

  const [termsAndConditions, setTermsAndConditions] =
    useState<TermsAndConditions>({
      term1: false,
      term2: false,
      term3: false,
      term4: false,
      term5: false,
    });

  // Validate shareable link on mount
  useEffect(() => {
    const validateLink = async () => {
      setLoading(true);
      try {
        if (!token) {
          setError("Invalid enrollment link");
          setLoading(false);
          return;
        }

        const link = await getShareableLinkByToken(token);
        if (!link) {
          setError("Enrollment link is invalid or has expired");
          setLoading(false);
          return;
        }

        // Record the click
        await recordShareableLinkClick(link.id);

        // Set the batch ID for form submission
        setBatchId(link.batchId);
        setError(null);
      } catch (err) {
        console.error("Link validation error:", err);
        setError("Failed to validate enrollment link");
      } finally {
        setLoading(false);
      }
    };

    validateLink();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: string[] = [];

    if (!personalDetails.studentName) errors.push("Student name is required");
    if (!personalDetails.fatherName) errors.push("Father's name is required");
    if (!personalDetails.dateOfBirth) errors.push("Date of birth is required");
    if (!personalDetails.mobileNo) errors.push("Mobile number is required");
    if (!personalDetails.whatsappNo) errors.push("WhatsApp number is required");
    if (!personalDetails.email) errors.push("Email is required");

    if (!addressDetails.doorNo || !addressDetails.streetNagar)
      errors.push("Complete address is required");
    if (!addressDetails.pincode) errors.push("Pincode is required");

    if (educationalDetails.records.length === 0)
      errors.push("At least one education record is required");

    if (!otherDetails.maritalStatus) errors.push("Marital status is required");
    if (!otherDetails.workStatus) errors.push("Work status is required");
    if (
      (otherDetails.workStatus === "private_emp" ||
        otherDetails.workStatus === "govt_emp") &&
      !otherDetails.natureOfWork
    ) {
      errors.push("Nature of work is required");
    }

    if (!batchDetails.batchName) errors.push("Batch name is required");
    if (!batchDetails.dateOfPayment) errors.push("Date of payment is required");

    const allTermsAgreed = Object.values(termsAndConditions).every(Boolean);
    if (!allTermsAgreed)
      errors.push("You must agree to all terms and conditions");

    if (errors.length > 0) {
      setError(errors.join("\n"));
      window.scrollTo(0, 0);
      return;
    }

    setSubmitting(true);
    try {
      const formData: EnrollmentFormDTO = {
        personalDetails,
        addressDetails,
        educationalDetails,
        otherDetails,
        batchDetails,
        termsAndConditions,
        batchId,
      };

      await createEnrollmentForm(formData, personalDetails.email, batchId);

      setSuccess(true);
      setTimeout(() => {
        navigate("/enrollment-success");
      }, 2000);
    } catch (err) {
      console.error("Submission error:", err);
      setError("Failed to submit form. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Validating enrollment link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-6">
            <div className="flex gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Enrollment Link Invalid</p>
                <p className="text-sm mt-1">{error}</p>
                <Button
                  onClick={() => navigate("/")}
                  className="mt-4 w-full"
                  variant="outline"
                >
                  Go Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="pt-6">
            <div className="flex gap-3 text-green-700 text-center">
              <div className="w-full">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4" />
                <p className="font-semibold text-lg">
                  Form Submitted Successfully!
                </p>
                <p className="text-sm mt-2">
                  Thank you for your enrollment. Redirecting...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Enrollment Form</h1>
          <p className="text-slate-600 mt-2">
            KARTHIKEYAN ANALYSIS STUDY CIRCLE & LEARNING RESOURCES
          </p>
          <p className="text-slate-500 text-sm mt-1">Chennai - 600034</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm whitespace-pre-line">{error}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form Sections */}
          <PersonalDetailsForm
            data={personalDetails}
            onChange={setPersonalDetails}
          />

          <AddressDetailsForm
            data={addressDetails}
            onChange={setAddressDetails}
          />

          <EducationalDetailsForm
            data={educationalDetails}
            onChange={setEducationalDetails}
          />

          <OtherDetailsForm data={otherDetails} onChange={setOtherDetails} />

          <BatchDetailsForm data={batchDetails} onChange={setBatchDetails} />

          <TermsAndConditionsForm
            data={termsAndConditions}
            onChange={setTermsAndConditions}
          />

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Enrollment"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
