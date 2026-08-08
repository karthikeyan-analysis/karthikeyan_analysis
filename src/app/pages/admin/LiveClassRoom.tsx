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
import type { LiveClass, LiveClassDoubt, LiveClassPresence, ParticipantRole } from "../../features/liveClasses/types";
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
  const [testPickerOpen, setTestPickerOpen] = useState(false);
  const [availableTests, setAvailableTests] = useState<ExamTest[]>([]);
  const [recordingHandle, setRecordingHandle] = useState<RecordingCaptureHandle | null>(null);

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
    setAvailableTests(
      all.filter((t) => t.status === "published" && batchIds.some((b) => examIncludesBatch(t, b))),
    );
    setTestPickerOpen(true);
  };

  const toggleRecording = async () => {
    if (recordingHandle) {
      const handle = recordingHandle;
      setRecordingHandle(null);
      await updateLiveClass(classId, { recordingStatus: "uploading" });
      handle.stop();
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
          await updateLiveClass(classId, {
            recordingStatus: "ready",
            recordingKey: result.key,
            recordingDurationSec: result.durationSec,
            recordingSizeBytes: result.sizeBytes,
          });
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
  };

  const leaveRoom = async () => {
    recordingHandle?.stop();
    // If this was the last host/co-host, put the class back to waiting so
    // students cannot join (or stay in) an empty room.
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
    if (!confirm("End this class for everyone? This will stop the meeting and finalize any recording.")) return;
    recordingHandle?.stop();
    await endLiveClass(classId);
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

  const spotlightPresence = cls.spotlightUid ? roster.find((p) => p.id === cls.spotlightUid) : null;
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
                onClick={() => screenshare.toggleBroadcasting()}
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

          {spotlightPresence ? (
            <div className="space-y-2">
              {renderTile(spotlightPresence, true)}
              {otherRoster.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {otherRoster.map((p) => renderTile(p))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {roster.map((p) => renderTile(p))}
            </div>
          )}

          {roster.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Waiting for participants…
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <MessageCircleQuestion className="h-4 w-4 text-indigo-600" />
              Doubts
            </p>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {doubts.length === 0 ? (
                <p className="text-xs text-slate-400">No doubts raised yet.</p>
              ) : (
                doubts.map((d) => (
                  <div
                    key={d.id}
                    className={`rounded-lg border p-2 text-sm ${
                      d.resolved ? "border-slate-100 bg-slate-50 text-slate-400" : "border-indigo-100 bg-indigo-50/60"
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-700">{d.studentName}</p>
                    <p className="mt-0.5">{d.text}</p>
                    {!d.resolved ? (
                      <button
                        type="button"
                        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                        onClick={() => void resolveDoubt(classId, d.id, uid)}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark resolved
                      </button>
                    ) : null}
                  </div>
                ))
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
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                  onClick={async () => {
                    await stopLiveTest(classId);
                    setTestPickerOpen(false);
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
                availableTests.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-amber-300 bg-white"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{t.title}</p>
                      <p className="text-[11px] text-slate-500">{t.subject} · {t.durationMinutes} mins · {t.totalQuestions} Qs</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 font-semibold text-xs"
                      onClick={() => void launchTest(t.id)}
                    >
                      Launch Now
                    </Button>
                  </div>
                ))
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
