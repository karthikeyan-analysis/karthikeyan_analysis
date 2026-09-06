import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePublicAuth } from "../../context/PublicAuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { ExamTest } from "../../features/exams/types";
import {
  FileText,
  LogOut,
  Printer,
  Send,
  Clock,
  CalendarDays,
  BookOpen,
  ExternalLink,
} from "lucide-react";

export default function PublicDashboard() {
  const navigate = useNavigate();
  const { publicStudent, logout, loading } = usePublicAuth();
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !publicStudent) {
      navigate("/public/login", { replace: true });
    }
  }, [loading, publicStudent, navigate]);

  // Load published tests available to public (passcode-enabled or open)
  useEffect(() => {
    const loadTests = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "examTests"),
            where("status", "==", "published"),
            orderBy("startAt", "asc"),
          ),
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExamTest[];
        // Show tests that have a passcode (public access) or are generally open
        const visible = all.filter(
          (t) => t.accessPasswordHash || (t.visibility as string) === "ALL" || (t as any).isPublicTest === true,
        );
        setTests(visible);
      } catch (e) {
        console.error(e);
      } finally {
        setTestsLoading(false);
      }
    };
    loadTests();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/public/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!publicStudent) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getWindowLabel = (t: ExamTest) => {
    const now = Date.now();
    const start = new Date(t.startAt).getTime();
    const end = new Date(t.endAt).getTime();
    if (now < start) return { label: "Upcoming", color: "bg-blue-100 text-blue-800" };
    if (now > end) return { label: "Ended", color: "bg-slate-100 text-slate-600" };
    return { label: "Live Now", color: "bg-green-100 text-green-800" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-500 font-medium">Karthikeyan Analysis Study Circle</p>
          <p className="font-bold text-slate-900">CBT Mock Test Portal — 2026</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome card */}
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-indigo-200 text-sm font-medium">Welcome,</p>
                <h2 className="text-2xl font-bold mt-0.5">{publicStudent.name}</h2>
                <div className="flex flex-wrap gap-3 mt-3 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full font-semibold tracking-widest">
                    {publicStudent.username}
                  </span>
                  <span className="bg-white/20 px-3 py-1 rounded-full">
                    {publicStudent.educationalQualification} · {publicStudent.subjects.join(", ")}
                  </span>
                </div>
              </div>
              {publicStudent.photoUrl && (
                <img
                  src={publicStudent.photoUrl}
                  alt={publicStudent.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white/50"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/public/hall-ticket")}
            className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-slate-200 hover:border-indigo-400 transition shadow-sm group"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition">
              <Printer className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900">Hall Ticket</p>
              <p className="text-sm text-slate-500">View & print admit card</p>
            </div>
          </button>
          <a
            href="https://t.me/karthikeyananalysis"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-slate-200 hover:border-sky-400 transition shadow-sm group"
          >
            <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center group-hover:bg-sky-200 transition">
              <Send className="w-6 h-6 text-sky-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900">Telegram Channel</p>
              <p className="text-sm text-slate-500">Get test links & updates</p>
            </div>
          </a>
        </div>

        {/* Important notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Send className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Join Telegram for Test Links</p>
            <p className="mt-0.5">Test access links and your login credentials will be shared on our Telegram channel. Make sure to join to receive your specific test links before the exam.</p>
          </div>
        </div>

        {/* Available tests */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-base">Available Tests</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {testsLoading ? (
              <p className="text-sm text-slate-500 p-6">Loading tests…</p>
            ) : tests.length === 0 ? (
              <div className="p-6 text-center">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No tests available yet</p>
                <p className="text-sm text-slate-400 mt-1">Check back soon or watch the Telegram channel.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tests.map((t) => {
                  const { label, color } = getWindowLabel(t);
                  const isLive = label === "Live Now";
                  return (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-slate-900">{t.title}</p>
                          <Badge className={color}>{label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {formatDate(t.startAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t.totalQuestions} questions · {t.totalMarks} marks
                          </span>
                          {t.subject && <span>{t.subject}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={!isLive}
                        onClick={() => navigate(`/student/join-test/${t.id}`)}
                        className={isLive ? "bg-green-600 hover:bg-green-700 shrink-0" : "shrink-0"}
                        variant={isLive ? "default" : "outline"}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        {isLive ? "Join Test" : label}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Instructions</p>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Take this CBT test on Laptop / Desktop only</li>
                  <li>Tests are conducted in Live mode only</li>
                  <li>All questions will be in English</li>
                  <li>Attend the test discussion session after each exam</li>
                  <li>Your login is single-device only — sharing credentials is not allowed</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
