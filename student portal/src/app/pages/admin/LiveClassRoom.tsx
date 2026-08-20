import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useObservableAsValue } from "partytracks/react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import ParticipantVideoTile from "../../components/liveClasses/ParticipantVideoTile";
import { useLiveClassPresence } from "../../features/liveClasses/useLiveClassPresence";
import { startRecordingCapture, type RecordingCaptureHandle } from "../../features/liveClasses/recordingCapture";
import {
  deactivateLiveClass,
  endLiveClass,
  launchLiveTest,
  replyToDoubt,
  resolveDoubt,
  setHostControlFlag,
  setSpotlight,
  stopLiveTest,
  subscribeToDoubts,
  subscribeToLiveClass,
  updateLiveClass,
} from "../../features/liveClasses/liveClassApi";
import { getLiveClassBatchIds } from "../../features/liveClasses/liveClassBatchUtils";
import { examIncludesBatch } from "../../features/exams/examBatchUtils";
import { listExamTestsForAdmin } from "../../features/exams/examApi";
import type { LiveClass, LiveClassDoubt, LiveClassPresence, LiveClassRecordingItem, ParticipantRole } from "../../features/liveClasses/types";
import type { ExamTest } from "../../features/exams/types";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Circle,
  Square,
  PhoneOff,
  UserX,
  Sparkles,
  ClipboardList,
  MessageCircleQuestion,
  CheckCircle2,
  Loader2,
  Send,
  MessageSquare,
} from "lucide-react";

