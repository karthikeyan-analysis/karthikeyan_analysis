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
import { Switch } from "../../components/ui/switch";
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
  Search,
  Edit3,
  Eye,
  ExternalLink,
  ShieldCheck,
  Save,
  CheckCircle2,
  Clock,
  Zap,
  Loader2,
  Info,
} from "lucide-react";
import { collection, deleteField, onSnapshot, query } from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { storage } from "../../../config/firebase";
import { listAdmins, type AdminProfile } from "../../features/liveClasses/adminDirectory";
import {
  createLiveClass,
  deleteLiveClass,
  endLiveClass,
  subscribeToLiveClassesForAdmin,
  updateLiveClass,
  listAttendanceForAdmin,
} from "../../features/liveClasses/liveClassApi";
import { formatLiveClassBatchLabel, getLiveClassBatchIds } from "../../features/liveClasses/liveClassBatchUtils";
import { isHostOrCoHost, liveClassStatusLabel } from "../../features/liveClasses/liveClassAvailability";
import { requestRecordingPlaybackUrl } from "../../features/liveClasses/recordingPlayback";
import type { LiveClass, LiveClassAttendance } from "../../features/liveClasses/types";
import * as XLSX from "xlsx";

function statusBadgeVariant(status: LiveClass["status"]): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "ended") return "outline";
  return "secondary";
}

function formatClassDateTime(cls: LiveClass): string {
  const dateStr = (cls as any).scheduledStartAt || cls.scheduledAt || cls.createdAt;
  if (!dateStr) return "Live Session";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Live Session";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Live Session";
  }
}

type SuiteTab = "overview" | "meetings" | "recordings" | "attendance" | "live_tests" | "settings";
type ListFilter = "all" | "live" | "scheduled" | "ended" | "recordings";

