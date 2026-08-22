import { useEffect, useRef, useState } from "react";
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
import {
  addDoubt,
  recordAttendanceJoin,
  recordAttendanceLeave,
  subscribeToLiveClass,
  subscribeToOwnDoubts,
} from "../../features/liveClasses/liveClassApi";
import type { LiveClass, LiveClassDoubt, LiveClassPresence } from "../../features/liveClasses/types";
import TakeExam from "./TakeExam";
import {
  Send,
  MessageCircleQuestion,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Loader2,
  Award,
  Zap,
  Bell,
  Sparkles,
  MessageSquare,
} from "lucide-react";

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn("Could not play audio chime", err);
  }
}

function StudentCallInner({ classId, cls }: { classId: string; cls: LiveClass }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { partyTracks, connectError, reconnect, isConnected, mic, camera, roster, myPresence } =
    useLiveClassPresence({
      classId,
      uid: user!.id,
      name: user!.name,
      role: "student",
    });

  const isMicOn = useObservableAsValue(mic.isBroadcasting$, false);
  const isCameraOn = useObservableAsValue(camera.isBroadcasting$, false);

  const [doubts, setDoubts] = useState<LiveClassDoubt[]>([]);
  const [doubtText, setDoubtText] = useState("");
  const [sending, setSending] = useState(false);

  const [activeInRoomTestId, setActiveInRoomTestId] = useState<string | null>(null);
  const [showTestAlertModal, setShowTestAlertModal] = useState(false);
  const prevTestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentTestId =
      cls.liveTestId && cls.liveTestId !== "none" && (cls as any).liveTestActive === true
        ? cls.liveTestId
        : null;
    if (currentTestId && currentTestId !== prevTestIdRef.current) {
      playNotificationChime();
      setShowTestAlertModal(true);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("🚀 Live Test Launched!", {
            body: "Your instructor launched a CBT test for this live class. Click to participate.",
          });
        } catch (e) {}
      }
    }
    prevTestIdRef.current = currentTestId;
  }, [cls.liveTestId, (cls as any).liveTestActive]);

  useEffect(() => subscribeToOwnDoubts(classId, user!.id, setDoubts), [classId, user]);

  // Attendance: join when the call connects; leave on unmount / disconnect.
  useEffect(() => {
    if (!isConnected || !user?.studentRecordId) return;
    recordAttendanceJoin({
      classId,
      studentRecordId: user.studentRecordId,
      studentUid: user.id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
    }).catch(console.error);
    return () => {
      recordAttendanceLeave({ classId, studentRecordId: user.studentRecordId! }).catch(console.error);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, classId, user?.studentRecordId]);

  // Cooperative host controls — SFU has no role engine; we honor flags locally.
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const wasMutedByHost = useRef(false);
  const wasVideoDisabledByHost = useRef(false);

  useEffect(() => {
    if (myPresence?.mutedByHost && isMicOn) mic.toggleBroadcasting();
    if (myPresence?.mutedByHost) {
      wasMutedByHost.current = true;
    } else if (wasMutedByHost.current) {
      wasMutedByHost.current = false;
      setHostNotice("Host unmuted you — you can turn your mic back on.");
    }
  }, [myPresence?.mutedByHost, isMicOn, mic]);
  useEffect(() => {
    if (myPresence?.videoDisabledByHost && isCameraOn) camera.toggleBroadcasting();
    if (myPresence?.videoDisabledByHost) {
      wasVideoDisabledByHost.current = true;
    } else if (wasVideoDisabledByHost.current) {
      wasVideoDisabledByHost.current = false;
      setHostNotice("Host re-enabled your video — you can turn your camera back on.");
    }
  }, [myPresence?.videoDisabledByHost, isCameraOn, camera]);
  useEffect(() => {
    if (!hostNotice) return;
    const t = window.setTimeout(() => setHostNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [hostNotice]);
  useEffect(() => {
    if (myPresence?.kicked) {
      navigate("/student/live-classes", { replace: true });
    }
  }, [myPresence?.kicked, navigate]);

  // Host ended the class, or left and put it back to waiting.
  useEffect(() => {
    if (cls.status !== "active") {
      navigate("/student/live-classes", { replace: true });
    }
  }, [cls.status, navigate]);

  const submitDoubt = async () => {
    if (!doubtText.trim() || !user?.studentRecordId) return;
    setSending(true);
    try {
      await addDoubt({
        classId,
        studentRecordId: user.studentRecordId,
        studentUid: user.id,
        studentName: user.name,
        text: doubtText,
      });
      setDoubtText("");
    } catch (e) {
      console.error(e);
      alert("Could not send your doubt. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (connectError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <p className="max-w-md text-red-600">{connectError}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => reconnect()}>Try again</Button>
          <Button variant="outline" onClick={() => navigate("/student/live-classes")}>
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

  const hostPresence =
    (cls.spotlightUid ? roster.find((p) => p.id === cls.spotlightUid) : null) ||
    roster.find((p) => !!p.screenshareVideoTrack && (p.role === "host" || p.role === "co-host")) ||
    roster.find((p) => p.role === "host") ||
    roster.find((p) => p.role === "co-host") ||
    null;

  const renderTile = (p: LiveClassPresence, spotlighted?: boolean) => {
    const isLocal = p.id === user!.id;
    return (
      <ParticipantVideoTile
        key={p.id}
        presence={p}
        partyTracks={partyTracks}
        isLocal={isLocal}
        mediaReady={isConnected}
        localVideoTrack$={isLocal ? camera.broadcastTrack$ : undefined}
        localAudioTrack$={isLocal ? mic.broadcastTrack$ : undefined}
        spotlighted={spotlighted}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <p className="font-semibold text-slate-900">{cls.name}</p>
              <p className="text-xs text-slate-500">
                {cls.subject}
                {isConnected ? "" : " · Connecting…"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={isMicOn ? "default" : "outline"}
                disabled={!!myPresence?.mutedByHost}
                onClick={() => mic.toggleBroadcasting()}
                title={myPresence?.mutedByHost ? "Muted by host" : undefined}
              >
                {myPresence?.mutedByHost || !isMicOn ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant={isCameraOn ? "default" : "outline"}
                disabled={!!myPresence?.videoDisabledByHost}
                onClick={() => camera.toggleBroadcasting()}
                title={myPresence?.videoDisabledByHost ? "Video disabled by host" : undefined}
              >
                {myPresence?.videoDisabledByHost || !isCameraOn ? (
                  <VideoOff className="h-4 w-4" />
                ) : (
                  <VideoIcon className="h-4 w-4" />
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/student/live-classes")}>
                <PhoneOff className="mr-1 h-4 w-4" />
                Leave
              </Button>
            </div>
          </div>

          {/* Test banner ONLY if host explicitly launched a test */}
          {cls.liveTestId && cls.liveTestId !== "none" && (cls as any).liveTestActive === true ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white shadow">
                  <Award className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm">Instructor launched a Live Exam!</p>
                  <p className="text-[11px] text-amber-800">Your teacher started a CBT test for this class. Click below to participate.</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md"
                onClick={() => {
                  setShowTestAlertModal(false);
                  setActiveInRoomTestId(cls.liveTestId!);
                }}
              >
                <Zap className="mr-1.5 h-4 w-4 fill-current" />
                Join Live Test Now
              </Button>
            </div>
          ) : null}

          {hostNotice ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              {hostNotice}
            </div>
          ) : null}

          {/* MIDDLE MAIN STAGE: Big Admin or Co-Host Screen */}
          {hostPresence ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-xl">
              {renderTile(hostPresence, true)}
            </div>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              <VideoIcon className="h-10 w-10 text-indigo-400 mb-2 animate-pulse" />
              <p className="font-semibold text-slate-800 text-base">Waiting for Host / Admin stream…</p>
              <p className="text-xs text-slate-400 mt-1">The instructor's video & screen presentation will appear here in big.</p>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: Ask a Doubt & Student's own video preview below it */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <MessageCircleQuestion className="h-4 w-4 text-indigo-600" />
              Ask a Doubt
            </p>
            <p className="mb-2 text-xs text-slate-500">Only your instructor can see your doubts.</p>
            <div className="mb-3">
              <textarea
                className="min-h-[60px] w-full rounded-lg border border-slate-200 p-2 text-sm"
                value={doubtText}
                onChange={(e) => setDoubtText(e.target.value)}
                placeholder="Type your doubt…"
              />
            </div>
            <Button
              size="sm"
              className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold"
              disabled={sending || !doubtText.trim()}
              onClick={() => void submitDoubt()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Send
            </Button>

            <div className="mt-4 max-h-[25vh] space-y-2 overflow-y-auto">
              {doubts.map((d) => (
                <div
                  key={d.id}
                  className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${
                    d.resolved ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-slate-900 font-medium">{d.text}</p>
                  
                  {d.replyText ? (
                    <div className="mt-1.5 rounded-md border border-indigo-200 bg-white p-2 text-indigo-950 font-medium">
                      <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {d.repliedByName || "Instructor"}'s Reply:
                      </p>
                      <p className="mt-0.5 text-xs text-slate-800">{d.replyText}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {d.resolved ? "✓ Answered by instructor" : "Pending instructor review…"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* STUDENT'S OWN VIDEO PREVIEW TILE IN BOTTOM RIGHT CORNER BELOW DOUBTS */}
          <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <VideoIcon className="h-3.5 w-3.5 text-indigo-600" />
                Your Video Stream
              </p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">You</span>
            </div>
            <div className="overflow-hidden rounded-lg">
              {renderTile(
                roster.find((p) => p.id === user!.id) || {
                  id: user!.id,
                  name: user!.name,
                  role: "student",
                  sessionId: cls.id,
                  mutedByHost: false,
                  videoDisabledByHost: false,
                  updatedAt: new Date().toISOString(),
                },
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Test Alert Dialog Popup */}
      <Dialog open={showTestAlertModal} onOpenChange={setShowTestAlertModal}>
        <DialogContent className="max-w-md border-amber-300 bg-amber-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-950">
              <Sparkles className="h-5 w-5 text-amber-600 animate-spin" />
              🚀 Live Test Launched!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs sm:text-sm text-amber-900">
            <p>
              Your instructor has launched a CBT Live Test for this class.
            </p>
            <p className="font-semibold text-amber-950 bg-amber-100/80 p-2.5 rounded-lg border border-amber-200">
              ⚡ You will stay connected to the live class meeting with your camera and mic active while taking this test.
            </p>
          </div>
          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={() => setShowTestAlertModal(false)}
            >
              Later
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={() => {
                setShowTestAlertModal(false);
                if (cls.liveTestId) {
                  setActiveInRoomTestId(cls.liveTestId);
                }
              }}
            >
              <Zap className="mr-1.5 h-4 w-4 fill-current" />
              Start Test Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-Room Full-Screen Exam Overlay (Keeps WebRTC presence connected!) */}
      {activeInRoomTestId ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-4 py-2 text-white shadow-lg">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400">Live Meeting Active</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300">Camera & Mic Connected ({roster.length} in room)</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
              onClick={() => setActiveInRoomTestId(null)}
            >
              Minimize Test & Return to Video Call
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TakeExam
              embeddedTestId={activeInRoomTestId}
              onEmbeddedClose={() => setActiveInRoomTestId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WaitingForHost({ cls }: { cls: LiveClass | null }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      <p className="text-lg font-semibold text-slate-800">
        {cls?.status === "ended"
          ? "This class has ended."
          : "Waiting for the host to start the class…"}
      </p>
      <p className="max-w-md text-sm text-slate-500">
        {cls?.status === "ended"
          ? cls.name
          : `${cls?.name || "This class"} will open automatically when the host starts.`}
      </p>
      <Button variant="outline" onClick={() => navigate("/student/live-classes")}>
        Back to Live Classes
      </Button>
    </div>
  );
}

export default function LiveClassJoin() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
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
  if (!cls || cls.status !== "active") return <WaitingForHost cls={cls} />;

  return <StudentCallInner classId={id} cls={cls} />;
}