function LiveClassRoomInner({
  classId,
  cls,
  role,
  uid,
  name,
}: {
  classId: string;
  cls: LiveClass;
  role: ParticipantRole;
  uid: string;
  name: string;
}) {
  const navigate = useNavigate();
  const { partyTracks, connectError, reconnect, isConnected, mic, camera, screenshare, roster } =
    useLiveClassPresence({
      classId,
      uid,
      name,
      role,
    });

  const [doubts, setDoubts] = useState<LiveClassDoubt[]>([]);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [testPickerOpen, setTestPickerOpen] = useState(false);
  const [availableTests, setAvailableTests] = useState<ExamTest[]>([]);
  const [recordingHandle, setRecordingHandle] = useState<RecordingCaptureHandle | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const submitDoubtReply = async (doubtId: string) => {
    const text = replyTextMap[doubtId]?.trim();
    if (!text) return;
    try {
      await replyToDoubt({
        classId,
        doubtId,
        replyText: text,
        repliedByUid: uid,
        repliedByName: name || "Instructor",
      });
      setReplyTextMap((prev) => ({ ...prev, [doubtId]: "" }));
    } catch (e) {
      console.error(e);
      alert("Could not send reply.");
    }
  };

  const isMicOn = useObservableAsValue(mic.isBroadcasting$, false);
  const isCameraOn = useObservableAsValue(camera.isBroadcasting$, false);
  const isScreenOn = useObservableAsValue(screenshare.isBroadcasting$, false);

  useEffect(() => subscribeToDoubts(classId, setDoubts), [classId]);

  // Mark the class live as soon as a host/co-host opens the room so students
  // are not stuck on "Waiting for host" while WebRTC is still negotiating.
  useEffect(() => {
    if (cls.status === "ended" || cls.status === "active") return;
    void updateLiveClass(classId, {
      status: "active",
      activeSince: new Date().toISOString(),
    }).catch((err) => {
      console.error("Failed to activate live class", err);
    });
  }, [classId, cls.status]);

  // Keep active if we reconnect after a brief drop while still in the room.
  useEffect(() => {
    if (isConnected && cls.status !== "active" && cls.status !== "ended") {
      void updateLiveClass(classId, {
        status: "active",
        activeSince: new Date().toISOString(),
      }).catch((err) => {
        console.error("Failed to re-activate live class", err);
      });
    }
  }, [isConnected, cls.status, classId]);

  const openTestPicker = async () => {
    const all = await listExamTestsForAdmin();
    const batchIds = getLiveClassBatchIds(cls);
    const matching = all.filter((t) => {
      if (t.status && t.status !== "published") return false;
      if (!batchIds.length) return true;
      const testBatches = t.batchIds?.length ? t.batchIds : t.batchId ? [t.batchId] : [];
      if (!testBatches.length) return true;
      return batchIds.some((b) => examIncludesBatch(t, b));
    });
    setAvailableTests(matching.length > 0 ? matching : all.filter((t) => t.status === "published"));
    setTestPickerOpen(true);
  };

  const toggleRecording = async () => {
    if (recordingHandle) {
      const handle = recordingHandle;
      setRecordingHandle(null);
      await updateLiveClass(classId, { recordingStatus: "uploading" });
      await handle.stop();
      return;
    }
    try {
      const handle = await startRecordingCapture({
        classId,
        onUploading: () => {
          setRecordingHandle(null);
          void updateLiveClass(classId, { recordingStatus: "uploading" });
        },
        onUploaded: async (result) => {
          setRecordingHandle(null);
          const newRecordingItem: LiveClassRecordingItem = {
            id: `rec_${Date.now()}`,
            key: result.key,
            durationSec: result.durationSec,
            sizeBytes: result.sizeBytes,
            createdAt: new Date().toISOString(),
            downloadUrl: result.downloadUrl,
          };

          const existingRecordings: LiveClassRecordingItem[] = Array.isArray(cls.recordings) ? [...cls.recordings] : [];
          if (cls.recordingKey && !existingRecordings.some((r) => r.key === cls.recordingKey)) {
            existingRecordings.unshift({
              id: "rec_legacy",
              key: cls.recordingKey,
              durationSec: cls.recordingDurationSec,
              sizeBytes: cls.recordingSizeBytes,
              createdAt: cls.activeSince || cls.createdAt || new Date().toISOString(),
              downloadUrl: cls.recordingDownloadUrl,
            });
          }

          const updatedRecordings = [...existingRecordings, newRecordingItem];

          const updatePayload: Record<string, any> = {
            recordingStatus: "ready",
            recordingKey: result.key,
            recordingDurationSec: result.durationSec,
            recordingSizeBytes: result.sizeBytes,
            recordings: updatedRecordings,
          };
          if (result.downloadUrl) {
            updatePayload.recordingDownloadUrl = result.downloadUrl;
          }
          await updateLiveClass(classId, updatePayload);
        },
        onError: async (err) => {
          setRecordingHandle(null);
          console.error(err);
          await updateLiveClass(classId, { recordingStatus: "failed" });
          alert(`Recording failed: ${err.message}`);
        },
      });
      setRecordingHandle(handle);
      await updateLiveClass(classId, { recordingStatus: "recording" });
    } catch (err) {
      console.error(err);
      alert("Could not start recording — screen-share permission may have been denied.");
    }
  };

  const removeParticipant = (targetUid: string, targetName: string) => {
    if (!confirm(`Remove ${targetName} from the class?`)) return;
    void setHostControlFlag(classId, targetUid, "kicked", true);
  };

  const launchTest = async (testId: string) => {
    await launchLiveTest(classId, testId);
    setTestPickerOpen(false);
    const targetTest = availableTests.find((t) => t.id === testId);
    const testTitle = targetTest?.title ? `"${targetTest.title}"` : "Live Exam";
    setNotificationToast(`🚀 ${testTitle} launched successfully! All students in the live class have been notified.`);
    setTimeout(() => setNotificationToast(null), 5000);
  };

  const [confirmEndRecordingOpen, setConfirmEndRecordingOpen] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<"end" | "leave" | null>(null);
  const [isUploadingAndEnding, setIsUploadingAndEnding] = useState(false);

  const leaveRoom = async () => {
    if (recordingHandle || cls.recordingStatus === "recording" || cls.recordingStatus === "uploading") {
      setConfirmActionType("leave");
      setConfirmEndRecordingOpen(true);
      return;
    }
    await performLeaveRoom();
  };

  const performLeaveRoom = async () => {
    const otherHosts = roster.filter(
      (p) => p.id !== uid && (p.role === "host" || p.role === "co-host"),
    );
    if (cls.status === "active" && otherHosts.length === 0) {
      try {
        await deactivateLiveClass(classId);
      } catch (e) {
        console.error(e);
      }
    }
    navigate("/admin/live-classes");
  };

  const endForEveryone = async () => {
    if (recordingHandle || cls.recordingStatus === "recording" || cls.recordingStatus === "uploading") {
      setConfirmActionType("end");
      setConfirmEndRecordingOpen(true);
      return;
    }

    if (!confirm("End this class for everyone? This will stop the meeting.")) return;
    await endLiveClass(classId);
    navigate("/admin/live-classes");
  };

  const executeConfirmedEndOrLeave = async (backgroundUpload = false) => {
    const action = confirmActionType;
    setConfirmEndRecordingOpen(false);

    if (backgroundUpload) {
      if (recordingHandle) {
        const handle = recordingHandle;
        setRecordingHandle(null);
        void updateLiveClass(classId, { recordingStatus: "uploading" });
        void handle.stop();
      }
      if (action === "end") {
        void endLiveClass(classId);
      } else {
        void performLeaveRoom();
      }
      navigate("/admin/live-classes");
      return;
    }

    setIsUploadingAndEnding(true);

    try {
      if (recordingHandle) {
        const handle = recordingHandle;
        setRecordingHandle(null);
        await updateLiveClass(classId, { recordingStatus: "uploading" });
        await handle.stop();
      }
    } catch (err) {
      console.error("Error finalizing recording before ending class:", err);
    }

    if (action === "end") {
      await endLiveClass(classId);
    } else {
      await performLeaveRoom();
    }
    setIsUploadingAndEnding(false);
    navigate("/admin/live-classes");
  };

  if (connectError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <p className="max-w-md text-red-600">{connectError}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => reconnect()}>Try again</Button>
          <Button variant="outline" onClick={() => navigate("/admin/live-classes")}>
            Back
          </Button>
        </div>
      </div>
    );
  }
  if (!partyTracks) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        Joining the class…
      </div>
    );
  }

  const toggleScreenshare = async () => {
    try {
      if (!isScreenOn) {
        await screenshare.enableSource();
        screenshare.startBroadcasting();
      } else {
        screenshare.stopBroadcasting();
        screenshare.disableSource();
      }
    } catch (err) {
      console.warn("Screenshare toggle error", err);
    }
  };

  const spotlightPresence = cls.spotlightUid
    ? roster.find((p) => p.id === cls.spotlightUid)
    : roster.find((p) => (p.id === uid ? isScreenOn : !!p.screenshareVideoTrack)) ||
    roster.find((p) => p.role === "host") ||
    roster.find((p) => p.role === "co-host") ||
    (roster.length > 0 ? roster[0] : null);

  const otherRoster = spotlightPresence ? roster.filter((p) => p.id !== spotlightPresence.id) : roster;
  const isRecording = !!recordingHandle || cls.recordingStatus === "recording";
  const isUploading = cls.recordingStatus === "uploading";

  const renderTile = (p: LiveClassPresence, spotlighted?: boolean) => {
    const isLocal = p.id === uid;
    return (
      <ParticipantVideoTile
        key={p.id}
        presence={p}
        partyTracks={partyTracks}
        isLocal={isLocal}
        mediaReady={isConnected}
        localVideoTrack$={isLocal && isCameraOn ? camera.broadcastTrack$ : undefined}
        localAudioTrack$={isLocal && isMicOn ? mic.broadcastTrack$ : undefined}
        localScreenshareTrack$={isLocal && isScreenOn ? screenshare.video.broadcastTrack$ : undefined}
        spotlighted={spotlighted}
        actions={
          !isLocal ? (
            <>
              <button
                type="button"
                title={p.mutedByHost ? "Unmute" : "Mute"}
                className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                onClick={() => void setHostControlFlag(classId, p.id, "mutedByHost", !p.mutedByHost)}
              >
                <MicOff className={`h-3 w-3 ${p.mutedByHost ? "text-red-400" : ""}`} />
              </button>
              <button
                type="button"
                title={p.videoDisabledByHost ? "Enable video" : "Disable video"}
                className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                onClick={() =>
                  void setHostControlFlag(classId, p.id, "videoDisabledByHost", !p.videoDisabledByHost)
                }
              >
                <VideoOff className={`h-3 w-3 ${p.videoDisabledByHost ? "text-red-400" : ""}`} />
              </button>
              <button
                type="button"
                title={cls.spotlightUid === p.id ? "Clear spotlight" : "Spotlight"}
                className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                onClick={() => void setSpotlight(classId, cls.spotlightUid === p.id ? null : p.id)}
              >
                <Sparkles className={`h-3 w-3 ${cls.spotlightUid === p.id ? "text-amber-300" : ""}`} />
              </button>
              <button
                type="button"
                title="Remove"
                className="rounded bg-black/60 p-1 text-red-400 hover:bg-black/80"
                onClick={() => removeParticipant(p.id, p.name)}
              >
                <UserX className="h-3 w-3" />
              </button>
            </>
          ) : null
        }
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <p className="font-semibold text-slate-900">{cls.name}</p>
              <p className="text-xs text-slate-500">
                {cls.subject} · Role: {role} · {roster.length} in room
                {isConnected ? "" : " · Connecting…"}
                {isUploading ? " · Uploading recording…" : isRecording ? " · Recording" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={isMicOn ? "default" : "outline"} onClick={() => mic.toggleBroadcasting()}>
                {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant={isCameraOn ? "default" : "outline"}
                onClick={() => camera.toggleBroadcasting()}
              >
                {isCameraOn ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant={isScreenOn ? "default" : "outline"}
                onClick={() => void toggleScreenshare()}
              >
                {isScreenOn ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant={isRecording ? "default" : "outline"}
                className={isRecording ? "bg-red-600 hover:bg-red-700" : ""}
                disabled={isUploading}
                onClick={() => void toggleRecording()}
              >
                {isRecording ? <Square className="mr-1 h-4 w-4" /> : <Circle className="mr-1 h-4 w-4" />}
                {isUploading ? "Uploading…" : isRecording ? "Stop Recording" : "Record"}
              </Button>
              <Button
                size="sm"
                variant={cls.liveTestId ? "default" : "outline"}
                className={cls.liveTestId ? "bg-amber-600 hover:bg-amber-700 font-semibold" : "border-amber-300 text-amber-900 hover:bg-amber-50"}
                onClick={() => void openTestPicker()}
              >
                <ClipboardList className="mr-1.5 h-4 w-4" />
                {cls.liveTestId ? "Live Test Active" : "Trigger Live Test"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void leaveRoom()}>
                Leave
              </Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => void endForEveryone()}>
                <PhoneOff className="mr-1 h-4 w-4" />
                End Class
              </Button>
            </div>
          </div>

          {notificationToast ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-bold text-emerald-900 shadow-md">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 animate-spin" />
                <span>{notificationToast}</span>
              </div>
              <button onClick={() => setNotificationToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold text-xs">
                ✕
              </button>
            </div>
          ) : null}

          {/* MIDDLE MAIN STAGE: Student video screens as elements */}
          {spotlightPresence && spotlightPresence.id !== uid ? (
            <div className="space-y-3">
              {renderTile(spotlightPresence, true)}
              {otherRoster.filter((p) => p.id !== uid).length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {otherRoster.filter((p) => p.id !== uid).map((p) => renderTile(p))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {roster.filter((p) => p.id !== uid).length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {roster.filter((p) => p.id !== uid).map((p) => renderTile(p))}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                  <VideoIcon className="h-10 w-10 text-indigo-400 mb-2 animate-bounce" />
                  <p className="font-semibold text-slate-800">Waiting for students to join…</p>
                  <p className="text-xs text-slate-400 mt-1">Student video feeds will appear here in the middle stage when they join.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: Doubts box & Host's own video preview below it */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <MessageCircleQuestion className="h-4 w-4 text-indigo-600" />
              Doubts
            </p>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {doubts.length === 0 ? (
                <p className="text-xs text-slate-400">No doubts raised yet.</p>
              ) : (
                doubts.map((d) => (
                  <div
                    key={d.id}
                    className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${d.resolved ? "border-slate-200 bg-slate-50 text-slate-600" : "border-indigo-200 bg-indigo-50/60"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800">{d.studentName}</p>
                      <span className="text-[10px] text-slate-400">
                        {d.createdAt ? new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    <p className="text-slate-900">{d.text}</p>

                    {d.replyText ? (
                      <div className="mt-1.5 rounded-md border border-indigo-200 bg-white p-2 text-indigo-950 font-medium">
                        <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {d.repliedByName || "Instructor"}'s Reply:
                        </p>
                        <p className="mt-0.5 text-xs text-slate-800">{d.replyText}</p>
                      </div>
                    ) : null}

                    <div className="pt-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Type reply..."
                        value={replyTextMap[d.id] || ""}
                        onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void submitDoubtReply(d.id);
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                        disabled={!replyTextMap[d.id]?.trim()}
                        onClick={() => void submitDoubtReply(d.id)}
                      >
                        <Send className="h-3 w-3" />
                        Reply
                      </button>
                      {!d.resolved ? (
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100"
                          onClick={() => void resolveDoubt(classId, d.id, uid)}
                          title="Mark resolved without replying"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* HOST'S OWN VIDEO PREVIEW TILE IN BOTTOM RIGHT CORNER BELOW CHAT/DOUBTS */}
          <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <VideoIcon className="h-3.5 w-3.5 text-indigo-600" />
                Your Video (Host)
              </p>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Self</span>
            </div>
            <div className="overflow-hidden rounded-lg">
              {renderTile(
                roster.find((p) => p.id === uid) || {
                  id: uid,
                  name,
                  role,
                  mutedByHost: false,
                  videoDisabledByHost: false,
                },
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trigger CBT Live Test Dialog */}
      <Dialog open={testPickerOpen} onOpenChange={setTestPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ClipboardList className="h-5 w-5 text-amber-600" />
              Launch CBT Exam in Live Class
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Select a published exam to trigger live during this session. All joined students will automatically receive a join notification.
            </p>

            {cls.liveTestId ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-amber-900">Live Test Currently Active</p>
                  <p className="text-[11px] text-slate-600">Students have been prompted to participate.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs font-semibold"
                  onClick={async () => {
                    await stopLiveTest(classId);
                    setTestPickerOpen(false);
                    setNotificationToast("Live Test unlinked.");
                    setTimeout(() => setNotificationToast(null), 3000);
                  }}
                >
                  Unlink Test
                </Button>
              </div>
            ) : null}

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {availableTests.length === 0 ? (
                <p className="text-center py-6 text-slate-400">
                  No published CBT exams found matching this class batch.
                </p>
              ) : (
                availableTests.map((t) => {
                  const isLaunched = cls.liveTestId === t.id && (cls.liveTestStartedAt || (cls as any).liveTestActive);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between rounded-xl border p-3 bg-white transition-all ${isLaunched ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 hover:border-amber-300"
                        }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900">{t.title}</p>
                        <p className="text-[11px] text-slate-500">{t.subject} · {t.durationMinutes} mins · {t.totalQuestions} Qs</p>
                      </div>
                      {isLaunched ? (
                        <Button
                          size="sm"
                          disabled
                          className="bg-emerald-600 text-white font-bold text-xs border border-emerald-500 opacity-100 cursor-default shadow-xs"
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Test Launched
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 font-semibold text-xs text-white shadow-xs"
                          onClick={() => void launchTest(t.id)}
                        >
                          Launch Now
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestPickerOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog when ending/leaving class while recording is active */}
      <Dialog open={confirmEndRecordingOpen} onOpenChange={setConfirmEndRecordingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
              <Circle className="h-5 w-5 fill-red-600 text-red-600 animate-pulse" />
              Class Recording is Running
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs sm:text-sm text-slate-700">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 font-medium space-y-1">
              <p className="font-bold">⚠️ Active Session Recording</p>
              <p className="text-xs text-red-700">
                This class is currently being recorded. Ending or leaving the class now will automatically stop the recording and save all recorded video up to this moment directly to Cloudflare R2 storage.
              </p>
            </div>
            <p className="text-slate-600">
              Do you want to finalize the recording and proceed to {confirmActionType === "end" ? "end the class for everyone" : "leave the room"}?
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmEndRecordingOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold"
              onClick={() => void executeConfirmedEndOrLeave(true)}
            >
              Upload in Background & Exit
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 font-bold text-white shadow-xs"
              onClick={() => void executeConfirmedEndOrLeave(false)}
            >
              Save & {confirmActionType === "end" ? "End Class" : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uploading & Finalizing Progress Overlay */}
      {isUploadingAndEnding ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xs p-6 text-center text-white space-y-4">
          <div className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-8 shadow-2xl space-y-4 max-w-md">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-400" />
            <div>
              <p className="text-lg font-bold text-white">Saving Recording to Cloudflare R2...</p>
              <p className="mt-1 text-xs text-slate-400">
                Your recorded class video is being uploaded to R2 storage. You can wait or switch to background upload.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700 font-semibold text-xs"
                onClick={() => {
                  setIsUploadingAndEnding(false);
                  navigate("/admin/live-classes");
                }}
              >
                Upload in Background & Exit
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LiveClassRoom() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cls, setCls] = useState<LiveClass | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToLiveClass(id, (data) => {
      setCls(data);
      setLoaded(true);
    });
    return unsub;
  }, [id]);

  if (!id || !user) return null;
  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (!cls) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <p className="text-slate-600">Class not found.</p>
        <Button variant="outline" onClick={() => navigate("/admin/live-classes")}>
          Back
        </Button>
      </div>
    );
  }

  if (cls.status === "ended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <p className="text-slate-700">This class has ended.</p>
        <Button variant="outline" onClick={() => navigate("/admin/live-classes")}>
          Back to Live Classes
        </Button>
      </div>
    );
  }

  const role: ParticipantRole | null = cls.hostUids.includes(user.id)
    ? "host"
    : (cls.coHostUids || []).includes(user.id)
      ? "co-host"
      : null;

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <p className="text-red-600">You&apos;re not assigned as a host or co-host for this class.</p>
        <Button variant="outline" onClick={() => navigate("/admin/live-classes")}>
          Back
        </Button>
      </div>
    );
  }

  return <LiveClassRoomInner classId={id} cls={cls} role={role} uid={user.id} name={user.name} />;
}
