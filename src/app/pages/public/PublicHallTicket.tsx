import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { usePublicAuth } from "../../context/PublicAuthContext";
import { Button } from "../../components/ui/button";
import { Printer, ArrowLeft, Send } from "lucide-react";

const SCHEDULE = [
  { sno: 1, subject: "Maths Full Test", questions: 100, marks: 100, time: "10:00 AM – 12:00 PM", discussion: "12:30 PM – 01:30 PM" },
  { sno: 2, subject: "Statistics Full Test", questions: 100, marks: 100, time: "10:00 AM – 12:00 PM", discussion: "12:30 PM – 01:30 PM" },
  { sno: 3, subject: "Economics Full Test", questions: 100, marks: 100, time: "10:00 AM – 12:00 PM", discussion: "12:30 PM – 01:30 PM" },
  { sno: 4, subject: "Full Mock Test", questions: 100, marks: 100, time: "10:00 AM – 12:00 PM", discussion: "12:30 PM – 01:30 PM" },
];

export default function PublicHallTicket() {
  const navigate = useNavigate();
  const { publicStudent, loading } = usePublicAuth();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !publicStudent) {
      navigate("/public/login", { replace: true });
    }
  }, [loading, publicStudent, navigate]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!publicStudent) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Screen-only controls */}
      <div className="no-print bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate("/public/dashboard")}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
          <Printer className="w-4 h-4 mr-2" />
          Print Hall Ticket
        </Button>
      </div>

      <div className="no-print max-w-3xl mx-auto px-4 py-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-4">
          <Send className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Join our Telegram Channel</p>
            <p className="mt-0.5">Test access links and schedule updates will be shared only on Telegram. Join immediately to avoid missing test notifications.</p>
          </div>
        </div>
      </div>

      {/* Printable area */}
      <div ref={printRef} className="hall-ticket-print max-w-3xl mx-auto bg-white shadow-xl border border-slate-300 print:shadow-none print:border-none print:max-w-full">
        {/* Header */}
        <div className="text-center border-b-4 border-double border-slate-800 py-4 px-6">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            Karthikeyan Analysis Study Circle (KASC)
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            HALL TICKET
          </h1>
          <p className="text-sm font-semibold text-indigo-700 mt-0.5">
            CBT Mock Test Programme – 2026
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Syllabus Code: SOLP</p>
        </div>

        {/* Student info */}
        <div className="flex flex-col sm:flex-row gap-0 border-b border-slate-300">
          <div className="flex-1 p-5">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <InfoRow label="Name" value={publicStudent.name} />
                <InfoRow label="Father's Name" value={publicStudent.fatherName} />
                <InfoRow label="Date of Birth" value={publicStudent.dob} />
                <InfoRow label="Phone" value={publicStudent.phone} />
                <InfoRow label="Native District" value={publicStudent.nativeDistrict} />
                <InfoRow label="Gender" value={publicStudent.gender} />
                <InfoRow
                  label="Qualification"
                  value={`${publicStudent.educationalQualification} – ${publicStudent.subjects.join(", ")}`}
                />
                <InfoRow
                  label="KA Student"
                  value={
                    publicStudent.isKarthikeyanStudent
                      ? `Yes${publicStudent.karthikeyanYear ? ` (${publicStudent.karthikeyanYear})` : ""}`
                      : "No"
                  }
                />
              </tbody>
            </table>
          </div>
          {/* Photo box */}
          <div className="shrink-0 flex items-center justify-center p-5 sm:border-l border-t sm:border-t-0 border-slate-200">
            {publicStudent.photoUrl ? (
              <img
                src={publicStudent.photoUrl}
                alt={publicStudent.name}
                className="w-28 h-36 object-cover border border-slate-300"
              />
            ) : (
              <div className="w-28 h-36 border border-dashed border-slate-400 flex flex-col items-center justify-center text-slate-400 text-xs text-center gap-1">
                <span className="text-2xl">📷</span>
                <span>Photo</span>
              </div>
            )}
          </div>
        </div>

        {/* Credentials */}
        <div className="bg-indigo-50 border-b border-slate-300 px-5 py-3 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Username</p>
            <p className="text-xl font-extrabold text-indigo-900 tracking-widest mt-0.5">
              {publicStudent.username}
            </p>
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Passcode</p>
            <p className="text-xl font-extrabold text-indigo-900 tracking-widest mt-0.5">
              {publicStudent.passcode}
            </p>
          </div>
          <div className="text-xs text-indigo-700 ml-auto italic">
            Keep these credentials safe. Do not share.
          </div>
        </div>

        {/* Mock test schedule */}
        <div className="p-5">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
            Mock Test Schedule
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="border border-slate-600 px-3 py-2 text-left font-semibold">S.No</th>
                  <th className="border border-slate-600 px-3 py-2 text-left font-semibold">Subject</th>
                  <th className="border border-slate-600 px-3 py-2 text-center font-semibold">Questions</th>
                  <th className="border border-slate-600 px-3 py-2 text-center font-semibold">Marks</th>
                  <th className="border border-slate-600 px-3 py-2 text-left font-semibold">Test Timing</th>
                  <th className="border border-slate-600 px-3 py-2 text-left font-semibold">Discussion</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE.map((row, i) => (
                  <tr key={row.sno} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="border border-slate-300 px-3 py-2 text-center">{row.sno}</td>
                    <td className="border border-slate-300 px-3 py-2 font-medium">{row.subject}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{row.questions}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{row.marks}</td>
                    <td className="border border-slate-300 px-3 py-2">{row.time}</td>
                    <td className="border border-slate-300 px-3 py-2">{row.discussion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instructions */}
        <div className="border-t border-slate-200 px-5 pb-5 pt-3">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Instructions</p>
          <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
            <li>Take this CBT test on <strong>Laptop / Desktop</strong> only.</li>
            <li>Tests are conducted in Live mode only — no retakes allowed.</li>
            <li>All questions will be in <strong>English</strong>.</li>
            <li>Attend the <strong>discussion session</strong> after each exam.</li>
            <li>Test links will be shared on the <strong>Telegram channel</strong> only. Join now.</li>
            <li>Logging in on a new device invalidates your previous session.</li>
            <li>This Hall Ticket must be kept safe until the programme ends.</li>
          </ol>
        </div>

        {/* Telegram notice */}
        <div className="bg-sky-700 text-white text-center text-sm font-semibold py-3 px-5">
          Join Telegram for test links and updates — Telegram: @karthikeyananalysis
        </div>

        {/* Signature row */}
        <div className="flex justify-between items-end px-8 py-5 border-t border-slate-200">
          <div className="text-xs text-slate-500 text-center">
            <div className="w-32 border-t border-slate-400 pt-1">Student Signature</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">Issued on {new Date().toLocaleDateString("en-IN")}</div>
          </div>
          <div className="text-xs text-slate-500 text-center">
            <div className="w-32 border-t border-slate-400 pt-1">Authorised Signatory</div>
          </div>
        </div>
      </div>

      {/* Print-only global style */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .hall-ticket-print {
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
