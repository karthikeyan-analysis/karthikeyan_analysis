import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { cn } from "../../components/ui/utils";
import StudentAvatar from "../../components/StudentAvatar";
import { listExamTestsForAdmin } from "../../features/exams/examApi";
import type { ExamTest } from "../../features/exams/types";
import { examIncludesBatch, formatExamBatchLabel } from "../../features/exams/examBatchUtils";
import {
  createLiveTestSession,
  endLiveTestSession,
  forceSubmitStudentAttempt,
  sendLiveTestAnnouncement,
  sendStudentWarningMessage,
  subscribeAllActiveLiveTestSessions,
  subscribeToLiveTestPresence,
  subscribeToLiveTestSession,
} from "../../features/liveTests/liveTestApi";
import { useLiveTestPresence } from "../../features/liveTests/useLiveTestPresence";
import type { LiveTestPresence, LiveTestSession } from "../../features/liveTests/liveTestTypes";
import ParticipantVideoTile from "../../components/liveClasses/ParticipantVideoTile";
import {
  Activity,
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe,
  Loader2,
  Megaphone,
  Mic,
  MicOff,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

export default function ConductLiveTest() {
  const { user } = useAuth();
  const { batches, students } = useData();
  const navigate = useNavigate();

  const [tests, setTests] = useState<ExamTest[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [searchTest, setSearchTest] = useState("");
  const [selectedTest, setSelectedTest] = useState<ExamTest | null>(null);

  // Configuration options
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [enableStudentCamera, setEnableStudentCamera] = useState(true);
  const [enableAdminVideo, setEnableAdminVideo] = useState(true);
  const [maxTabSwitchWarnings, setMaxTabSwitchWarnings] = useState(3);
  const [autoSubmitOnViolationLimit, setAutoSubmitOnViolationLimit] = useState(false);
  const [customDurationMinutes, setCustomDurationMinutes] = useState<number | "">("");

  // Active Sessions State
  const [activeSessions, setActiveSessions] = useState<LiveTestSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<LiveTestSession | null>(null);
  const [presenceList, setPresenceList] = useState<LiveTestPresence[]>([]);

  // Announcement state
  const [announcementText, setAnnouncementText] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // Warning Modal State
  const [warningStudent, setWarningStudent] = useState<LiveTestPresence | null>(null);
  const [warningMsg, setWarningMsg] = useState("");

  const [launching, setLaunching] = useState(false);
  const [activeTab, setActiveTab] = useState<"setup" | "room">("setup");

  // Load published premade tests
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTests(true);
      try {
        const list = await listExamTestsForAdmin();
        const published = list.filter((t) => t.status === "published");
        if (!cancelled) setTests(published);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingTests(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to active live test sessions
  useEffect(() => {
    const unsub = subscribeAllActiveLiveTestSessions((sessions) => {
      setActiveSessions(sessions);
      if (sessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessions[0]!.id);
        setActiveTab("room");
      }
    });
    return unsub;
  }, [selectedSessionId]);

  // Subscribe to currently selected session
  useEffect(() => {
    if (!selectedSessionId) {
      setCurrentSession(null);
      return;
    }
    const unsub = subscribeToLiveTestSession(selectedSessionId, (session) => {
      setCurrentSession(session);
    });
    return unsub;
  }, [selectedSessionId]);

  // Subscribe to live test presence roster for current session
  useEffect(() => {
    if (!selectedSessionId) {
      setPresenceList([]);
      return;
    }
    const unsub = subscribeToLiveTestPresence(selectedSessionId, (list) => {
      setPresenceList(list);
    });
    return unsub;
  }, [selectedSessionId]);

  // Hook into WebRTC for Admin in the active session
  const adminUid = user?.id || "admin";
  const adminName = user?.name || "Admin Proctor";
  const { partyTracks, camera, mic } = useLiveTestPresence({
    sessionId: selectedSessionId || "",
    uid: adminUid,
    name: adminName,
    role: "admin",
  });

  const [isAdminMicOn, setIsAdminMicOn] = useState(true);
  const [isAdminCamOn, setIsAdminCamOn] = useState(true);

  // Wire admin's local camera stream into the <video> element
  const adminVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const sub = camera.broadcastTrack$.subscribe((track) => {
      const el = adminVideoRef.current;
      if (!el) return;
      if (track) {
        const ms = new MediaStream();
        ms.addTrack(track);
        el.srcObject = ms;
      } else {
        el.srcObject = null;
      }
    });
    return () => sub.unsubscribe();
  }, [camera.broadcastTrack$]);

  // Toggle mic/camera sources
  const handleToggleMic = () => {
    if (isAdminMicOn) { mic.disableSource(); } else { mic.enableSource(); mic.startBroadcasting(); }
    setIsAdminMicOn(!isAdminMicOn);
  };
  const handleToggleCam = () => {
    if (isAdminCamOn) { camera.disableSource(); } else { camera.enableSource(); camera.startBroadcasting(); }
    setIsAdminCamOn(!isAdminCamOn);
  };

  const [selectedBatchTab, setSelectedBatchTab] = useState<string>("all");

  const filteredTests = useMemo(() => {
    let list = tests;

    // Filter by Batch Tab
    if (selectedBatchTab !== "all") {
      if (selectedBatchTab === "__common__") {
        list = list.filter((t) => !t.batchId && (!t.batchIds || t.batchIds.length === 0));
      } else {
        list = list.filter((t) => {
          const bIds = t.batchIds?.length ? t.batchIds : t.batchId ? [t.batchId] : [];
          return bIds.includes(selectedBatchTab);
        });
      }
    }

    // Filter by Search Query
    const q = searchTest.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [tests, selectedBatchTab, searchTest]);

  const handleSelectTest = (test: ExamTest) => {
    setSelectedTest(test);
    const ids = test.batchIds?.length ? test.batchIds : test.batchId ? [test.batchId] : [];
    setSelectedBatchIds(ids);
    setCustomDurationMinutes(test.durationMinutes);
  };

  const toggleBatch = (bId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId],
    );
  };

  const handleLaunch = async () => {
    if (!selectedTest) return;
    setLaunching(true);
    try {
      const duration =
        typeof customDurationMinutes === "number" && customDurationMinutes > 0
          ? customDurationMinutes
          : selectedTest.durationMinutes;

      const newSessionId = await createLiveTestSession({
        testId: selectedTest.id,
        testTitle: selectedTest.title,
        subject: selectedTest.subject,
        batchId: selectedBatchIds[0] || "",
        batchIds: selectedBatchIds,
        durationMinutes: duration,
        adminUid,
        adminName,
        proctoringSettings: {
          enableStudentCamera,
          enableAdminVideo,
          maxTabSwitchWarnings,
          autoSubmitOnViolationLimit,
          lockFullScreen: false,
        },
      });

      setSelectedSessionId(newSessionId);
      setActiveTab("room");
    } catch (err) {
      console.error("Failed to launch live test session", err);
      alert("Error launching live test session. Please try again.");
    } finally {
      setLaunching(false);
    }
  };

  const handleEndSession = async () => {
    if (!selectedSessionId) return;
    if (!confirm("Are you sure you want to end this Live Test session for all students?")) return;

    try {
      await endLiveTestSession(selectedSessionId);
      setSelectedSessionId(null);
      setActiveTab("setup");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!selectedSessionId || !announcementText.trim()) return;
    setSendingAnnouncement(true);
    try {
      await sendLiveTestAnnouncement(selectedSessionId, announcementText.trim());
      setAnnouncementText("");
    } catch (err) {
      console.error(err);
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleSendWarning = async () => {
    if (!selectedSessionId || !warningStudent || !warningMsg.trim()) return;
    try {
      await sendStudentWarningMessage(selectedSessionId, warningStudent.uid, warningMsg.trim());
      setWarningStudent(null);
      setWarningMsg("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceSubmit = async (p: LiveTestPresence) => {
    if (!selectedSessionId) return;
    if (!confirm(`Force submit ${p.name}'s test attempt immediately?`)) return;
    try {
      await forceSubmitStudentAttempt(selectedSessionId, p.uid);
    } catch (err) {
      console.error(err);
    }
  };

  const studentPresenceList = useMemo(
    () => presenceList.filter((p) => p.role === "student"),
    [presenceList],
  );

  const totalTabViolations = useMemo(
    () => studentPresenceList.reduce((acc, p) => acc + (p.tabSwitchCount || 0), 0),
    [studentPresenceList],
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-emerald-400 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">Live Test Control Center</h1>
          </div>
          <p className="text-sm text-slate-300">
            Conduct live exams with multi-student camera proctoring, broadcast controls, and real-time monitoring.
          </p>
        </div>

        {activeSessions.length > 0 ? (
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 px-3 py-1 text-xs font-semibold">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              {activeSessions.length} Active Session{activeSessions.length > 1 ? "s" : ""}
            </Badge>
            {selectedSessionId && (
              <Button
                variant="destructive"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 shadow-md"
                onClick={() => void handleEndSession()}
              >
                <StopCircle className="mr-1.5 h-4 w-4" />
                End Session
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "setup" | "room")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 p-1">
          <TabsTrigger value="setup" className="font-semibold">
            1. Select & Configure Test
          </TabsTrigger>

          <TabsTrigger
            value="room"
            className="font-semibold relative"
            disabled={!selectedSessionId && activeSessions.length === 0}
          >
            2. Live Proctoring Grid
            {studentPresenceList.length > 0 && (
              <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white">
                {studentPresenceList.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SETUP & LAUNCH */}
        <TabsContent value="setup" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Premade Tests Picker */}
            <Card className="lg:col-span-6 border-slate-200 shadow-md flex flex-col">
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    Select Premade Test
                  </span>
                  <Badge variant="outline" className="text-slate-700 bg-slate-50 font-bold px-2.5 py-0.5">
                    {filteredTests.length} Tests Available
                  </Badge>
                </div>

                {/* BATCH SELECTION TABS */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span>Select Batch Filter</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      {selectedBatchTab === "all" ? "Showing all batches" : "Filtered by batch"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBatchTab("all")}
                      className={cn(
                        "rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150 flex items-center gap-1",
                        selectedBatchTab === "all"
                          ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80",
                      )}
                    >
                      <span>All Batches</span>
                      <span className={cn(
                        "rounded-md px-1.5 py-0.2 text-[10px]",
                        selectedBatchTab === "all" ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700",
                      )}>
                        {tests.length}
                      </span>
                    </button>

                    {batches.map((b) => {
                      const count = tests.filter((t) => {
                        const bIds = t.batchIds?.length ? t.batchIds : t.batchId ? [t.batchId] : [];
                        return bIds.includes(b.id);
                      }).length;
                      if (count === 0) return null;
                      const isSelected = selectedBatchTab === b.id;

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBatchTab(b.id)}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150 flex items-center gap-1.5",
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80",
                          )}
                        >
                          <span>{b.name}</span>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.2 text-[10px]",
                              isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-700",
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative pt-0.5">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search test by title or keyword..."
                    value={searchTest}
                    onChange={(e) => setSearchTest(e.target.value)}
                    className="pl-9 text-sm bg-slate-50/50 border-slate-200 h-9"
                  />
                  {searchTest && (
                    <button
                      type="button"
                      onClick={() => setSearchTest("")}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="px-4 pb-4 pt-0 flex-1">
                {loadingTests ? (
                  <div className="flex h-48 items-center justify-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading published tests...
                  </div>
                ) : filteredTests.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No published tests found matching your selected batch or search query.
                  </p>
                ) : (
                  <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                    {filteredTests.map((t) => {
                      const isSelected = selectedTest?.id === t.id;
                      const testBatches = formatExamBatchLabel(t, batches);
                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTest(t)}
                          className={cn(
                            "cursor-pointer rounded-xl border p-4 transition-all duration-200",
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-slate-900">{t.title}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 font-medium">
                                  {t.subject}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-medium">
                                  {testBatches}
                                </Badge>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              {t.durationMinutes} mins
                            </span>
                            <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded">
                              <Users className="h-3.5 w-3.5 text-slate-500" />
                              {t.totalQuestions} Questions
                            </span>
                            <span className="font-medium bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                              {t.totalMarks} Marks
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Right: Configure & Launch Form */}
            <Card className="lg:col-span-6 border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Configure Live Test Session
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                {!selectedTest ? (
                  <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                    <Radio className="h-10 w-10 text-slate-400 mb-2" />
                    <p className="font-medium text-slate-700">No Test Selected</p>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Choose a premade test from the list on the left to configure live proctoring settings.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Selected Summary Card */}
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Selected Exam</p>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedTest.title}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">{selectedTest.subject} • {selectedTest.totalQuestions} Questions</p>
                    </div>

                    {/* Batch Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Target Batches</Label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {batches.map((b) => {
                          const checked = selectedBatchIds.includes(b.id);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => toggleBatch(b.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                                checked
                                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                              )}
                            >
                              {b.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Proctoring Settings */}
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <Label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Live Video Proctoring Options
                      </Label>

                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={enableStudentCamera}
                            onCheckedChange={(c) => setEnableStudentCamera(Boolean(c))}
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-800">Mandatory Student Webcam Proctoring</p>
                            <p className="text-xs text-slate-500">Student camera feeds are streamed live to Admin monitor grid.</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={enableAdminVideo}
                            onCheckedChange={(c) => setEnableAdminVideo(Boolean(c))}
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-800">Admin Broadcast Video & Audio</p>
                            <p className="text-xs text-slate-500">Students can view Admin video stream and hear proctor announcements.</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={autoSubmitOnViolationLimit}
                            onCheckedChange={(c) => setAutoSubmitOnViolationLimit(Boolean(c))}
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-800">Auto-Submit Test on Excessive Tab Switching</p>
                            <p className="text-xs text-slate-500">Automatically submit attempt when warning threshold is reached.</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Launch Button */}
                    <Button
                      onClick={() => void handleLaunch()}
                      disabled={launching || selectedBatchIds.length === 0}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-semibold h-11 shadow-lg"
                    >
                      {launching ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Initializing Live Test Session...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-5 w-5 fill-current" />
                          Launch Live Test Session Now
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: ACTIVE PROCTORING ROOM */}
        <TabsContent value="room" className="mt-6 space-y-6">
          {activeSessions.length > 1 && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-2 text-xs">
              <span className="font-semibold text-slate-600">Select Active Session:</span>
              {activeSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={cn(
                    "rounded-lg px-3 py-1 font-medium transition-all",
                    selectedSessionId === s.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {s.testTitle}
                </button>
              ))}
            </div>
          )}

          {currentSession ? (
            <div className="space-y-6">
              {/* Live Session KPIs */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="pt-4 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Live Session</p>
                      <p className="text-lg font-bold text-slate-900 truncate max-w-[180px]">
                        {currentSession.testTitle}
                      </p>
                    </div>
                    <Radio className="h-7 w-7 text-emerald-500 animate-pulse shrink-0" />
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="pt-4 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Students Joined</p>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {studentPresenceList.length}
                      </p>
                    </div>
                    <Users className="h-7 w-7 text-indigo-500 shrink-0" />
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="pt-4 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Tab Violations</p>
                      <p className="text-2xl font-bold text-rose-600 tabular-nums">
                        {totalTabViolations}
                      </p>
                    </div>
                    <AlertTriangle className="h-7 w-7 text-rose-500 shrink-0" />
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="pt-4 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Duration</p>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {currentSession.durationMinutes} mins
                      </p>
                    </div>
                    <Clock className="h-7 w-7 text-amber-500 shrink-0" />
                  </CardContent>
                </Card>
              </div>

              {/* Admin Broadcast Tile & Announcement Sender */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Admin Video Tile */}
                <Card className="lg:col-span-5 border-slate-200 shadow-sm bg-slate-900 text-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
                      <span className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-emerald-400" />
                        Admin Proctor Camera & Mic Feed
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                        BROADCASTING LIVE
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800">
                      {/* Real camera feed */}
                      <video
                        ref={adminVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={cn(
                          "h-full w-full object-cover transition-opacity duration-300",
                          isAdminCamOn ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {/* Fallback placeholder when cam is off */}
                      {!isAdminCamOn && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-slate-400">
                            <VideoOff className="h-6 w-6" />
                          </div>
                          <p className="text-xs text-slate-400">Camera Off</p>
                        </div>
                      )}
                      {/* Name overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                        <span className="text-xs font-medium text-white">{adminName} (Proctor)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={isAdminMicOn ? "default" : "outline"}
                        className={isAdminMicOn ? "bg-indigo-600 hover:bg-indigo-700" : "text-slate-300"}
                        onClick={handleToggleMic}
                      >
                        {isAdminMicOn ? <Mic className="mr-1.5 h-4 w-4" /> : <MicOff className="mr-1.5 h-4 w-4" />}
                        {isAdminMicOn ? "Mic On" : "Muted"}
                      </Button>

                      <Button
                        size="sm"
                        variant={isAdminCamOn ? "default" : "outline"}
                        className={isAdminCamOn ? "bg-indigo-600 hover:bg-indigo-700" : "text-slate-300"}
                        onClick={handleToggleCam}
                      >
                        {isAdminCamOn ? <Camera className="mr-1.5 h-4 w-4" /> : <CameraOff className="mr-1.5 h-4 w-4" />}
                        {isAdminCamOn ? "Camera On" : "Cam Off"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Announcement Broadcast */}
                <Card className="lg:col-span-7 border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-indigo-600" />
                      Broadcast Live Announcement to All Students
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type announcement (e.g. '10 minutes remaining! Check Section B')..."
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSendAnnouncement();
                        }}
                        className="text-sm"
                      />
                      <Button
                        onClick={() => void handleSendAnnouncement()}
                        disabled={sendingAnnouncement || !announcementText.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                      >
                        <Send className="mr-1.5 h-4 w-4" />
                        Send
                      </Button>
                    </div>

                    {currentSession.announcement ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                          <Megaphone className="h-3.5 w-3.5" />
                          Last Broadcasted Announcement:
                        </p>
                        <p className="mt-1 font-medium">{currentSession.announcement}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Broadcasted announcements will pop up immediately on every student&apos;s exam window.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* STUDENT MULTI-CAMERA PROCTORING GRID */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Eye className="h-5 w-5 text-indigo-600" />
                    Live Student Proctoring Grid ({studentPresenceList.length} Connected)
                  </h3>
                </div>

                {studentPresenceList.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                    <Users className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">Waiting for Students to Join</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      As soon as students open the live test window, their webcams and exam progress will appear live in this grid.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {studentPresenceList.map((p) => {
                      const isViolation = (p.tabSwitchCount || 0) > 0;
                      return (
                        <div
                          key={p.uid}
                          className={cn(
                            "group relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm transition-all duration-200",
                            isViolation
                              ? "border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/20"
                              : "border-slate-200 hover:border-indigo-300 hover:shadow-md",
                          )}
                        >
                          {/* Student Live Video Tile */}
                          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                            {/* WebRTC Video Stream Placeholder or Live Frame */}
                            <div className="flex flex-col items-center justify-center text-center text-white p-2">
                              <StudentAvatar name={p.name} className="h-10 w-10 text-xs font-bold border border-white/20 mb-1" />
                              <p className="text-xs font-semibold">{p.name}</p>
                              <span className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                Camera Live
                              </span>
                            </div>

                            {/* Status Overlay Badges */}
                            {p.tabSwitchCount > 0 && (
                              <div className="absolute top-2 left-2 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                                ⚠️ {p.tabSwitchCount} Tab Switch{p.tabSwitchCount > 1 ? "es" : ""}
                              </div>
                            )}

                            {p.isSubmitted && (
                              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                                <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-1" />
                                <p className="text-xs font-bold">Exam Submitted</p>
                              </div>
                            )}
                          </div>

                          {/* Student Info & Progress */}
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800 truncate max-w-[120px]">{p.name}</span>
                              <span className="font-medium text-slate-500">
                                Q{p.currentQuestionIndex + 1} / {p.totalQuestions || "?"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Answered: <strong className="text-slate-800">{p.totalAnswered}</strong></span>
                              {p.isSubmitted ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Submitted</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">
                                  In Progress
                                </Badge>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-amber-700 hover:bg-amber-50"
                                onClick={() => {
                                  setWarningStudent(p);
                                  setWarningMsg("Please stay focused on your test screen.");
                                }}
                              >
                                Warn
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-rose-700 hover:bg-rose-50"
                                onClick={() => void handleForceSubmit(p)}
                              >
                                Force Submit
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              No active session selected. Go to tab &quot;1. Select & Configure Test&quot; to launch a live test.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Send Warning Modal */}
      {warningStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Send Direct Warning to {warningStudent.name}
            </h3>
            <Input
              placeholder="Warning message..."
              value={warningMsg}
              onChange={(e) => setWarningMsg(e.target.value)}
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setWarningStudent(null)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => void handleSendWarning()}>
                Send Warning
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
