import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useObservableAsValue } from "partytracks/react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
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
} from "lucide-react";

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

  useEffect(() => subscribeToOwnDoubts(classId, user!.id, setDoubts), [classId, user]);

  // Attendance: join when the call connects; leave on unmount / disconnect.
  useEffect(() => {
    if (!isConnected || !user?.studentRecordId) return;
    recordAttendanceJoin({
      classId,
      studentRecordId: user.studentRecordId,
      studentUid: user.id,
      name: user.name,
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

  const spotlightPresence = cls.spotlightUid ? roster.find((p) => p.id === cls.spotlightUid) : null;
  const otherRoster = spotlightPresence ? roster.filter((p) => p.id !== spotlightPresence.id) : roster;

  const renderTile = (p: LiveClassPresence, spotlighted?: boolean) => {
    const isLocal = p.id === user!.id;
    return (
      <ParticipantVideoTile
        key={p.id}
        presence={p}
        partyTracks={partyTracks}
        isLocal={isLocal}
        mediaReady={isConnected}
        localVideoTrack$={isLocal && isCameraOn ? camera.broadcastTrack$ : undefined}
        localAudioTrack$={isLocal && isMicOn ? mic.broadcastTrack$ : undefined}
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

          {cls.liveTestId ? (
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
                onClick={() => navigate(`/student/tests/${cls.liveTestId}`)}
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
        </div>

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
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={sending || !doubtText.trim()}
            onClick={() => void submitDoubt()}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send
          </Button>

          <div className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto">
            {doubts.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-2 text-sm ${
                  d.resolved ? "border-emerald-100 bg-emerald-50/60" : "border-slate-100 bg-slate-50"
                }`}
              >
                <p>{d.text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {d.resolved ? "Answered" : "Waiting for instructor"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
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
