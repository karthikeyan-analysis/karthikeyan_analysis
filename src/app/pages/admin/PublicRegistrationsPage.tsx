import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { PublicStudent } from "../../context/PublicAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Search, Download, RefreshCw, Users, Eye, EyeOff, Link, Copy, Check } from "lucide-react";

type Row = PublicStudent & { id: string };

export default function PublicRegistrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

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
        query(collection(db, "publicCBTStudents"), orderBy("registeredAt", "desc")),
      );
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PublicStudent) })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  const exportCSV = () => {
    const headers = [
      "Username", "Name", "Father's Name", "DOB", "Phone",
      "District", "Gender", "Qualification", "Subjects",
      "KA Student", "KA Year", "Passcode", "Registered At",
    ];
    const escapeCell = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvRows = filtered.map((r) =>
      [
        r.username, r.name, r.fatherName, r.dob, r.phone,
        r.nativeDistrict, r.gender, r.educationalQualification,
        r.subjects.join("; "),
        r.isKarthikeyanStudent ? "Yes" : "No",
        r.karthikeyanYear || "",
        r.passcode,
        r.registeredAt,
      ].map(escapeCell).join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv" });
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
          <h1 className="text-2xl font-bold text-slate-900">Public CBT Registrations</h1>
          <p className="text-sm text-slate-500 mt-0.5">All registered public students for KASC Mock Test 2026</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportCSV} disabled={filtered.length === 0} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Registration Link Share Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-semibold text-indigo-800">Student Registration Link</p>
        </div>
        <p className="text-xs text-indigo-600 mb-3">
          Share this link with students to let them self-register for the CBT Mock Test Portal.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 overflow-x-auto whitespace-nowrap">
            {registrationLink}
          </div>
          <Button
            onClick={copyLink}
            className={linkCopied ? "bg-green-600 hover:bg-green-700 shrink-0" : "bg-indigo-600 hover:bg-indigo-700 shrink-0"}
          >
            {linkCopied ? (
              <><Check className="w-4 h-4 mr-1.5" /> Copied!</>
            ) : (
              <><Copy className="w-4 h-4 mr-1.5" /> Copy Link</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={rows.length} color="indigo" />
        <StatCard label="UG" value={rows.filter((r) => r.educationalQualification === "UG").length} color="sky" />
        <StatCard label="PG" value={rows.filter((r) => r.educationalQualification === "PG").length} color="purple" />
        <StatCard label="KA Students" value={rows.filter((r) => r.isKarthikeyanStudent).length} color="green" />
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
            {search && <span className="text-slate-400 font-normal">(filtered)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-slate-500 text-sm">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">No registrations found.</p>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["#", "Username", "Name", "Phone", "District", "Qual.", "Subjects", "KA?", "Registered", "Passcode"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700 whitespace-nowrap">{r.username}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.fatherName}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.phone}</td>
                    <td className="px-4 py-3">{r.nativeDistrict}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.educationalQualification === "PG" ? "default" : "secondary"}>
                        {r.educationalQualification}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.subjects.map((s) => (
                          <span key={s} className="bg-indigo-50 text-indigo-700 text-xs px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.isKarthikeyanStudent ? (
                        <span className="text-green-700 font-semibold">Yes {r.karthikeyanYear && `(${r.karthikeyanYear})`}</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {r.registeredAt ? new Date(r.registeredAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-sm ${revealId === r.id ? "text-slate-900" : "text-transparent bg-slate-200 rounded select-none"}`}>
                          {r.passcode}
                        </span>
                        <button
                          onClick={() => setRevealId(revealId === r.id ? null : r.id)}
                          className="text-slate-400 hover:text-slate-600"
                          title={revealId === r.id ? "Hide" : "Show passcode"}
                        >
                          {revealId === r.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
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
