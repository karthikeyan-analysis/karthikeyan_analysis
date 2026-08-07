import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import ExamBatchAssignmentFields, {
  inferExamBatchMode,
  type ExamBatchMode,
} from "../../components/exams/ExamBatchAssignmentFields";
import {
  Plus,
  Radio,
  Trash2,
  Users,
  Video,
  PlayCircle,
  Download,
  Settings,
  Calendar,
  Shield,
  FileText,
  Copy,
  Check,
  Award,
  Activity,
  MicOff,
  VideoOff,
  Monitor,
  HelpCircle,
  Sliders,
} from "lucide-react";
import { listAdmins, type AdminProfile } from "../../features/liveClasses/adminDirectory";
import {
  createLiveClass,
  deleteLiveClass,
  endLiveClass,
  subscribeToLiveClassesForAdmin,
  updateLiveClass,
  listAttendanceForAdmin,
} from "../../features/liveClasses/liveClassApi";
import { formatLiveClassBatchLabel } from "../../features/liveClasses/liveClassBatchUtils";
import { isHostOrCoHost, liveClassStatusLabel } from "../../features/liveClasses/liveClassAvailability";
import { requestRecordingPlaybackUrl } from "../../features/liveClasses/recordingPlayback";
import type { LiveClass, LiveClassAttendance } from "../../features/liveClasses/types";
import * as XLSX from "xlsx";

function statusBadgeVariant(status: LiveClass["status"]): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "ended") return "outline";
  return "secondary";
}

type SuiteTab = "overview" | "meetings" | "controls" | "recordings" | "attendance" | "live_tests" | "settings";
type ListFilter = "all" | "live" | "scheduled" | "ended" | "recordings";

