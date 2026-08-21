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
import { cn } from "../../components/ui/utils";
import StudentAvatar from "../../components/StudentAvatar";
import ParticipantVideoTile from "../../components/liveClasses/ParticipantVideoTile";
import { listExamTestsForAdmin } from "../../features/exams/examApi";
import type { ExamTest } from "../../features/exams/types";
import { formatExamBatchLabel } from "../../features/exams/examBatchUtils";
import {
  createLiveTestSession,
  deleteLiveTestSession,
  endLiveTestSession,
  forceSubmitStudentAttempt,
  scheduleLiveTestSession,
  sendLiveTestAnnouncement,
  sendStudentWarningMessage,
  startScheduledTestNow,
  subscribeAllActiveLiveTestSessions,
  subscribeAllScheduledLiveTestSessions,
  subscribeToLiveTestPresence,
  subscribeToLiveTestSession,
} from "../../features/liveTests/liveTestApi";
import { subscribeToAdmins, type AdminProfile } from "../../features/liveClasses/adminDirectory";
import { useLiveTestPresence } from "../../features/liveTests/useLiveTestPresence";
import type { LiveTestPresence, LiveTestSession } from "../../features/liveTests/liveTestTypes";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  Loader2,
  Megaphone,
  Mic,
  MicOff,
  Play,
  PlayCircle,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Trash2,
  UserPlus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

