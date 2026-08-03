import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ArrowLeft, Shield, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { requestRecordingPlaybackUrl } from "../../features/liveClasses/recordingPlayback";
import { subscribeToLiveClass } from "../../features/liveClasses/liveClassApi";
import type { LiveClass } from "../../features/liveClasses/types";

export default function LiveClassRecording() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const isAdminView = location.pathname.startsWith("/admin/") || user?.role === "admin";
  const backPath = isAdminView ? "/admin/live-classes" : "/student/live-classes";

  const [cls, setCls] = useState<LiveClass | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!id) return;
    return subscribeToLiveClass(id, setCls);
  }, [id]);

  const loadUrl = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const { url } = await requestRecordingPlaybackUrl(id);
      setPlaybackUrl(url);
    } catch (e: any) {
      const msg =
        e?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)\s*$/, "").trim() ||
        e?.details ||
        "Could not load the recording.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey && ["s", "p", "u", "c", "x"].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        key === "f12" ||
        key === "printscreen"
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", preventDefault, { capture: true });
    document.addEventListener("copy", preventDefault, { capture: true });
    document.addEventListener("cut", preventDefault, { capture: true });
    document.addEventListener("dragstart", preventDefault, { capture: true });
    document.addEventListener("selectstart", preventDefault, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", preventDefault, { capture: true } as any);
      document.removeEventListener("copy", preventDefault, { capture: true } as any);
      document.removeEventListener("cut", preventDefault, { capture: true } as any);
      document.removeEventListener("dragstart", preventDefault, { capture: true } as any);
      document.removeEventListener("selectstart", preventDefault, { capture: true } as any);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(backPath)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Live Classes
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{cls?.name || "Recording"}</h1>
          <p className="mt-1 text-slate-600">{cls?.subject}</p>
        </div>
        <Badge className="flex items-center gap-1 self-start bg-indigo-600 hover:bg-indigo-600">
          <Shield className="h-3 w-3" />
          Protected Playback
        </Badge>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-black">
        <CardContent className="p-0">
          <div className="relative aspect-video bg-slate-900">
            <div className="absolute right-3 top-3 z-10">
              <label className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
                <span className="font-medium">Speed</span>
                <select
                  className="bg-transparent outline-none"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </label>
            </div>

            {playbackUrl ? (
              <video
                ref={videoRef}
                src={playbackUrl}
                className="h-full w-full"
                controls
                controlsList="nodownload noremoteplayback noplaybackrate"
                disablePictureInPicture
                playsInline
                onContextMenu={(e) => e.preventDefault()}
              >
                Your browser does not support the video tag.
              </video>
            ) : null}

            {loading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900">
                <div className="flex items-center gap-2 text-sm text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Preparing secure playback link…
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="absolute inset-0 z-20 flex h-full w-full items-center justify-center bg-slate-900 p-6">
                <div className="max-w-sm space-y-3 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
                  <p className="font-semibold text-white">Could not load recording</p>
                  <p className="text-sm text-slate-400">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-500 text-white hover:bg-slate-800"
                    onClick={() => void loadUrl()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">Protected link</p>
                <p className="mt-1 text-xs text-amber-800">
                  This playback link is generated just for your account and expires automatically. Downloading,
                  recording, or sharing this link is against the terms of use.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