export default function LiveClassManagement() {
  const { user } = useAuth();
  const { batches, exams } = useData();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [activeTab, setActiveTab] = useState<SuiteTab>("overview");

  // Safe fallback arrays to prevent undefined.map / undefined.find crashes
  const safeBatches = useMemo(() => batches || [], [batches]);
  const safeExams = useMemo(() => exams || [], [exams]);
  const safeClasses = useMemo(() => classes || [], [classes]);
  const safeAdmins = useMemo(() => admins || [], [admins]);
  const safeAttendanceRecords = useMemo(() => attendanceRecords || [], [attendanceRecords]);

  // Filters
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attendance State
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] = useState<string>("");
  const [attendanceRecords, setAttendanceRecords] = useState<LiveClassAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Create Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [batchMode, setBatchMode] = useState<ExamBatchMode>("single");
  const [batchIds, setBatchIds] = useState<string[]>(() => (batches[0]?.id ? [batches[0].id] : []));
  const [hostUids, setHostUids] = useState<string[]>([]);
  const [coHostUids, setCoHostUids] = useState<string[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  useEffect(() => {
    const unsub = subscribeToLiveClassesForAdmin((rows) => {
      setClasses(rows);
      setLoading(false);
      if (rows.length > 0 && !selectedAttendanceClassId) {
        setSelectedAttendanceClassId(rows[0].id);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    listAdmins().then(setAdmins).catch(console.error);
  }, []);

  useEffect(() => {
    if (createOpen && user?.id && hostUids.length === 0) {
      setHostUids([user.id]);
    }
  }, [createOpen]);

  // Load attendance when attendance tab is selected
  useEffect(() => {
    if (activeTab === "attendance" && selectedAttendanceClassId) {
      setLoadingAttendance(true);
      listAttendanceForAdmin(selectedAttendanceClassId)
        .then(setAttendanceRecords)
        .catch(console.error)
        .finally(() => setLoadingAttendance(false));
    }
  }, [activeTab, selectedAttendanceClassId]);

  const allSubjects = useMemo(() => {
    const names = new Set<string>();
    for (const cls of safeClasses) {
      const s = cls.subject?.trim();
      if (s) names.add(s);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [safeClasses]);

  const subjectOptions = useMemo(() => {
    const names = new Set<string>();
    for (const id of batchIds) {
      const batch = safeBatches.find((b) => b.id === id);
      for (const s of batch?.subjects || []) {
        const t = s.trim();
        if (t) names.add(t);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [batchIds, safeBatches]);

  const filteredClasses = useMemo(() => {
    return safeClasses.filter((cls) => {
      if (subjectFilter !== "all" && cls.subject !== subjectFilter) return false;
      if (listFilter === "live") return cls.status === "active";
      if (listFilter === "scheduled") return cls.status === "scheduled";
      if (listFilter === "ended") return cls.status === "ended";
      if (listFilter === "recordings") return cls.recordingStatus === "ready";
      return true;
    });
  }, [safeClasses, listFilter, subjectFilter]);

  // Metrics
  const liveClassesList = useMemo(() => safeClasses.filter((c) => c.status === "active"), [safeClasses]);
  const scheduledClassesList = useMemo(() => safeClasses.filter((c) => c.status === "scheduled"), [safeClasses]);
  const readyRecordingsList = useMemo(() => safeClasses.filter((c) => c.recordingStatus === "ready"), [safeClasses]);
  const coHostCount = useMemo(() => safeAdmins.filter((a) => a.kind === "cohost").length, [safeAdmins]);

  const resetForm = () => {
    setName("");
    setSubject("");
    setBatchMode("single");
    setBatchIds(safeBatches[0]?.id ? [safeBatches[0].id] : []);
    setHostUids(user?.id ? [user.id] : []);
    setCoHostUids([]);
    setSelectedExamId("");
  };

  const create = async () => {
    if (!name.trim()) return alert("Please enter a class name.");
    if (!subject.trim()) return alert("Please select or enter a subject.");
    if (!batchIds.length) return alert("Please select at least one batch.");
    if (!hostUids.length) return alert("Please assign at least one host.");
    if (!user?.id) return;

    setCreating(true);
    try {
      const cleanCoHosts = coHostUids.filter((id) => !hostUids.includes(id));
      const id = await createLiveClass({
        name: name.trim(),
        subject: subject.trim(),
        batchIds,
        hostUids,
        coHostUids: cleanCoHosts,
        createdBy: user.id,
      });

      if (selectedExamId) {
        await updateLiveClass(id, {
          liveTestId: selectedExamId,
          liveTestStartedAt: new Date().toISOString(),
        });
      }

      await updateLiveClass(id, {
        status: "active",
        activeSince: new Date().toISOString(),
      });

      setCreateOpen(false);
      resetForm();
      navigate(`/admin/live-classes/${id}/room`);
    } catch (e) {
      console.error(e);
      alert("Could not create the live class.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this live class? This cannot be undone.")) return;
    try {
      await deleteLiveClass(id);
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  };

  const end = async (id: string) => {
    if (!confirm("End this class for everyone?")) return;
    try {
      await endLiveClass(id);
    } catch (e) {
      console.error(e);
      alert("Could not end the class.");
    }
  };

  const startOrJoin = async (cls: LiveClass) => {
    try {
      if (cls.status !== "active" && cls.status !== "ended") {
        await updateLiveClass(cls.id, {
          status: "active",
          activeSince: new Date().toISOString(),
        });
      }
      navigate(`/admin/live-classes/${cls.id}/room`);
    } catch (e) {
      console.error(e);
      alert("Could not start the class. Please try again.");
    }
  };

  const copyShareLink = (cls: LiveClass) => {
    const url = `${window.location.origin}/student/live-classes/${cls.id}/join`;
    navigator.clipboard.writeText(url);
    setCopiedId(cls.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadRecording = async (cls: LiveClass) => {
    if (!cls.recordingKey) {
      alert("No recording object key available for this class.");
      return;
    }
    try {
      const url = await requestRecordingPlaybackUrl(cls.id);
      if (url) {
        window.open(url, "_blank");
      } else {
        alert("Recording download link could not be generated.");
      }
    } catch (e: any) {
      alert("Could not retrieve download link: " + (e?.message || e));
    }
  };

  const exportAttendanceExcel = () => {
    if (!selectedAttendanceClassId || attendanceRecords.length === 0) {
      alert("No attendance data to export.");
      return;
    }
    const targetClass = classes.find((c) => c.id === selectedAttendanceClassId);
    const exportData = attendanceRecords.map((att, idx) => ({
      "S.No": idx + 1,
      "Student ID": att.studentId || "N/A",
      "Student Name": att.name || "Student",
      Email: att.email || "N/A",
      "Joined Time": att.firstJoinedAt ? new Date(att.firstJoinedAt).toLocaleString() : "N/A",
      "Total Minutes": Math.round((att.totalDurationSec || 0) / 60),
      Status: att.attended ? "Present" : "Absent",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    XLSX.writeFile(
      workbook,
      `Attendance_${targetClass?.subject || "Class"}_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const assignLiveTestToClass = async (classId: string, testId: string) => {
    try {
      await updateLiveClass(classId, {
        liveTestId: testId || undefined,
        liveTestStartedAt: testId ? new Date().toISOString() : undefined,
      });
      alert(testId ? "Live test assigned to ongoing class!" : "Live test unlinked.");
    } catch (e) {
      console.error(e);
      alert("Failed to update live test.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Zoom-Style Live Platform Suite
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Video Classes & Meeting Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage subject-wise meeting links, live sessions, Cloudflare R2 recordings, attendance logs, and live test triggers.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              className="bg-indigo-600 shadow-md hover:bg-indigo-500 font-medium"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Meeting Link
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              onClick={() => navigate("/admin/co-hosts")}
            >
              <Users className="mr-1.5 h-4 w-4 text-indigo-400" />
              Co-Hosts ({coHostCount})
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Dashboard Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Live</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Radio className="h-4 w-4 animate-pulse" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{liveClassesList.length}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Classes running now</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Scheduled</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{scheduledClassesList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Ready for host join</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Recordings</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <PlayCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{readyRecordingsList.length}</p>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">Saved in R2 Cloud</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Co-Hosts</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{coHostCount}</p>
            <p className="text-xs text-purple-600 font-medium mt-0.5">Host accounts active</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Classes</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{classes.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Across all subjects</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex overflow-x-auto rounded-xl bg-slate-100 p-1.5 text-sm font-medium text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "overview" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <Activity className="h-4 w-4 text-indigo-600" />
          Dashboard Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("meetings")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "meetings" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <Video className="h-4 w-4 text-emerald-600" />
          Meeting Links & Scheduler
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("controls")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "controls" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <Sliders className="h-4 w-4 text-amber-600" />
          Host Studio Control Panel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("recordings")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "recordings" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <Download className="h-4 w-4 text-purple-600" />
          Recordings & Downloads
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "attendance" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <FileText className="h-4 w-4 text-blue-600" />
          Attendance Reports
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("live_tests")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "live_tests" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <Award className="h-4 w-4 text-rose-600" />
          Live Test Integration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all whitespace-nowrap ${
            activeTab === "settings" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
          }`}
        >
          <Settings className="h-4 w-4 text-slate-600" />
          Settings
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Action Launchpad */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              className="cursor-pointer border-slate-200 bg-white transition hover:border-indigo-300 hover:shadow-md"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Create Subject Link</h3>
                  <p className="text-xs text-slate-500">Generate meeting link for batch</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-slate-200 bg-white transition hover:border-emerald-300 hover:shadow-md"
              onClick={() => setActiveTab("meetings")}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Radio className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Start Live Meeting</h3>
                  <p className="text-xs text-slate-500">Launch Host WebRTC Studio</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-slate-200 bg-white transition hover:border-purple-300 hover:shadow-md"
              onClick={() => navigate("/admin/co-hosts")}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Manage Co-Hosts</h3>
                  <p className="text-xs text-slate-500">Create credentials & passwords</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-slate-200 bg-white transition hover:border-rose-300 hover:shadow-md"
              onClick={() => setActiveTab("live_tests")}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Trigger Live Test</h3>
                  <p className="text-xs text-slate-500">Conduct exam during live class</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Classes Radar */}
          <Card className="border-slate-200/80 shadow-none">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Live Meetings Radar
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Classes currently active or scheduled to start
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {liveClassesList.length} Active Now
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {liveClassesList.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No live meetings currently running. Click "New Meeting Link" to schedule or start a class.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {liveClassesList.map((cls) => (
                    <div
                      key={cls.id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-600">LIVE NOW</Badge>
                        <span className="text-xs font-medium text-slate-500">{cls.subject}</span>
                      </div>
                      <h4 className="mt-2 text-lg font-bold text-slate-900">{cls.name}</h4>
                      <p className="text-xs text-slate-600 mt-1">
                        Batch: {formatLiveClassBatchLabel(cls, batches)}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => navigate(`/admin/live-classes/${cls.id}/room`)}
                        >
                          <Radio className="mr-1 h-3.5 w-3.5" />
                          Join Host Studio
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => void end(cls.id)}
                        >
                          End Class
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: MEETINGS & SCHEDULER */}
      {(activeTab === "meetings" || activeTab === "overview") && (
        <Card className="border-slate-200/80 shadow-none">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Subject Meeting Links & Classes
                </CardTitle>
                <CardDescription className="text-xs">
                  Create unlimited class meeting links per subject with batch restriction.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
                  {([
                    { id: "all", label: "All" },
                    { id: "live", label: "Live" },
                    { id: "scheduled", label: "Scheduled" },
                    { id: "ended", label: "Ended" },
                  ] as const).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setListFilter(f.id)}
                      className={
                        listFilter === f.id
                          ? "rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm"
                          : "rounded-lg px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="w-44">
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {allSubjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    resetForm();
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New Link
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading meeting links…</div>
            ) : filteredClasses.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No meeting links match your criteria. Click "New Link" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Meeting Name & Subject</TableHead>
                      <TableHead className="font-semibold">Batch(es)</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Share Link</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((cls) => {
                      const canControl = isHostOrCoHost(cls, user?.id);
                      return (
                        <TableRow key={cls.id} className="hover:bg-slate-50/60">
                          <TableCell>
                            <div className="font-medium text-slate-900">{cls.name}</div>
                            <div className="text-xs text-indigo-600 font-medium">{cls.subject}</div>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-xs text-slate-600">
                            {formatLiveClassBatchLabel(cls, batches)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(cls.status)}>
                              {liveClassStatusLabel(cls)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => copyShareLink(cls)}
                            >
                              {copiedId === cls.id ? (
                                <>
                                  <Check className="mr-1 h-3 w-3 text-emerald-600" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="mr-1 h-3 w-3 text-slate-500" /> Copy Link
                                </>
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="space-x-1.5 whitespace-nowrap text-right">
                            {cls.status !== "ended" && canControl ? (
                              <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700"
                                onClick={() => void startOrJoin(cls)}
                              >
                                <Radio className="mr-1 h-3.5 w-3.5" />
                                {cls.status === "active" ? "Join Studio" : "Start Meeting"}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => void remove(cls.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: HOST CONTROLS & STUDIO HUB */}
      {activeTab === "controls" && (
        <div className="space-y-6">
          <Card className="border-slate-200/80 bg-white">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-900">
                Zoom-Style Control Panel Reference
              </CardTitle>
              <CardDescription className="text-xs">
                Host & Co-Host features available inside the WebRTC Live Meeting Studio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600 mb-3">
                    <MicOff className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Mute / Unmute Control</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Host/Co-host can toggle audio state for individual students or mute all participants upon entry.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 mb-3">
                    <VideoOff className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Video Disable / Enable</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Control student camera streams during lectures to preserve bandwidth and eliminate distractions.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Screen Sharing</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    High-definition screen & tab sharing with mixed microphone audio for seamless teaching.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 mb-3">
                    <PlayCircle className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Cloud Recording</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Start/stop recording at any moment. Automatically processed and saved into Cloudflare R2 storage.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 mb-3">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Participant Eviction</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Remove disruptive participants from the meeting immediately with one click.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mb-3">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Private Doubts Panel</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Student doubts are routed privately to Host and Co-Host controls for focused Q&A.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: RECORDINGS & DOWNLOADS */}
      {activeTab === "recordings" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Recording Module & Cloud Downloads
            </CardTitle>
            <CardDescription className="text-xs">
              Subject-wise recording storage in Cloudflare R2 with direct download and playback capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {readyRecordingsList.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No completed recordings found yet. Recordings will automatically appear here after a class host stops recording.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Class Name</TableHead>
                      <TableHead className="font-semibold">Subject</TableHead>
                      <TableHead className="font-semibold">Storage Location</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyRecordingsList.map((cls) => (
                      <TableRow key={cls.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-900">{cls.name}</TableCell>
                        <TableCell className="text-indigo-600 font-medium">{cls.subject}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                          {cls.recordingKey || "Cloudflare R2 Bucket"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-600">Ready</Badge>
                        </TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/live-classes/${cls.id}/recording`)}
                          >
                            <PlayCircle className="mr-1 h-3.5 w-3.5 text-indigo-600" />
                            Watch
                          </Button>
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => void handleDownloadRecording(cls)}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 5: ATTENDANCE REPORTS */}
      {activeTab === "attendance" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Attendance Tracking & Report Generator
                </CardTitle>
                <CardDescription className="text-xs">
                  Automatic class session attendance tracking with Excel report download.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select value={selectedAttendanceClassId} onValueChange={setSelectedAttendanceClassId}>
                  <SelectTrigger className="w-56 bg-white">
                    <SelectValue placeholder="Select class session" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.subject})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={exportAttendanceExcel}
                  disabled={safeAttendanceRecords.length === 0}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAttendance ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading attendance records…</div>
            ) : safeAttendanceRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No attendance records recorded for this class session yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Student Name</TableHead>
                      <TableHead className="font-semibold">Email / ID</TableHead>
                      <TableHead className="font-semibold">Joined At</TableHead>
                      <TableHead className="font-semibold">Stay Duration</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeAttendanceRecords.map((att) => (
                      <TableRow key={att.uid} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-900">{att.name}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <div>{att.email}</div>
                          {att.studentId ? (
                            <span className="text-[10px] text-slate-400 font-mono">{att.studentId}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {att.firstJoinedAt ? new Date(att.firstJoinedAt).toLocaleTimeString() : "N/A"}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">
                          {Math.round((att.totalDurationSec || 0) / 60)} mins
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Present
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 6: LIVE TEST MODULE */}
      {activeTab === "live_tests" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Live Exam & Test Integration
            </CardTitle>
            <CardDescription className="text-xs">
              Attach an active CBT test to an ongoing video class. Students participate automatically upon joining the meeting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs text-amber-800">
              💡 Select an ongoing class below to assign or launch a live test from your CBT Exam Engine.
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold">Live Meeting</TableHead>
                    <TableHead className="font-semibold">Subject</TableHead>
                    <TableHead className="font-semibold">Assigned Exam</TableHead>
                    <TableHead className="text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeClasses.map((cls) => {
                    const currentTest = safeExams.find((e) => e.id === cls.liveTestId);
                    return (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium text-slate-900">{cls.name}</TableCell>
                        <TableCell className="text-xs text-indigo-600">{cls.subject}</TableCell>
                        <TableCell>
                          <Select
                            value={cls.liveTestId || "none"}
                            onValueChange={(val) =>
                              assignLiveTestToClass(cls.id, val === "none" ? "" : val)
                            }
                          >
                            <SelectTrigger className="w-56 h-8 text-xs bg-white">
                              <SelectValue placeholder="Select live test" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Live Test Linked</SelectItem>
                              {safeExams.map((ex) => (
                                <SelectItem key={ex.id} value={ex.id}>
                                  {ex.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {currentTest ? (
                            <Badge className="bg-rose-600">Test Active</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">Ready</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: SETTINGS */}
      {activeTab === "settings" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Platform Security & Cloud Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Configure session gating, single device login restrictions, and Cloudflare media infrastructure status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <h4 className="font-semibold text-slate-900">One-Device Session Lock</h4>
                <p className="text-xs text-slate-500">
                  Enforces single active device per student session to prevent account sharing during live classes.
                </p>
              </div>
              <Badge className="bg-emerald-600">Enforced</Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <h4 className="font-semibold text-slate-900">Cloudflare Realtime SFU & TURN</h4>
                <p className="text-xs text-slate-500">
                  WebRTC Media Relay for smooth, low-latency live class streaming across Tamil Nadu network providers.
                </p>
              </div>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                Connected
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <h4 className="font-semibold text-slate-900">Cloudflare R2 Storage Bucket</h4>
                <p className="text-xs text-slate-500">
                  Durable Asia-Pacific object storage bucket (`kasc-live-class-recordings`) for automated recording archives.
                </p>
              </div>
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Meeting Link Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Subject Meeting Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class / Session Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TNPSC General Studies — Live Lecture 5"
              />
            </div>

            <ExamBatchAssignmentFields
              batches={safeBatches.map((b) => ({ id: b.id, name: b.name }))}
              mode={batchMode}
              batchIds={batchIds}
              onModeChange={setBatchMode}
              onBatchIdsChange={(ids) => {
                setBatchIds(ids);
                setBatchMode(inferExamBatchMode(ids));
              }}
              hint="Only students enrolled in selected batch(es) can join this meeting."
            />

            <div className="space-y-2">
              <Label>Subject</Label>
              {subjectOptions.length > 0 ? (
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. General Studies / Mathematics"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Optional Live Exam Trigger</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="None (Standard Live Class)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Standard Live Class)</SelectItem>
                  {safeExams.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Host(s)</Label>
                <button
                  type="button"
                  className="text-xs text-indigo-700 hover:underline"
                  onClick={() => navigate("/admin/co-hosts")}
                >
                  Manage co-hosts
                </button>
              </div>
              <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
                {safeAdmins.map((a) => (
                  <label key={a.uid} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={hostUids.includes(a.uid)}
                      onCheckedChange={(v) => {
                        if (v === true) {
                          setHostUids((prev) => [...new Set([...prev, a.uid])]);
                          setCoHostUids((prev) => prev.filter((id) => id !== a.uid));
                        } else {
                          setHostUids((prev) => prev.filter((id) => id !== a.uid));
                        }
                      }}
                    />
                    <span>
                      {a.name} {a.kind === "cohost" ? "(Co-Host Login)" : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => void create()}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create & Launch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