export default function LiveClassManagement() {
  const { user } = useAuth();
  const { batches } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as SuiteTab | null;

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [activeTab, setActiveTab] = useState<SuiteTab>(tabParam || "overview");

  // Exam Details Modal State
  const [examDetailsOpen, setExamDetailsOpen] = useState(false);
  const [selectedExamForModal, setSelectedExamForModal] = useState<any>(null);

  const openExamDetailsModal = (exam: any) => {
    setSelectedExamForModal(exam);
    setExamDetailsOpen(true);
  };

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: SuiteTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Filters & Search
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attendance State & Search
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] = useState<string>("");
  const [attendanceRecords, setAttendanceRecords] = useState<LiveClassAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [searchAttendance, setSearchAttendance] = useState<string>("");

  // Recordings Video Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Edit Meeting Dialog State
  const [editOpen, setEditOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<LiveClass | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBatchMode, setEditBatchMode] = useState<ExamBatchMode>("single");
  const [editBatchIds, setEditBatchIds] = useState<string[]>([]);
  const [editHostUids, setEditHostUids] = useState<string[]>([]);
  const [editCoHostUids, setEditCoHostUids] = useState<string[]>([]);
  const [editExamId, setEditExamId] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Settings State (Persisted in localStorage)
  const [defaultMicMode, setDefaultMicMode] = useState<"muted" | "unmuted">(() => {
    return (localStorage.getItem("kasc_live_default_mic") as "muted" | "unmuted") || "muted";
  });
  const [defaultCamMode, setDefaultCamMode] = useState<"enabled" | "disabled">(() => {
    return (localStorage.getItem("kasc_live_default_cam") as "enabled" | "disabled") || "enabled";
  });
  const [streamQuality, setStreamQuality] = useState<"auto" | "720p" | "1080p">(() => {
    return (localStorage.getItem("kasc_live_stream_quality") as "auto" | "720p" | "1080p") || "720p";
  });
  const [doubtsPanelEnabled, setDoubtsPanelEnabled] = useState<boolean>(() => {
    return localStorage.getItem("kasc_live_doubts_enabled") !== "false";
  });
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  const saveSettings = () => {
    localStorage.setItem("kasc_live_default_mic", defaultMicMode);
    localStorage.setItem("kasc_live_default_cam", defaultCamMode);
    localStorage.setItem("kasc_live_stream_quality", streamQuality);
    localStorage.setItem("kasc_live_doubts_enabled", String(doubtsPanelEnabled));
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 3000);
  };

  // Safe fallback arrays to prevent undefined.map / undefined.find crashes
  const safeBatches = useMemo(() => batches || [], [batches]);
  const safeExams = useMemo(() => (useData() as any).exams || [], []);
  const safeClasses = useMemo(() => classes || [], [classes]);
  const safeAdmins = useMemo(() => admins || [], [admins]);
  const safeAttendanceRecords = useMemo(() => attendanceRecords || [], [attendanceRecords]);

  // Create Dialog State
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = cls.name.toLowerCase().includes(q);
        const matchesSubj = cls.subject.toLowerCase().includes(q);
        const batchLabel = formatLiveClassBatchLabel(cls, safeBatches).toLowerCase();
        if (!matchesName && !matchesSubj && !batchLabel.includes(q)) return false;
      }
      return true;
    });
  }, [safeClasses, listFilter, subjectFilter, searchQuery, safeBatches]);

  // Metrics
  const liveClassesList = useMemo(() => safeClasses.filter((c) => c.status === "active"), [safeClasses]);
  const scheduledClassesList = useMemo(() => safeClasses.filter((c) => c.status === "scheduled"), [safeClasses]);
  const readyRecordingsList = useMemo(() => safeClasses.filter((c) => c.recordingStatus === "ready"), [safeClasses]);
  const coHostCount = useMemo(() => safeAdmins.filter((a) => a.kind === "cohost").length, [safeAdmins]);

  // Attendance Statistics
  const filteredAttendanceRecords = useMemo(() => {
    if (!searchAttendance.trim()) return safeAttendanceRecords;
    const q = searchAttendance.toLowerCase().trim();
    return safeAttendanceRecords.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q) ||
        (a.studentId || "").toLowerCase().includes(q),
    );
  }, [safeAttendanceRecords, searchAttendance]);

  const attendanceMetrics = useMemo(() => {
    const totalPresent = safeAttendanceRecords.length;
    const totalDurationMins = safeAttendanceRecords.reduce(
      (acc, r) => acc + Math.round((r.totalDurationSec || 0) / 60),
      0,
    );
    const avgDuration = totalPresent > 0 ? Math.round(totalDurationMins / totalPresent) : 0;
    return { totalPresent, totalDurationMins, avgDuration };
  }, [safeAttendanceRecords]);

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

  const openEditModal = (cls: LiveClass) => {
    setEditingClass(cls);
    setEditName(cls.name);
    setEditSubject(cls.subject);
    const bIds = getLiveClassBatchIds(cls);
    setEditBatchIds(bIds);
    setEditBatchMode(inferExamBatchMode(bIds));
    setEditHostUids(cls.hostUids || []);
    setEditCoHostUids(cls.coHostUids || []);
    setEditExamId(cls.liveTestId || "none");
    setEditOpen(true);
  };

  const saveEditedClass = async () => {
    if (!editingClass) return;
    if (!editName.trim()) return alert("Please enter a class name.");
    if (!editSubject.trim()) return alert("Please enter a subject.");
    if (!editBatchIds.length) return alert("Select at least one batch.");
    if (!editHostUids.length) return alert("Assign at least one host.");

    setUpdating(true);
    try {
      const cleanCoHosts = editCoHostUids.filter((id) => !editHostUids.includes(id));
      await updateLiveClass(editingClass.id, {
        name: editName.trim(),
        subject: editSubject.trim(),
        batchIds: editBatchIds,
        batchId: editBatchIds[0] || "",
        hostUids: editHostUids,
        coHostUids: cleanCoHosts,
        liveTestId: editExamId === "none" ? undefined : editExamId,
      });
      setEditOpen(false);
      setEditingClass(null);
    } catch (e) {
      console.error(e);
      alert("Could not update the class details.");
    } finally {
      setUpdating(false);
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
    const url = `${window.location.origin}/student/live-classes/${cls.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(cls.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleWatchPreview = async (cls: LiveClass) => {
    setPreviewTitle(cls.name);
    setLoadingPreview(true);
    setPreviewOpen(true);
    setPreviewUrl("");
    if (cls.recordingDownloadUrl) {
      setPreviewUrl(cls.recordingDownloadUrl);
      setLoadingPreview(false);
      return;
    }
    try {
      const { url } = await requestRecordingPlaybackUrl(cls.id);
      if (url) {
        setPreviewUrl(url);
      } else {
        alert("Recording preview URL could not be generated.");
        setPreviewOpen(false);
      }
    } catch (e: any) {
      alert("Could not retrieve playback URL: " + (e?.message || e));
      setPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const triggerInstantDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      let downloadUrl = url;
      if (downloadUrl.includes("firebasestorage.googleapis.com")) {
        const dispositionParam = `response-content-disposition=attachment%3B%20filename%3D"${encodeURIComponent(filename)}"`;
        if (!downloadUrl.includes("response-content-disposition")) {
          const sep = downloadUrl.includes("?") ? "&" : "?";
          downloadUrl += `${sep}${dispositionParam}`;
        }
      }

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch { }
      }, 2000);
    }
  };

  const handleDownloadRecording = async (cls: LiveClass) => {
    setDownloadingId(cls.id);
    const safeName = (cls.name || "recording").replace(/[^a-z0-9_-]/gi, "_");
    const filename = `${safeName}_recording.webm`;

    try {
      if (cls.recordingDownloadUrl) {
        triggerInstantDownload(cls.recordingDownloadUrl, filename);
        return;
      }

      let downloadUrl = "";
      try {
        const { url } = await requestRecordingPlaybackUrl(cls.id);
        if (url) downloadUrl = url;
      } catch (e) {
        console.warn("requestRecordingPlaybackUrl failed, checking Firebase Storage fallback", e);
      }

      if (!downloadUrl && cls.recordingKey) {
        try {
          const sRef = storageRef(storage, cls.recordingKey);
          downloadUrl = await getDownloadURL(sRef);
        } catch (e) {
          console.warn("Firebase Storage getDownloadURL failed", e);
        }
      }

      if (downloadUrl) {
        triggerInstantDownload(downloadUrl, filename);
      } else {
        alert("Recording download link could not be generated for this class.");
      }
    } catch (e: any) {
      console.error("Download error", e);
      alert("Could not retrieve download link: " + (e?.message || e));
    } finally {
      setTimeout(() => setDownloadingId(null), 600);
    }
  };

  const handleDeleteRecording = async (cls: LiveClass) => {
    if (!confirm(`Are you sure you want to delete the recording for "${cls.name}"?`)) return;
    try {
      await updateLiveClass(cls.id, {
        recordingStatus: deleteField() as any,
        recordingKey: deleteField() as any,
        recordingDownloadUrl: deleteField() as any,
        recordingDurationSec: deleteField() as any,
        recordingSizeBytes: deleteField() as any,
      });
    } catch (err: any) {
      console.error("Failed to delete recording", err);
      alert("Could not delete recording: " + (err?.message || err));
    }
  };

  const exportAttendanceExcel = () => {
    if (!selectedAttendanceClassId || safeAttendanceRecords.length === 0) {
      alert("No attendance data to export.");
      return;
    }
    const targetClass = safeClasses.find((c) => c.id === selectedAttendanceClassId);
    const exportData = safeAttendanceRecords.map((att, idx) => {
      const joinedIso = att.firstJoinedAt || att.lastJoinedAt || att.currentSessionJoinedAt || (att.sessions && att.sessions[0]?.joinedAt);
      return {
        "S.No": idx + 1,
        "Student ID": att.studentId || att.studentUid || att.studentRecordId || "N/A",
        "Student Name": att.name || "Student",
        Email: att.email || "N/A",
        "Joined Time": joinedIso ? new Date(joinedIso).toLocaleString("en-IN") : "N/A",
        "Total Minutes": Math.round((att.totalDurationSec || 0) / 60),
        Status: att.attended !== false ? "Present" : "Absent",
      };
    });

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
      if (!testId || testId === "none") {
        await updateLiveClass(classId, {
          liveTestId: deleteField() as any,
          liveTestStartedAt: deleteField() as any,
          liveTestActive: deleteField() as any,
        });
        alert("Live test unlinked.");
      } else {
        await updateLiveClass(classId, {
          liveTestId: testId,
          liveTestStartedAt: new Date().toISOString(),
          liveTestActive: true,
        });
        alert("Live test assigned to ongoing class!");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update live test.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      {/* TAB 1: OVERVIEW */}
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
                    Live Video Classes & Conferencing Suite
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
            <button
              type="button"
              onClick={() => {
                setListFilter("live");
                handleTabChange("meetings");
              }}
              className="text-left rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-800">Active Live</span>
                <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{liveClassesList.length}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setListFilter("scheduled");
                handleTabChange("meetings");
              }}
              className="text-left rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-amber-300 hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-800">Scheduled</span>
                <Calendar className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{scheduledClassesList.length}</p>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("recordings")}
              className="text-left rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-indigo-300 hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-800">R2 Recordings</span>
                <PlayCircle className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{readyRecordingsList.length}</p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/co-hosts")}
              className="text-left rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-purple-300 hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-800">Co-Hosts</span>
                <Shield className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{coHostCount}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setListFilter("all");
                handleTabChange("meetings");
              }}
              className="text-left rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs col-span-2 sm:col-span-1 transition-all hover:border-blue-300 hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-800">Total Classes</span>
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{safeClasses.length}</p>
            </button>
          </div>

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
        </>
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
                {/* Search Bar */}
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search class..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-8 text-xs bg-white border-slate-200"
                  />
                </div>

                {/* Filter Tabs */}
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
                              className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-100"
                              onClick={() => openEditModal(cls)}
                              title="Edit Meeting Details"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                              onClick={() => void remove(cls.id)}
                              title="Delete Meeting"
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

      {/* TAB 4: RECORDINGS & DOWNLOADS */}
      {activeTab === "recordings" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Recording Module & Cloud Downloads
                </CardTitle>
                <CardDescription className="text-xs">
                  Subject-wise recording storage in Cloudflare R2 with in-page playback and presigned download link generator.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-40">
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {readyRecordingsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No completed recordings found yet. Recordings uploaded by hosts after live classes will appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-xs">
                      <TableHead className="font-bold">Class Name</TableHead>
                      <TableHead className="font-bold">Subject</TableHead>
                      <TableHead className="font-bold">Batch & Target</TableHead>
                      <TableHead className="font-bold">Storage Key</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyRecordingsList
                      .filter((cls) => subjectFilter === "all" || cls.subject === subjectFilter)
                      .map((cls) => (
                        <TableRow key={cls.id} className="hover:bg-slate-50/60 text-xs">
                          <TableCell className="font-bold text-slate-900">{cls.name}</TableCell>
                          <TableCell className="text-indigo-600 font-bold">{cls.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-indigo-50/80 text-indigo-700 border-indigo-200 text-[10px] font-semibold">
                              {formatLiveClassBatchLabel(cls, safeBatches)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-mono">
                            {cls.recordingKey || "kasc-live-class-recordings"}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-600 text-[10px]">Ready</Badge>
                          </TableCell>
                          <TableCell className="space-x-1.5 whitespace-nowrap text-right">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80 mr-2 shadow-2xs">
                              <span className="text-indigo-600 font-bold">Subject: {cls.subject}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-700 font-medium">Batch: {formatLiveClassBatchLabel(cls, safeBatches)}</span>
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] font-medium"
                              onClick={() => void handleWatchPreview(cls)}
                            >
                              <PlayCircle className="mr-1 h-3 w-3 text-indigo-600" /> Preview Video
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-[11px] bg-indigo-600 hover:bg-indigo-700 font-medium"
                              disabled={downloadingId === cls.id}
                              onClick={() => void handleDownloadRecording(cls)}
                            >
                              {downloadingId === cls.id ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Downloading…
                                </>
                              ) : (
                                <>
                                  <Download className="mr-1 h-3 w-3" /> Download
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-medium"
                              onClick={() => void handleDeleteRecording(cls)}
                              title="Delete recording entry"
                            >
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
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
        <div className="space-y-4">
          {/* Attendance Executive Summary KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Attended Students</span>
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{attendanceMetrics.totalPresent}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Average Watch Duration</span>
                <Clock className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{attendanceMetrics.avgDuration} mins</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Minutes Streamed</span>
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900">{attendanceMetrics.totalDurationMins} mins</p>
            </div>
          </div>

          <Card className="border-slate-200/80 bg-white">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Attendance Tracking & Excel Exporter
                  </CardTitle>
                  <CardDescription className="text-xs">
                    View real-time join logs and export official attendance spreadsheets per class session.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-40">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search student..."
                      value={searchAttendance}
                      onChange={(e) => setSearchAttendance(e.target.value)}
                      className="h-7 pl-8 text-xs bg-white border-slate-200"
                    />
                  </div>

                  <Select value={selectedAttendanceClassId} onValueChange={setSelectedAttendanceClassId}>
                    <SelectTrigger className="w-52 h-7 text-xs bg-white">
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
            <CardContent className="pt-4">
              {loadingAttendance ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading attendance records…</div>
              ) : filteredAttendanceRecords.length === 0 ? (
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
                      {filteredAttendanceRecords.map((att) => {
                        const joinedIso = att.firstJoinedAt || att.lastJoinedAt || att.currentSessionJoinedAt || (att.sessions && att.sessions[0]?.joinedAt);
                        const joinedFormatted = joinedIso
                          ? new Date(joinedIso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                          : "N/A";
                        return (
                          <TableRow key={att.id || att.studentRecordId || att.studentUid || att.uid} className="hover:bg-slate-50/60 text-xs">
                            <TableCell className="font-bold text-slate-900">{att.name || "Student"}</TableCell>
                            <TableCell className="text-slate-600">
                              <div>{att.email || "N/A"}</div>
                              {att.studentId ? (
                                <span className="text-[10px] text-slate-400 font-mono">{att.studentId}</span>
                              ) : att.studentUid ? (
                                <span className="text-[10px] text-slate-400 font-mono">{att.studentUid}</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {joinedFormatted}
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: LIVE TEST MODULE */}
      {activeTab === "live_tests" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl border border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-rose-400 animate-pulse" />
                <h3 className="text-lg font-bold">Live Exam Conductor & Proctoring Center</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Conduct CBT exams during ongoing video classes or launch full multi-student video proctoring with live tab-switch detection and broadcast controls.
              </p>
            </div>
            <Button
              className="bg-rose-600 hover:bg-rose-500 font-bold text-xs shadow-lg shrink-0 h-10 px-5"
              onClick={() => navigate("/admin/live-tests")}
            >
              <Zap className="mr-2 h-4 w-4 fill-current" />
              Open Live Test Control Center
            </Button>
          </div>

          <Card className="border-slate-200/80 bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-slate-900">
                Attach Live Exam to Meeting Session
              </CardTitle>
              <CardDescription className="text-xs">
                Select a published CBT test to link directly with a video class. Students will automatically receive a join prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-xs">
                      <TableHead className="font-bold">Live Meeting</TableHead>
                      <TableHead className="font-bold">Subject</TableHead>
                      <TableHead className="font-bold">Date & Time</TableHead>
                      <TableHead className="font-bold">Assigned Exam</TableHead>
                      <TableHead className="font-bold">View Details</TableHead>
                      <TableHead className="text-right font-bold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeClasses.map((cls) => {
                      const currentTest = safeExams.find((e) => e.id === cls.liveTestId);
                      return (
                        <TableRow key={cls.id} className="text-xs hover:bg-slate-50/60">
                          <TableCell className="font-bold text-slate-900">{cls.name}</TableCell>
                          <TableCell className="text-indigo-600 font-semibold">{cls.subject}</TableCell>
                          <TableCell className="text-slate-600 font-medium whitespace-nowrap">
                            {formatClassDateTime(cls)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={cls.liveTestId || "none"}
                              onValueChange={(val) =>
                                assignLiveTestToClass(cls.id, val === "none" ? "" : val)
                              }
                            >
                              <SelectTrigger className="w-52 h-7 text-xs bg-white border-slate-200">
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
                          <TableCell className="whitespace-nowrap">
                            {currentTest ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] text-indigo-600 hover:bg-indigo-50 border-indigo-200 font-semibold shadow-xs"
                                onClick={() => openExamDetailsModal(currentTest)}
                              >
                                <Info className="h-3 w-3 mr-1" /> View Details
                              </Button>
                            ) : safeExams.length > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] text-indigo-600 hover:bg-indigo-50 border-indigo-200 font-semibold shadow-xs"
                                onClick={() => openExamDetailsModal(safeExams[0])}
                              >
                                <Info className="h-3 w-3 mr-1" /> View Details
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400">No test data</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {currentTest ? (
                              <Badge className="bg-rose-600 text-[10px] font-bold">Test Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50 border-slate-200">
                                Ready
                              </Badge>
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
        </div>
      )}

      {/* TAB 7: SETTINGS */}
      {activeTab === "settings" && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Platform Security & Video Conferencing Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure default WebRTC audio/video settings, student interaction controls, and Cloudflare SFU/R2 settings.
                </CardDescription>
              </div>

              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs h-8"
                onClick={saveSettings}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {settingsSavedToast ? "Settings Saved!" : "Save Settings"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-4 text-xs">
            {/* Audio & Video Defaults */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                1. Media & Join Defaults
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <div>
                    <h4 className="font-bold text-slate-900">Default Student Mic State on Join</h4>
                    <p className="text-[11px] text-slate-500">Mute student microphones automatically upon room entry.</p>
                  </div>
                  <Select value={defaultMicMode} onValueChange={(val: any) => setDefaultMicMode(val)}>
                    <SelectTrigger className="w-28 h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="muted">Muted</SelectItem>
                      <SelectItem value="unmuted">Unmuted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <div>
                    <h4 className="font-bold text-slate-900">Default Student Camera State</h4>
                    <p className="text-[11px] text-slate-500">Camera state when student joins live video session.</p>
                  </div>
                  <Select value={defaultCamMode} onValueChange={(val: any) => setDefaultCamMode(val)}>
                    <SelectTrigger className="w-28 h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Security & Access Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                2. Security & Session Rules
              </h3>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <h4 className="font-bold text-slate-900">One-Device Session Lock</h4>
                  <p className="text-[11px] text-slate-500">
                    Enforces single active device per student session via Auth Context lock.
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-[10px]">Active & Enforced</Badge>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <h4 className="font-bold text-slate-900">Student Doubts & Q&A Panel</h4>
                  <p className="text-[11px] text-slate-500">
                    Allows enrolled students to submit private doubts visible only to Host and Co-Hosts.
                  </p>
                </div>
                <Switch
                  checked={doubtsPanelEnabled}
                  onCheckedChange={setDoubtsPanelEnabled}
                />
              </div>
            </div>

            {/* Cloudflare Infrastructure Health */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                3. Cloud Infrastructure Connections
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <h4 className="font-bold text-slate-900">Cloudflare Realtime SFU & TURN Relay</h4>
                    <p className="text-[11px] text-slate-500">
                      High-scale WebRTC media relay for low-latency video calls across Tamil Nadu networks.
                    </p>
                  </div>
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">
                    Connected
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <h4 className="font-bold text-slate-900">Cloudflare R2 Object Storage</h4>
                    <p className="text-[11px] text-slate-500">
                      Asia-Pacific recording storage bucket (`kasc-live-class-recordings`).
                    </p>
                  </div>
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[10px]">
                    Active
                  </Badge>
                </div>
              </div>
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
                  <SelectTrigger className="h-8 text-xs bg-white">
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

      {/* Edit Meeting Link Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Meeting Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label>Class / Session Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <ExamBatchAssignmentFields
              batches={safeBatches.map((b) => ({ id: b.id, name: b.name }))}
              mode={editBatchMode}
              batchIds={editBatchIds}
              onModeChange={setEditBatchMode}
              onBatchIdsChange={(ids) => {
                setEditBatchIds(ids);
                setEditBatchMode(inferExamBatchMode(ids));
              }}
              hint="Selected batch(es) allowed to join this meeting."
            />

            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label>Assigned Host(s)</Label>
              <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-xs">
                {safeAdmins.map((a) => (
                  <label key={a.uid} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={editHostUids.includes(a.uid)}
                      onCheckedChange={(v) => {
                        if (v === true) {
                          setEditHostUids((prev) => [...new Set([...prev, a.uid])]);
                          setEditCoHostUids((prev) => prev.filter((id) => id !== a.uid));
                        } else {
                          setEditHostUids((prev) => prev.filter((id) => id !== a.uid));
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
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
              onClick={() => void saveEditedClass()}
              disabled={updating}
            >
              {updating ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Recording In-Page Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-indigo-600" />
              Recording Preview: {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {loadingPreview ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                Generating presigned Cloudflare R2 video stream link…
              </div>
            ) : previewUrl ? (
              <div className="overflow-hidden rounded-xl bg-black border border-slate-800 aspect-video flex items-center justify-center">
                <video src={previewUrl} controls autoPlay className="w-full h-full max-h-[480px]" />
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Failed to load video stream.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {previewUrl ? (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 font-medium"
                onClick={() => {
                  const safeName = (previewTitle || "recording").replace(/[^a-z0-9_-]/gi, "_");
                  triggerInstantDownload(previewUrl, `${safeName}_recording.webm`);
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download Video File
              </Button>
            ) : <div />}
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exam / Test Details Dialog */}
      <Dialog open={examDetailsOpen} onOpenChange={setExamDetailsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Live Exam Overview: {selectedExamForModal?.title || "Test Details"}
            </DialogTitle>
          </DialogHeader>

          {selectedExamForModal ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Subject</p>
                  <p className="text-indigo-600 font-bold mt-0.5">{selectedExamForModal.subject || "General"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Status</p>
                  <p className="text-slate-900 font-bold mt-0.5 capitalize">{selectedExamForModal.status || "Published"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Duration</p>
                  <p className="text-slate-900 font-bold mt-0.5">{selectedExamForModal.durationMinutes || 30} Minutes</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Total Questions</p>
                  <p className="text-slate-900 font-bold mt-0.5">{selectedExamForModal.totalQuestions || 0} Questions</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Total Marks</p>
                  <p className="text-slate-900 font-bold mt-0.5">{selectedExamForModal.totalMarks || 0} Marks</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Negative Marking</p>
                  <p className="text-slate-900 font-bold mt-0.5">
                    {selectedExamForModal.negativeMarkPerWrong ? `-${selectedExamForModal.negativeMarkPerWrong} per wrong` : "None"}
                  </p>
                </div>
              </div>

              {selectedExamForModal.startAt || selectedExamForModal.endAt ? (
                <div className="rounded-xl bg-indigo-50/60 p-3 border border-indigo-100 text-xs space-y-1">
                  <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-600" /> Schedule Window
                  </p>
                  <p className="text-indigo-800">
                    <strong>Starts:</strong> {selectedExamForModal.startAt ? new Date(selectedExamForModal.startAt).toLocaleString("en-IN") : "Instant / Live"}
                  </p>
                  <p className="text-indigo-800">
                    <strong>Ends:</strong> {selectedExamForModal.endAt ? new Date(selectedExamForModal.endAt).toLocaleString("en-IN") : "Open ended"}
                  </p>
                </div>
              ) : null}

              {selectedExamForModal.instructions ? (
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-xs">
                  <p className="font-bold text-slate-900 mb-1">Instructions</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedExamForModal.instructions}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-500 font-bold text-xs"
              onClick={() => {
                setExamDetailsOpen(false);
                navigate("/admin/live-tests");
              }}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" /> Open Live Control Center
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExamDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