export default function ConductLiveTest() {
  const { user } = useAuth();
  const { batches } = useData();
  const navigate = useNavigate();

  const [tests, setTests] = useState<ExamTest[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [searchTest, setSearchTest] = useState("");
  const [selectedTest, setSelectedTest] = useState<ExamTest | null>(null);

  // Co-Host & Directory profiles
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [selectedCoHostId, setSelectedCoHostId] = useState<string>("none");

  // Configuration options
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [showBatchToggleTab1, setShowBatchToggleTab1] = useState(false);
  const [showBatchToggleTab3, setShowBatchToggleTab3] = useState(false);
  const [enableStudentCamera, setEnableStudentCamera] = useState(true);
  const [enableAdminVideo, setEnableAdminVideo] = useState(true);
  const [maxTabSwitchWarnings, setMaxTabSwitchWarnings] = useState(3);
  const [autoSubmitOnViolationLimit, setAutoSubmitOnViolationLimit] = useState(false);
  const [customDurationMinutes, setCustomDurationMinutes] = useState<number | "">("");

  // Active & Scheduled Sessions State
  const [activeSessions, setActiveSessions] = useState<LiveTestSession[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<LiveTestSession[]>([]);
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
  const [activeTab, setActiveTab] = useState<"setup" | "room" | "schedule">(() =>
    user?.adminKind === "cohost" ? "room" : "setup",
  );

  // Scheduled Test Form State
  const [scheduleTest, setScheduleTest] = useState<ExamTest | null>(null);
  const [scheduleBatchIds, setScheduleBatchIds] = useState<string[]>([]);
  const [scheduleStartTime, setScheduleStartTime] = useState<string>("");
  const [scheduleEndTime, setScheduleEndTime] = useState<string>("");
  const [scheduling, setScheduling] = useState(false);

  // View Mode for Tab 2: "list" (show list of ongoing tests) vs "detail" (show selected session proctoring room)
  const [viewingSessionMode, setViewingSessionMode] = useState<"list" | "detail">("list");

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

  // Subscribe to admins/co-hosts list
  useEffect(() => {
    return subscribeToAdmins((profiles) => {
      setAdminProfiles(profiles);
    });
  }, []);

  // Compute whether currently logged in user has operating access to currentSession
  const hasOperatingAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin" && user.adminKind !== "cohost") return true;
    if (!currentSession) return true;
    if (currentSession.startedByUid === user.id || currentSession.scheduledByUid === user.id) return true;
    if (currentSession.coHostId && currentSession.coHostId === user.id) return true;
    if (currentSession.coHostEmail && user.email && currentSession.coHostEmail.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
  }, [user, currentSession]);

  // Subscribe to active live test sessions
  useEffect(() => {
    const unsub = subscribeAllActiveLiveTestSessions((sessions) => {
      setActiveSessions(sessions);
    });
    return unsub;
  }, []);

  // Subscribe to scheduled live test sessions
  useEffect(() => {
    const unsub = subscribeAllScheduledLiveTestSessions((sessions) => {
      setScheduledSessions(sessions);
    });
    return unsub;
  }, []);

  // Automatic Lifecycle Scheduler for Scheduled Tests
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();

      // Auto-Start scheduled tests when start time arrives
      scheduledSessions.forEach((s) => {
        if (s.scheduledStartTime) {
          const startMs = new Date(s.scheduledStartTime).getTime();
          if (nowMs >= startMs && s.status === "scheduled") {
            console.log(`Auto-starting scheduled test: ${s.testTitle}`);
            void startScheduledTestNow(s.id, user?.id, user?.name);
          }
        }
      });

      // Auto-End active tests when scheduled end time arrives
      activeSessions.forEach((s) => {
        if (s.scheduledEndTime) {
          const endMs = new Date(s.scheduledEndTime).getTime();
          if (nowMs >= endMs && s.status === "active") {
            console.log(`Auto-ending active test session: ${s.testTitle}`);
            void endLiveTestSession(s.id);
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [scheduledSessions, activeSessions, user]);

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

  // Auto-dismiss session monitor when session ends (e.g. ended by Co-Host or Admin)
  useEffect(() => {
    if (currentSession && currentSession.status === "ended") {
      setSelectedSessionId(null);
      setCurrentSession(null);
      setViewingSessionMode("list");
    }
  }, [currentSession]);

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

  // Hook into WebRTC for Admin / Co-Host in the active session
  const isCohost = user?.adminKind === "cohost";
  const adminUid = user?.id || (isCohost ? "cohost" : "admin");
  const adminName = user?.name || (isCohost ? "Co-Host Proctor" : "Admin Proctor");
  const { partyTracks, camera, mic } = useLiveTestPresence({
    sessionId: selectedSessionId || "",
    uid: adminUid,
    name: adminName,
    role: isCohost ? "cohost" : "admin",
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

      const coHostProfile = adminProfiles.find((p) => p.uid === selectedCoHostId);

      const newSessionId = await createLiveTestSession({
        testId: selectedTest.id,
        testTitle: selectedTest.title,
        subject: selectedTest.subject,
        batchId: selectedBatchIds[0] || "",
        batchIds: selectedBatchIds,
        durationMinutes: duration,
        adminUid,
        adminName,
        coHostId: coHostProfile ? coHostProfile.uid : undefined,
        coHostEmail: coHostProfile ? coHostProfile.email : undefined,
        coHostName: coHostProfile ? coHostProfile.name : undefined,
        proctoringSettings: {
          enableStudentCamera,
          enableAdminVideo,
          maxTabSwitchWarnings,
          autoSubmitOnViolationLimit,
          lockFullScreen: false,
        },
      });

      setSelectedSessionId(newSessionId);
      setViewingSessionMode("detail");
      setActiveTab("room");
    } catch (err) {
      console.error("Failed to launch live test session", err);
      alert("Error launching live test session. Please try again.");
    } finally {
      setLaunching(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!scheduleTest) {
      alert("Please select a test to schedule.");
      return;
    }
    if (!scheduleStartTime || !scheduleEndTime) {
      alert("Please select both Start Time and End Time for the test schedule.");
      return;
    }
    if (scheduleBatchIds.length === 0) {
      alert("Please select at least one target batch.");
      return;
    }

    setScheduling(true);
    try {
      const coHostProfile = adminProfiles.find((p) => p.uid === selectedCoHostId);

      await scheduleLiveTestSession({
        testId: scheduleTest.id,
        testTitle: scheduleTest.title,
        subject: scheduleTest.subject,
        batchIds: scheduleBatchIds,
        durationMinutes: scheduleTest.durationMinutes,
        scheduledStartTime: new Date(scheduleStartTime).toISOString(),
        scheduledEndTime: new Date(scheduleEndTime).toISOString(),
        adminUid,
        adminName,
        coHostId: coHostProfile ? coHostProfile.uid : undefined,
        coHostEmail: coHostProfile ? coHostProfile.email : undefined,
        coHostName: coHostProfile ? coHostProfile.name : undefined,
        proctoringSettings: {
          enableStudentCamera,
          enableAdminVideo,
          maxTabSwitchWarnings,
          autoSubmitOnViolationLimit,
        },
      });

      alert(`Test "${scheduleTest.title}" successfully scheduled!`);
      setScheduleTest(null);
      setScheduleStartTime("");
      setScheduleEndTime("");
    } catch (err) {
      console.error("Failed to schedule test", err);
      alert("Error creating schedule. Please check dates and try again.");
    } finally {
      setScheduling(false);
    }
  };

  const handleEndSession = async () => {
    if (!selectedSessionId) return;
    if (!confirm("Are you sure you want to end this Live Test session for all students?")) return;

    try {
      await endLiveTestSession(selectedSessionId);
      setSelectedSessionId(null);
      setViewingSessionMode("list");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (sessionId: string, title: string) => {
    if (!confirm(`Are you sure you want to cancel the schedule for "${title}"?`)) return;
    try {
      await deleteLiveTestSession(sessionId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartScheduledNow = async (s: LiveTestSession) => {
    try {
      await startScheduledTestNow(s.id, adminUid, adminName);
      setSelectedSessionId(s.id);
      setViewingSessionMode("detail");
      setActiveTab("room");
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
    () => presenceList.filter((p) => p.role === "student" && p.uid !== adminUid && p.uid !== user?.id),
    [presenceList, adminUid, user?.id],
  );

  const totalTabViolations = useMemo(
    () => studentPresenceList.reduce((acc, p) => acc + (p.tabSwitchCount || 0), 0),
    [studentPresenceList],
  );

  return (
    <div className="space-y-6 pb-12">


      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "setup" | "room" | "schedule")} className="w-full">
        <TabsList className={cn("grid w-full max-w-2xl bg-slate-100 p-1", isCohost ? "grid-cols-1" : "grid-cols-3")}>
          {!isCohost && (
            <TabsTrigger value="setup" className="font-semibold text-xs sm:text-sm">
              1. Select & Configure Test
            </TabsTrigger>
          )}

          <TabsTrigger
            value="room"
            className="font-semibold relative text-xs sm:text-sm"
          >
            {isCohost ? "Live Student Proctoring Monitor" : "2. Ongoing Live Tests"}
            {activeSessions.length > 0 && (
              <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white font-bold">
                {activeSessions.length}
              </span>
            )}
          </TabsTrigger>

          {!isCohost && (
            <TabsTrigger value="schedule" className="font-semibold text-xs sm:text-sm">
              3. Scheduled Tests
              {scheduledSessions.length > 0 && (
                <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white font-bold">
                  {scheduledSessions.length}
                </span>
              )}
            </TabsTrigger>
          )}
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
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-slate-800">
                          Target Batches ({selectedBatchIds.length})
                        </Label>
                        <button
                          type="button"
                          onClick={() => setShowBatchToggleTab1(!showBatchToggleTab1)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {showBatchToggleTab1 ? "Done Editing" : "Edit Batches"}
                        </button>
                      </div>

                      {!showBatchToggleTab1 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {selectedBatchIds.length === 0 ? (
                            <span className="text-xs text-slate-400 font-medium italic">No batches selected</span>
                          ) : (
                            batches
                              .filter((b) => selectedBatchIds.includes(b.id))
                              .map((b) => (
                                <Badge key={b.id} className="bg-indigo-600 text-white text-xs font-semibold px-2.5 py-0.5">
                                  {b.name}
                                </Badge>
                              ))
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-1">
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
                      )}
                    </div>

                    {/* Co-Host Assignment */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <Label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <UserPlus className="h-4 w-4 text-indigo-600" />
                          Assign Co-Host (Optional)
                        </span>
                        <span className="text-[11px] font-normal text-slate-500">Operating access granted to Host & Selected Co-Host</span>
                      </Label>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedCoHostId}
                        onChange={(e) => setSelectedCoHostId(e.target.value)}
                      >
                        <option value="none">-- No Co-Host (Host Only) --</option>
                        {adminProfiles.map((a) => (
                          <option key={a.uid} value={a.uid}>
                            {a.name} ({a.kind === "cohost" ? "Co-Host" : "Admin"} • {a.email})
                          </option>
                        ))}
                      </select>
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

        {/* TAB 2: ONGOING LIVE TESTS (LIST & PROCTORING ROOM VIEWS) */}
        <TabsContent value="room" className="mt-6 space-y-6">
          {viewingSessionMode === "list" || !selectedSessionId ? (
            /* ONGOING TESTS LIST VIEW */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Radio className="h-5 w-5 text-emerald-500 animate-pulse" />
                    Ongoing Live Test Sessions ({activeSessions.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select an ongoing test below to view its live proctoring grid and broadcast controls.
                  </p>
                </div>
              </div>

              {activeSessions.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-xs">
                  <Radio className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No Ongoing Live Tests</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {isCohost
                      ? "There are currently no active live test sessions assigned to you for proctoring."
                      : 'There are currently no active live test sessions running. Go to tab "1. Select & Configure Test" to launch a session.'}
                  </p>
                  {!isCohost && (
                    <Button
                      size="sm"
                      className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                      onClick={() => setActiveTab("setup")}
                    >
                      Launch a Live Test Session
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeSessions.map((s) => {
                    const testBatches = s.batchIds?.length
                      ? batches
                          .filter((b) => s.batchIds!.includes(b.id))
                          .map((b) => b.name)
                          .join(", ")
                      : s.batchId
                      ? batches.find((b) => b.id === s.batchId)?.name || "All Batches"
                      : "All Batches";

                    return (
                      <Card
                        key={s.id}
                        className="border-slate-200 shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between"
                      >
                        <CardHeader className="pb-3 border-b border-slate-100">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/40 text-[10px] mb-1.5 font-semibold">
                                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                LIVE ONGOING
                              </Badge>
                              <CardTitle className="text-base font-bold text-slate-900 leading-tight">
                                {s.testTitle}
                              </CardTitle>
                              <p className="text-xs text-slate-500 mt-0.5">{s.subject}</p>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-3 pb-4 space-y-3">
                          <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Target Batches:</span>
                              <span className="font-semibold text-slate-800 truncate max-w-[160px]">{testBatches}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Duration:</span>
                              <span className="font-semibold text-slate-800">{s.durationMinutes} Mins</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Proctor:</span>
                              <span className="font-semibold text-slate-800">{s.adminName || "Admin"}</span>
                            </div>
                          </div>

                          <Button
                            onClick={() => {
                              setSelectedSessionId(s.id);
                              setViewingSessionMode("detail");
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9 text-xs shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <Video className="h-4 w-4 text-emerald-300" />
                            <Eye className="h-4 w-4" />
                            Live Test Alert & Cam Monitor
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* DETAILED PROCTORING ROOM VIEW FOR SELECTED SESSION */
            <div className="space-y-6">
              {/* Top Navigation & Back Button */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingSessionMode("list")}
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4 text-indigo-600" />
                    Back to Ongoing Tests List
                  </Button>

                  {hasOperatingAccess && (
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                      onClick={() => void handleEndSession()}
                    >
                      <StopCircle className="h-4 w-4" />
                      End Live Test Session
                    </Button>
                  )}
                </div>
              </div>

              {currentSession && (
                <div className="space-y-6">
                  {/* Live Session KPIs */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-slate-200 shadow-xs">
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

                    <Card className="border-slate-200 shadow-xs">
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

                    <Card className="border-slate-200 shadow-xs">
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

                    <Card className="border-slate-200 shadow-xs">
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
                    <Card className="lg:col-span-5 border-slate-200 shadow-xs bg-slate-900 text-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
                          <span className="flex items-center gap-2">
                            <Video className="h-4 w-4 text-emerald-400" />
                            {isCohost ? "Co-Host Proctor Camera & Mic Feed" : "Admin Proctor Camera & Mic Feed"}
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
                            <span className="text-xs font-medium text-white">{adminName} ({isCohost ? "Co-Host" : "Admin"})</span>
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
                    <Card className="lg:col-span-7 border-slate-200 shadow-xs">
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
                                "group relative overflow-hidden rounded-2xl border bg-white p-3 shadow-xs transition-all duration-200",
                                isViolation
                                  ? "border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/20"
                                  : "border-slate-200 hover:border-indigo-300 hover:shadow-md",
                              )}
                            >
                              {/* Student Live Video Tile */}
                              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                                <ParticipantVideoTile
                                  presence={p}
                                  partyTracks={partyTracks || (undefined as any)}
                                  isLocal={false}
                                />

                                {p.tabSwitchCount > 0 && (
                                  <div className="absolute top-2 left-2 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs z-10">
                                    ⚠️ {p.tabSwitchCount} Tab Switch{p.tabSwitchCount > 1 ? "es" : ""}
                                  </div>
                                )}

                                {p.isSubmitted && (
                                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
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
              )}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: SCHEDULED TESTS */}
        <TabsContent value="schedule" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Premade Tests Picker for Scheduling */}
            <Card className="lg:col-span-6 border-slate-200 shadow-md flex flex-col">
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    Select Premade Test to Schedule
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
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.2 text-[10px]",
                          selectedBatchTab === "all" ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700",
                        )}
                      >
                        {tests.length}
                      </span>
                    </button>

                    {batches.map((b) => {
                      const count = tests.filter((t) => {
                        const bIds = t.batchIds?.length ? t.batchIds : t.batchId ? [t.batchId] : [];
                        return bIds.includes(b.id);
                      }).length;

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBatchTab(b.id)}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150 flex items-center gap-1",
                            selectedBatchTab === b.id
                              ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80",
                          )}
                        >
                          <span>{b.name}</span>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.2 text-[10px]",
                              selectedBatchTab === b.id ? "bg-indigo-700 text-white" : "bg-slate-200 text-slate-700",
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
                      const isSelected = scheduleTest?.id === t.id;
                      const testBatches = formatExamBatchLabel(t, batches);
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setScheduleTest(t);
                            const bIds = t.batchIds?.length ? t.batchIds : t.batchId ? [t.batchId] : [];
                            setScheduleBatchIds(bIds);
                          }}
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
                                  {t.subject || "General"}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-medium">
                                  {testBatches}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                                <span className="flex items-center gap-1 font-medium">
                                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                                  {t.durationMinutes} mins
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  {t.totalQuestions} Questions
                                </span>
                                {t.totalMarks ? (
                                  <span className="flex items-center gap-1 font-bold text-indigo-700">
                                    {t.totalMarks} Marks
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                                isSelected
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-slate-300 bg-white",
                              )}
                            >
                              {isSelected && <CheckCircle2 className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Right: Configure Scheduled Live Test Session */}
            <Card className="lg:col-span-6 border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100 pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-indigo-600" />
                  Configure & Save Test Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                {!scheduleTest ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center text-slate-500">
                    <FileSpreadsheet className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No Test Selected</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Please select a premade test from the list on the left to configure start/end times and schedule.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-indigo-600 text-white text-[10px] font-bold">SELECTED FOR SCHEDULE</Badge>
                        <Badge variant="outline" className="text-indigo-700 border-indigo-300 text-xs">
                          {scheduleTest.durationMinutes} mins
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-2">{scheduleTest.title}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">{scheduleTest.subject} • {scheduleTest.totalQuestions} Questions</p>
                    </div>

                    {/* Target Batches */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-800">
                          Target Batches ({scheduleBatchIds.length})
                        </Label>
                        <button
                          type="button"
                          onClick={() => setShowBatchToggleTab3(!showBatchToggleTab3)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {showBatchToggleTab3 ? "Done Editing" : "Edit Batches"}
                        </button>
                      </div>

                      {!showBatchToggleTab3 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {scheduleBatchIds.length === 0 ? (
                            <span className="text-xs text-slate-400 font-medium italic">No batches selected</span>
                          ) : (
                            batches
                              .filter((b) => scheduleBatchIds.includes(b.id))
                              .map((b) => (
                                <Badge key={b.id} className="bg-indigo-600 text-white text-xs font-semibold px-2.5 py-0.5">
                                  {b.name}
                                </Badge>
                              ))
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {batches.map((b) => {
                            const checked = scheduleBatchIds.includes(b.id);
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  setScheduleBatchIds((prev) =>
                                    prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id],
                                  );
                                }}
                                className={cn(
                                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                                  checked
                                    ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                                )}
                              >
                                {b.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Schedule Start Time */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Scheduled Start Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    {/* Schedule End Time */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Scheduled End Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={scheduleEndTime}
                        onChange={(e) => setScheduleEndTime(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    {/* Co-Host Assignment */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <Label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <UserPlus className="h-4 w-4 text-indigo-600" />
                          Assign Co-Host (Optional)
                        </span>
                      </Label>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedCoHostId}
                        onChange={(e) => setSelectedCoHostId(e.target.value)}
                      >
                        <option value="none">-- No Co-Host (Host Only) --</option>
                        {adminProfiles.map((a) => (
                          <option key={a.uid} value={a.uid}>
                            {a.name} ({a.kind === "cohost" ? "Co-Host" : "Admin"} • {a.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      onClick={() => void handleCreateSchedule()}
                      disabled={scheduling || !scheduleStartTime || !scheduleEndTime}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-10 text-xs shadow-md mt-4"
                    >
                      {scheduling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Schedule...
                        </>
                      ) : (
                        <>
                          <Calendar className="mr-2 h-4 w-4" />
                          Save Test Schedule
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* List: Scheduled Tests */}
          <Card className="border-slate-200 shadow-md">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Scheduled Tests Roster ({scheduledSessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {scheduledSessions.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-slate-500">
                  <CalendarClock className="h-8 w-8 text-slate-300 mb-1.5" />
                  <p className="font-semibold text-slate-700">No Scheduled Tests</p>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xs">
                    Select a premade test above and configure start/end times to create automated schedules.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {scheduledSessions.map((s) => {
                    const testBatches = s.batchIds?.length
                      ? batches
                          .filter((b) => s.batchIds!.includes(b.id))
                          .map((b) => b.name)
                          .join(", ")
                      : "All Batches";

                    const startFormatted = s.scheduledStartTime
                      ? new Date(s.scheduledStartTime).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Not set";

                    const endFormatted = s.scheduledEndTime
                      ? new Date(s.scheduledEndTime).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Not set";

                    return (
                      <div
                        key={s.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-300 transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold mb-1">
                                SCHEDULED
                              </Badge>
                              <h4 className="font-bold text-slate-900 text-sm">{s.testTitle}</h4>
                              <p className="text-xs text-slate-500">{s.subject} • {testBatches}</p>
                              {s.coHostName && (
                                <p className="text-[11px] text-indigo-600 font-medium mt-1">
                                  Co-Host: {s.coHostName}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs flex items-center gap-1"
                                onClick={() => {
                                  setSelectedSessionId(s.id);
                                  setViewingSessionMode("detail");
                                  setActiveTab("room");
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Alert & Cam Monitor
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-emerald-700 hover:bg-emerald-50 border-emerald-200 font-semibold"
                                onClick={() => void handleStartScheduledNow(s)}
                              >
                                <PlayCircle className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                Start Now
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                                onClick={() => void handleDeleteSchedule(s.id, s.testTitle)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Starts At</span>
                              <span className="font-semibold text-indigo-950">{startFormatted}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ends At</span>
                              <span className="font-semibold text-rose-950">{endFormatted}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
