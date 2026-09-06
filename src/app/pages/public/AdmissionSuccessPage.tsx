import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Download, CheckCircle2, Loader2, Printer, ArrowLeft } from "lucide-react";

interface LocationState {
  result: {
    id: string;
    portalUsername: string;
    portalPassword: string;
    studentId: string;
  };
  student: {
    name: string;
    fatherName: string;
    dob: string;
    phone: string;
    email: string;
    nativeDistrict: string;
    gender: string;
    educationalQualification: string;
    subjects: string[];
    batchApplied: string;
    isKarthikeyanStudent: boolean;
    karthikeyanYear: string;
    photoUrl: string;
  };
}

export default function AdmissionSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const state = location.state as LocationState | undefined;

  useEffect(() => {
    if (!state?.result) {
      navigate("/public/admission", { replace: true });
    }
  }, [state, navigate]);

  if (!state?.result) return null;

  const { result, student } = state;
  const issuedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (imgH <= pageH) {
        pdf.addImage(imgData, "JPEG", 0, 0, pageW, imgH);
      } else {
        let y = 0;
        while (y < imgH) {
          if (y > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, -y, pageW, imgH);
          y += pageH;
        }
      }

      pdf.save(
        `admission-form-${result.portalUsername}-${student.name.replace(/\s+/g, "_")}.pdf`,
      );
    } catch (e) {
      console.error("PDF generation failed:", e);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar — hidden in print */}
      <div className="no-print bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate("/public/admission")}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          New Application
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-8 text-xs bg-white"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="bg-indigo-600 hover:bg-indigo-700 h-9"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloading ? "Generating PDF…" : "Download Application PDF"}
          </Button>
        </div>
      </div>

      {/* Success notice — hidden in print */}
      <div className="no-print max-w-3xl mx-auto px-4 py-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">
              Application Submitted Successfully!
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              Your application has been received. Your login credentials are shown below.
              Please <strong>download or print this page</strong> and keep your credentials safe.
              Your account will be activated by the admin shortly.
            </p>
          </div>
        </div>
      </div>

      {/* Printable Application Form */}
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div
          ref={printRef}
          className="admission-form-print bg-white shadow-lg border border-slate-300 overflow-hidden"
        >
          {/* Header */}
          <div className="text-center border-b-4 border-double border-slate-800 py-5 px-6 bg-white">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              Karthikeyan Analysis Study Circle (KASC)
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              STUDENT APPLICATION FORM
            </h1>
            <p className="text-sm font-semibold text-indigo-700 mt-0.5">
              Application ID: {result.portalUsername}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Date: {issuedOn}</p>
          </div>

          {/* Student Info + Photo */}
          <div className="flex flex-col sm:flex-row gap-0 border-b border-slate-300 bg-white">
            <div className="flex-1 p-5">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <InfoRow label="Name" value={student.name} />
                  <InfoRow label="Father's Name" value={student.fatherName} />
                  <InfoRow label="Date of Birth" value={student.dob} />
                  <InfoRow label="Phone" value={student.phone} />
                  {student.email && (
                    <InfoRow label="Email" value={student.email} />
                  )}
                  <InfoRow label="Native District" value={student.nativeDistrict} />
                  <InfoRow label="Gender" value={student.gender} />
                  <InfoRow
                    label="Qualification"
                    value={`${student.educationalQualification} – ${student.subjects.join(", ")}`}
                  />
                  {student.batchApplied && (
                    <InfoRow label="Batch Applied" value={student.batchApplied} />
                  )}
                  <InfoRow
                    label="KA Student"
                    value={
                      student.isKarthikeyanStudent
                        ? `Yes${student.karthikeyanYear ? ` (${student.karthikeyanYear})` : ""}`
                        : "No"
                    }
                  />
                </tbody>
              </table>
            </div>

            {/* Photo box */}
            <div className="shrink-0 flex items-center justify-center p-5 sm:border-l border-t sm:border-t-0 border-slate-200">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="w-28 h-36 object-cover border border-slate-300 rounded shadow-xs"
                />
              ) : (
                <div className="w-28 h-36 border border-dashed border-slate-400 flex flex-col items-center justify-center text-slate-400 text-xs text-center gap-1 rounded bg-slate-50">
                  <span className="text-2xl">📷</span>
                  <span>Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Login Credentials */}
          <div className="bg-indigo-50 border-b border-slate-300 px-5 py-4">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
              Your Portal Login Credentials
            </p>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">
                  Username
                </p>
                <p className="text-2xl font-extrabold text-indigo-900 tracking-widest mt-0.5 font-mono">
                  {result.portalUsername}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">
                  Password
                </p>
                <p className="text-2xl font-extrabold text-indigo-900 tracking-widest mt-0.5 font-mono">
                  {result.portalPassword}
                </p>
              </div>
            </div>
            <p className="text-xs text-indigo-600 mt-3 italic">
              ⚠ Keep these credentials private. Use them to log in at the student portal once
              your account is activated by the admin.
            </p>
          </div>

          {/* Instructions */}
          <div className="p-5 bg-white border-b border-slate-200">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Important Instructions
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
              <li>Your account is currently <strong>under review</strong>. You will be activated by the admin.</li>
              <li>Login to the student portal using the credentials above once activated.</li>
              <li>Do <strong>not</strong> share your username and password with anyone.</li>
              <li>For any queries, contact your institute directly.</li>
              <li>Keep a physical or digital copy of this application form.</li>
            </ol>
          </div>

          {/* Signature row */}
          <div className="flex justify-between items-end px-8 py-5 border-t border-slate-200 bg-white">
            <div className="text-xs text-slate-500 text-center">
              <div className="w-32 border-t border-slate-400 pt-1">Student Signature</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400">
                Issued on {issuedOn}
              </div>
            </div>
            <div className="text-xs text-slate-500 text-center">
              <div className="w-32 border-t border-slate-400 pt-1">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .admission-form-print {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1.5 pr-3 font-semibold text-slate-600 whitespace-nowrap w-36">{label}</td>
      <td className="py-1.5 text-slate-400 w-2">:</td>
      <td className="py-1.5 pl-2 text-slate-900">{value}</td>
    </tr>
  );
}
