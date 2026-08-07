import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
  Sparkles,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as SuiteTab | null;

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [activeTab, setActiveTab] = useState<SuiteTab>(tabParam || "overview");

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: SuiteTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Filters
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attendance State
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] = useState<string>("");
  const [attendanceRecords, setAttendanceRecords] = useState<LiveClassAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Safe fallback arrays to prevent undefined.map / undefined.find crashes
  const safeBatches = useMemo(() => batches || [], [batches]);
  const safeExams = useMemo(() => exams || [], [exams]);
  const safeClasses = useMemo(() => classes || [], [classes]);
  const safeAdmins = useMemo(() => admins || [], [admins]);
  const safeAttendanceRecords = useMemo(() => attendanceRecords || [], [attendanceRecords]);

  // Create Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [batchMode, setBatchMode] = useState<ExamBatchMode>("single");
  const [batchIds, setBatchIds] = useState<string[]>(() => (safeBatches[0]?.id ? [safeBatches[0].id] : []));
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
    if (!selectedAttendanceClassId || safeAttendanceRecords.length === 0) {
      alert("No attendance data to export.");
      return;
    }
    const targetClass = safeClasses.find((c) => c.id === selectedAttendanceClassId);
    const exportData = safeAttendanceRecords.map((att, idx) => ({
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
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      {/* Overview Top Executive Banner & KPI Metrics (Shown exclusively on Overview Tab) */}
      {activeTab === "overview" && (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-5 text-white shadow-xl ring-1 ring-white/10">
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Live Video Classes Suite
                  </span>
                </div>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  Video Classes & Meeting Dashboard
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="bg-indigo-600 font-semibold shadow-md hover:bg-indigo-500"
                  onClick={() => {
                    resetForm();
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  New Meeting Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/admin/co-hosts")}
                >
                  <Shield className="mr-1.5 h-3.5 w-3.5 text-indigo-400" />
                  Co-Hosts ({coHostCount})
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Active Live</span>
                <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{liveClassesList.length}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Scheduled</span>
                <Calendar className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{scheduledClassesList.length}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">R2 Recordings</span>
                <PlayCircle className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{readyRecordingsList.length}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Co-Hosts</span>
                <Shield className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{coHostCount}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Classes</span>
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{safeClasses.length}</p>
            </div>
          </div>
        </>
      )}

      {/* Dynamic Sub-Page Header for Non-Overview Tabs */}
      {activeTab !== "overview" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
              {activeTab === "meetings" && <Video className="h-5 w-5" />}
              {activeTab === "controls" && <Sliders className="h-5 w-5 text-amber-300" />}
              {activeTab === "recordings" && <Download className="h-5 w-5 text-purple-300" />}
              {activeTab === "attendance" && <FileText className="h-5 w-5 text-blue-300" />}
              {activeTab === "live_tests" && <Award className="h-5 w-5 text-rose-300" />}
              {activeTab === "settings" && <Settings className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTab === "meetings" && "Subject Meeting Links & Scheduler"}
                {activeTab === "controls" && "Host Studio Control Panel"}
                {activeTab === "recordings" && "Recordings & Cloud Downloads"}
                {activeTab === "attendance" && "Attendance Reports & Exporter"}
                {activeTab === "live_tests" && "Live Exam Integration"}
                {activeTab === "settings" && "Platform Security & Settings"}
              </h2>
              <p className="text-xs text-slate-500">
                {activeTab === "meetings" && "Manage subject-wise links, active sessions & batch access"}
                {activeTab === "controls" && "WebRTC studio control features for hosts & co-hosts"}
                {activeTab === "recordings" && "Cloudflare R2 recording storage & instant download links"}
                {activeTab === "attendance" && "View student join logs and export official attendance spreadsheets"}
                {activeTab === "live_tests" && "Attach CBT tests directly to live video class sessions"}
                {activeTab === "settings" && "Cloudflare SFU, R2 bucket & security enforcement"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "meetings" && (
              <Button
                size="sm"
                className="bg-indigo-600 font-semibold shadow-md hover:bg-indigo-500 text-xs"
                onClick={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Meeting Link
              </Button>
            )}

            {activeTab === "attendance" && (
              <Button
                size="sm"
                className="bg-emerald-600 font-semibold shadow-md hover:bg-emerald-500 text-xs"
                onClick={exportAttendanceExcel}
                disabled={safeAttendanceRecords.length === 0}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export Excel
              </Button>
            )}

            {activeTab === "live_tests" && (
              <Button
                size="sm"
                className="bg-rose-600 font-semibold shadow-md hover:bg-rose-500 text-xs"
                onClick={() => navigate("/admin/tests/create")}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create CBT Exam
              </Button>
            )}

            {activeTab === "controls" && (
              <Button
                size="sm"
                className="bg-indigo-600 font-semibold shadow-md hover:bg-indigo-500 text-xs"
                onClick={() => navigate("/admin/co-hosts")}
              >
                <Shield className="mr-1 h-3.5 w-3.5" />
                Manage Co-Hosts
              </Button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Active Classes Radar */}
          <Card className="border-slate-200/80 shadow-none">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
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
                <div className="py-8 text-center text-xs text-slate-500">
                  No live meetings currently running. Click "New Meeting Link" to start a class.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {liveClassesList.map((cls) => (
                    <div
                      key={cls.id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-600 text-[10px]">LIVE NOW</Badge>
                        <span className="text-xs font-semibold text-slate-600">{cls.subject}</span>
                      </div>
                      <h4 className="mt-1.5 text-base font-bold text-slate-900">{cls.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Batch: {formatLiveClassBatchLabel(cls, safeBatches)}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => navigate(`/admin/live-classes/${cls.id}/room`)}
                        >
                          <Radio className="mr-1 h-3.5 w-3.5" />
                          Join Host Studio
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 text-xs"
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
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Subject Meeting Links & Classes
                </CardTitle>
                <CardDescription className="text-xs">
                  Create unlimited class meeting links per subject with batch restriction.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
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
                          ? "rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-xs"
                          : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="w-36">
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger className="h-7 text-xs bg-white">
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
                  className="h-7 bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold"
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

          <CardContent className="pt-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading meeting links…</div>
            ) : filteredClasses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No meeting links match your criteria. Click "New Link" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-xs">
                      <TableHead className="font-bold">Meeting Name & Subject</TableHead>
                      <TableHead className="font-bold">Batch(es)</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Share Link</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((cls) => {
                      const canControl = isHostOrCoHost(cls, user?.id);
                      return (
                        <TableRow key={cls.id} className="hover:bg-slate-50/60 text-xs">
                          <TableCell>
                            <div className="font-bold text-slate-900">{cls.name}</div>
                            <div className="text-xs text-indigo-600 font-semibold">{cls.subject}</div>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-slate-600">
                            {formatLiveClassBatchLabel(cls, safeBatches)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(cls.status)} className="text-[10px]">
                              {liveClassStatusLabel(cls)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2"
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
                          <TableCell className="space-x-1 whitespace-nowrap text-right">
                            {cls.status !== "ended" && canControl ? (
                              <Button
                                size="sm"
                                className="h-6 text-[11px] bg-indigo-600 hover:bg-indigo-700"
                                onClick={() => void startOrJoin(cls)}
                              >
                                <Radio className="mr-1 h-3 w-3" />
                                {cls.status === "active" ? "Join Studio" : "Start"}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
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
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">
              Host & Co-Host Control Panel Guide
            </CardTitle>
            <CardDescription className="text-xs">
              Live WebRTC Studio feature breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 mb-2">
                  <MicOff className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">Mute / Unmute Control</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Host/Co-host can toggle audio state for students.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 mb-2">
                  <VideoOff className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">Video Disable / Enable</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Control student video streams to conserve bandwidth.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-2">
                  <Monitor className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-xs text-slate-900">Screen Sharing</h4>
                <p className="mt-1 text-xs text-slate-500">
                  HD Screen and tab sharing with mixed microphone audio.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: RECORDINGS & DOWNLOADS */}
      {activeTab === "recordings" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">
              Recording Module & Cloud Downloads
            </CardTitle>
            <CardDescription className="text-xs">
              Subject-wise recording storage in Cloudflare R2 with direct download link generator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {readyRecordingsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No completed recordings found yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-xs">
                      <TableHead className="font-bold">Class Name</TableHead>
                      <TableHead className="font-bold">Subject</TableHead>
                      <TableHead className="font-bold">Storage Key</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyRecordingsList.map((cls) => (
                      <TableRow key={cls.id} className="hover:bg-slate-50/60 text-xs">
                        <TableCell className="font-bold text-slate-900">{cls.name}</TableCell>
                        <TableCell className="text-indigo-600 font-semibold">{cls.subject}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                          {cls.recordingKey || "R2 Storage Bucket"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-600 text-[10px]">Ready</Badge>
                        </TableCell>
                        <TableCell className="space-x-1.5 whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px]"
                            onClick={() => navigate(`/admin/live-classes/${cls.id}/recording`)}
                          >
                            <PlayCircle className="mr-1 h-3 w-3 text-indigo-600" /> Watch
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-[11px] bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => void handleDownloadRecording(cls)}
                          >
                            <Download className="mr-1 h-3 w-3" /> Download
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Attendance Tracking & Excel Exporter
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
                <Select value={selectedAttendanceClassId} onValueChange={setSelectedAttendanceClassId}>
                  <SelectTrigger className="w-48 h-7 text-xs bg-white">
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
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 font-semibold"
                  onClick={exportAttendanceExcel}
                  disabled={safeAttendanceRecords.length === 0}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAttendance ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading attendance records…</div>
            ) : safeAttendanceRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No attendance records logged for this session yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-xs">
                      <TableHead className="font-bold">Student Name</TableHead>
                      <TableHead className="font-bold">Email / ID</TableHead>
                      <TableHead className="font-bold">Joined At</TableHead>
                      <TableHead className="font-bold">Duration</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeAttendanceRecords.map((att) => (
                      <TableRow key={att.uid} className="hover:bg-slate-50/60 text-xs">
                        <TableCell className="font-bold text-slate-900">{att.name}</TableCell>
                        <TableCell className="text-slate-600">
                          <div>{att.email}</div>
                          {att.studentId ? (
                            <span className="text-[10px] text-slate-400 font-mono">{att.studentId}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {att.firstJoinedAt ? new Date(att.firstJoinedAt).toLocaleTimeString() : "N/A"}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">
                          {Math.round((att.totalDurationSec || 0) / 60)} mins
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
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
            <CardTitle className="text-sm font-bold text-slate-900">
              Live Exam Integration
            </CardTitle>
            <CardDescription className="text-xs">
              Attach an active CBT test to an ongoing video class.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 text-xs">
                    <TableHead className="font-bold">Live Meeting</TableHead>
                    <TableHead className="font-bold">Subject</TableHead>
                    <TableHead className="font-bold">Assigned Exam</TableHead>
                    <TableHead className="text-right font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeClasses.map((cls) => {
                    const currentTest = safeExams.find((e) => e.id === cls.liveTestId);
                    return (
                      <TableRow key={cls.id} className="text-xs">
                        <TableCell className="font-bold text-slate-900">{cls.name}</TableCell>
                        <TableCell className="text-indigo-600 font-semibold">{cls.subject}</TableCell>
                        <TableCell>
                          <Select
                            value={cls.liveTestId || "none"}
                            onValueChange={(val) =>
                              assignLiveTestToClass(cls.id, val === "none" ? "" : val)
                            }
                          >
                            <SelectTrigger className="w-48 h-7 text-xs bg-white">
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
                            <Badge className="bg-rose-600 text-[10px]">Test Active</Badge>
                          ) : (
                            <span className="text-[11px] text-slate-400">Ready</span>
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
            <CardTitle className="text-sm font-bold text-slate-900">
              Platform Security & Cloud Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <h4 className="font-bold text-slate-900">One-Device Session Lock</h4>
                <p className="text-[11px] text-slate-500">
                  Enforces single active device per student session.
                </p>
              </div>
              <Badge className="bg-emerald-600 text-[10px]">Enforced</Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <h4 className="font-bold text-slate-900">Cloudflare Realtime SFU & TURN</h4>
                <p className="text-[11px] text-slate-500">
                  WebRTC Media Relay for smooth, low-latency live class streaming.
                </p>
              </div>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">
                Connected
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <h4 className="font-bold text-slate-900">Cloudflare R2 Storage Bucket</h4>
                <p className="text-[11px] text-slate-500">
                  Asia-Pacific object storage bucket (`kasc-live-class-recordings`).
                </p>
              </div>
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[10px]">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Meeting Link Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Subject Meeting Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label>Class / Session Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TNPSC General Studies — Lecture 5"
                className="h-8 text-xs"
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

            <div className="space-y-1">
              <Label>Subject</Label>
              {subjectOptions.length > 0 ? (
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="h-8 text-xs">
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
                  className="h-8 text-xs"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label>Optional Live Exam Trigger</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="h-8 text-xs bg-white">
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

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label>Host(s)</Label>
                <button
                  type="button"
                  className="text-[11px] text-indigo-700 hover:underline"
                  onClick={() => navigate("/admin/co-hosts")}
                >
                  Manage co-hosts
                </button>
              </div>
              <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-xs">
                {safeAdmins.map((a) => (
                  <label key={a.uid} className="flex items-center gap-2 text-xs">
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
                      {a.name} {a.kind === "cohost" ? "(Co-Host)" : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
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
