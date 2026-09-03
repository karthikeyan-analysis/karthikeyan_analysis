import { useEffect, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { PublicStudent } from "../../context/PublicAuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Search,
  Download,
  RefreshCw,
  Users,
  Eye,
  EyeOff,
  Link,
  Copy,
  Check,
  FileText,
  Printer,
  Loader2,
} from "lucide-react";

type Row = PublicStudent & { id: string };

const SCHEDULE = [
  {
    sno: 1,
    subject: "Maths Full Test",
    questions: 100,
    marks: 100,
    time: "10:00 AM – 12:00 PM",
    discussion: "12:30 PM – 01:30 PM",
  },
  {
    sno: 2,
    subject: "Statistics Full Test",
    questions: 100,
    marks: 100,
    time: "10:00 AM – 12:00 PM",
    discussion: "12:30 PM – 01:30 PM",
  },
  {
    sno: 3,
    subject: "Economics Full Test",
    questions: 100,
    marks: 100,
    time: "10:00 AM – 12:00 PM",
    discussion: "12:30 PM – 01:30 PM",
  },
  {
    sno: 4,
    subject: "Full Mock Test",
    questions: 100,
    marks: 100,
    time: "10:00 AM – 12:00 PM",
    discussion: "12:30 PM – 01:30 PM",
  },
];

export default function PublicRegistrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Hall Ticket Modal State
  const [selectedStudent, setSelectedStudent] = useState<Row | null>(null);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const registrationLink = `${window.location.origin}/public/register`;

  const copyLink = () => {
    navigator.clipboard.writeText(registrationLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "publicCBTStudents"),
          orderBy("registeredAt", "desc"),
        ),
      );
      setRows(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as PublicStudent) })),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.username.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      r.nativeDistrict.toLowerCase().includes(q) ||
      r.subjects.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleDownloadPDF = async (student: Row) => {
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

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
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
        `hall-ticket-${student.username}-${student.name.replace(/\s+/g, "_")}.pdf`,
      );
    } catch (e) {
      console.error("PDF download failed:", e);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportCSV = () => {
    const headers = [
      "Username",
      "Name",
      "Father's Name",
      "DOB",
      "Phone",
      "District",
      "Gender",
      "Qualification",
      "Subjects",
      "KA Student",
      "KA Year",
      "Passcode",
      "Registered At",
    ];
    const escapeCell = (v: string) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvRows = filtered.map((r) =>
      [
        r.username,
        r.name,
        r.fatherName,
        r.dob,
        r.phone,
        r.nativeDistrict,
        r.gender,
        r.educationalQualification,
        r.subjects.join("; "),
        r.isKarthikeyanStudent ? "Yes" : "No",
        r.karthikeyanYear || "",
        r.passcode,
        r.registeredAt,
      ]
        .map(escapeCell)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kasc-cbt-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Public CBT Registrations
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All registered public students for KASC Mock Test 2026
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Registration Link Share Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-semibold text-indigo-800">
            Student Registration Link
          </p>
        </div>
        <p className="text-xs text-indigo-600 mb-3">
          Share this link with students to let them self-register for the CBT
          Mock Test Portal.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 overflow-x-auto whitespace-nowrap">
            {registrationLink}
          </div>
          <Button
            onClick={copyLink}
            className={
              linkCopied
                ? "bg-green-600 hover:bg-green-700 shrink-0"
                : "bg-indigo-600 hover:bg-indigo-700 shrink-0"
            }
          >
            {linkCopied ? (
              <>
                <Check className="w-4 h-4 mr-1.5" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" /> Copy Link
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={rows.length} color="indigo" />
        <StatCard
          label="UG"
          value={rows.filter((r) => r.educationalQualification === "UG").length}
          color="sky"
        />
        <StatCard
          label="PG"
          value={rows.filter((r) => r.educationalQualification === "PG").length}
          color="purple"
        />
        <StatCard
          label="KA Students"
          value={rows.filter((r) => r.isKarthikeyanStudent).length}
          color="green"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, username, phone, district, or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="border-b border-slate-100 py-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            {filtered.length} student{filtered.length !== 1 ? "s" : ""}
            {search && (
              <span className="text-slate-400 font-normal">(filtered)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-slate-500 text-sm">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">
              No registrations found.
            </p>
          ) : (
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    "#",
                    "Username",
                    "Name",
                    "Phone",
                    "District",
                    "Qual.",
                    "Subjects",
                    "KA?",
                    "Registered",
                    "Passcode",
                    "Hall Ticket",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-400 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700 whitespace-nowrap">
                      {r.username}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {r.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.fatherName}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.phone}</td>
                    <td className="px-4 py-3">{r.nativeDistrict}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          r.educationalQualification === "PG"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {r.educationalQualification}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.subjects.map((s) => (
                          <span
                            key={s}
                            className="bg-indigo-50 text-indigo-700 text-xs px-1.5 py-0.5 rounded font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.isKarthikeyanStudent ? (
                        <span className="text-green-700 font-semibold">
                          Yes {r.karthikeyanYear && `(${r.karthikeyanYear})`}
                        </span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {r.registeredAt
                        ? new Date(r.registeredAt).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-sm ${revealId === r.id ? "text-slate-900 font-semibold" : "text-transparent bg-slate-200 rounded select-none"}`}
                        >
                          {r.passcode}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealId(revealId === r.id ? null : r.id)
                          }
                          className="text-slate-400 hover:text-slate-600"
                          title={revealId === r.id ? "Hide" : "Show passcode"}
                        >
                          {revealId === r.id ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={() => setSelectedStudent(r)}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 px-3"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Hall Ticket</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Hall Ticket Preview & Download Modal */}
      {selectedStudent && (
        <Dialog
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-slate-100">
            <DialogHeader className="no-print flex flex-row items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Hall Ticket Admit Card — {selectedStudent.name}
                </DialogTitle>
                <p className="text-xs text-slate-500 font-mono">
                  Username: {selectedStudent.username} · Passcode:{" "}
                  {selectedStudent.passcode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="h-8 text-xs font-semibold bg-white border-slate-300"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownloadPDF(selectedStudent)}
                  disabled={downloading}
                  className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  {downloading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1" />
                  )}
                  {downloading ? "Generating PDF…" : "Download PDF"}
                </Button>
              </div>
            </DialogHeader>

            {/* Printable Area */}
            <div className="pt-3">
              <div
                ref={printRef}
                className="hall-ticket-print max-w-3xl mx-auto bg-white shadow-lg border border-slate-300 p-0 overflow-hidden"
              >
                {/* Header */}
                <div className="text-center border-b-4 border-double border-slate-800 py-4 px-6 bg-white">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Karthikeyan Analysis Study Circle (KASC)
                  </p>
                  <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                    HALL TICKET
                  </h1>
                  <p className="text-sm font-semibold text-indigo-700 mt-0.5">
                    CBT Mock Test Programme – 2026
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Syllabus Code: SOLP
                  </p>
                </div>

                {/* Student Info */}
                <div className="flex flex-col sm:flex-row gap-0 border-b border-slate-300 bg-white">
                  <div className="flex-1 p-5">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        <InfoRow label="Name" value={selectedStudent.name} />
                        <InfoRow
                          label="Father's Name"
                          value={selectedStudent.fatherName}
                        />
                        <InfoRow
                          label="Date of Birth"
                          value={selectedStudent.dob}
                        />
                        <InfoRow label="Phone" value={selectedStudent.phone} />
                        <InfoRow
                          label="Native District"
                          value={selectedStudent.nativeDistrict}
                        />
                        <InfoRow
                          label="Gender"
                          value={selectedStudent.gender}
                        />
                        <InfoRow
                          label="Qualification"
                          value={`${
                            selectedStudent.educationalQualification === "Both"
                              ? "UG & PG"
                              : selectedStudent.educationalQualification
                          } – ${selectedStudent.subjects.join(", ")}`}
                        />
                        <InfoRow
                          label="KA Student"
                          value={
                            selectedStudent.isKarthikeyanStudent
                              ? `Yes${
                                  selectedStudent.karthikeyanYear
                                    ? ` (${selectedStudent.karthikeyanYear})`
                                    : ""
                                }`
                              : "No"
                          }
                        />
                      </tbody>
                    </table>
                  </div>

                  {/* Photo Box */}
                  <div className="shrink-0 flex items-center justify-center p-5 sm:border-l border-t sm:border-t-0 border-slate-200">
                    {selectedStudent.photoUrl ? (
                      <img
                        src={selectedStudent.photoUrl}
                        alt={selectedStudent.name}
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

                {/* Credentials */}
                <div className="bg-indigo-50 border-b border-slate-300 px-5 py-3 flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">
                      Username
                    </p>
                    <p className="text-xl font-extrabold text-indigo-900 tracking-widest mt-0.5 font-mono">
                      {selectedStudent.username}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">
                      Passcode
                    </p>
                    <p className="text-xl font-extrabold text-indigo-900 tracking-widest mt-0.5 font-mono">
                      {selectedStudent.passcode}
                    </p>
                  </div>
                  <div className="text-xs text-indigo-700 ml-auto italic">
                    Keep these credentials safe. Do not share.
                  </div>
                </div>

                {/* Mock Test Schedule */}
                <div className="p-5 bg-white">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                    Mock Test Schedule
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="border border-slate-600 px-3 py-2 text-left font-semibold">
                            S.No
                          </th>
                          <th className="border border-slate-600 px-3 py-2 text-left font-semibold">
                            Subject
                          </th>
                          <th className="border border-slate-600 px-3 py-2 text-center font-semibold">
                            Questions
                          </th>
                          <th className="border border-slate-600 px-3 py-2 text-center font-semibold">
                            Marks
                          </th>
                          <th className="border border-slate-600 px-3 py-2 text-left font-semibold">
                            Test Timing
                          </th>
                          <th className="border border-slate-600 px-3 py-2 text-left font-semibold">
                            Discussion
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {SCHEDULE.map((row, i) => (
                          <tr
                            key={row.sno}
                            className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            <td className="border border-slate-300 px-3 py-2 text-center">
                              {row.sno}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 font-medium">
                              {row.subject}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center">
                              {row.questions}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center">
                              {row.marks}
                            </td>
                            <td className="border border-slate-300 px-3 py-2">
                              {row.time}
                            </td>
                            <td className="border border-slate-300 px-3 py-2">
                              {row.discussion}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Instructions */}
                <div className="border-t border-slate-200 px-5 pb-5 pt-3 bg-white">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                    Instructions
                  </p>
                  <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
                    <li>
                      Take this CBT test on <strong>Laptop / Desktop</strong>{" "}
                      only.
                    </li>
                    <li>
                      Tests are conducted in Live mode only — no retakes
                      allowed.
                    </li>
                    <li>
                      All questions will be in <strong>English</strong>.
                    </li>
                    <li>
                      Attend the <strong>discussion session</strong> after each
                      exam.
                    </li>
                    <li>
                      Test links will be shared on the{" "}
                      <strong>Telegram channel</strong> only.
                    </li>
                    <li>
                      Logging in on a new device invalidates your previous
                      session.
                    </li>
                    <li>
                      This Hall Ticket must be kept safe until the programme
                      ends.
                    </li>
                  </ol>
                </div>

                {/* Telegram Notice */}
                <div className="bg-sky-700 text-white text-center text-sm font-semibold py-3 px-5">
                  Join Telegram for test links and updates — Telegram:
                  @karthikeyananalysis
                </div>

                {/* Signature Row */}
                <div className="flex justify-between items-end px-8 py-5 border-t border-slate-200 bg-white">
                  <div className="text-xs text-slate-500 text-center">
                    <div className="w-32 border-t border-slate-400 pt-1">
                      Student Signature
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">
                      Issued on {new Date().toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 text-center">
                    <div className="w-32 border-t border-slate-400 pt-1">
                      Authorised Signatory
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Print-only CSS */}
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
      <td className="py-1.5 pr-3 font-semibold text-slate-600 whitespace-nowrap w-36">
        {label}
      </td>
      <td className="py-1.5 text-slate-400 w-2">:</td>
      <td className="py-1.5 pl-2 text-slate-900">{value}</td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    green: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.indigo}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold mt-0.5 opacity-80">{label}</p>
    </div>
  );
}
