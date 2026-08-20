import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ArrowLeft, Shield, AlertTriangle, RefreshCw, Loader2, Download } from "lucide-react";
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
  const [selectedRecKey, setSelectedRecKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!id) return;
    return subscribeToLiveClass(id, setCls);
  }, [id]);

  const loadUrl = async (recKey?: string) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const targetKey = recKey || selectedRecKey || cls?.recordingKey;
      const { url } = await requestRecordingPlaybackUrl(id, { recordingKey: targetKey });
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
    if (cls?.recordings && cls.recordings.length > 0 && !selectedRecKey) {
      const firstKey = cls.recordings[0].key;
      setSelectedRecKey(firstKey);
      void loadUrl(firstKey);
    } else if (id && !playbackUrl && !loading) {
      void loadUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cls]);

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

      {cls?.recordings && cls.recordings.length > 1 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-700">Recording Parts:</span>
          {cls.recordings.map((rec, idx) => {
            const isSelected = selectedRecKey === rec.key || (!selectedRecKey && idx === 0);
            return (
              <Button
                key={rec.key}
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className={isSelected ? "bg-indigo-600 text-white font-bold text-xs" : "text-xs"}
                onClick={() => {
                  setSelectedRecKey(rec.key);
                  void loadUrl(rec.key);
                }}
              >
                Part {idx + 1} {rec.durationSec ? `(${Math.round(rec.durationSec / 60)}m)` : ""}
              </Button>
            );
          })}
        </div>
      ) : null}

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
                controlsList="noremoteplayback"
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

          <div className="border-t border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">Recorded Session Playback</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Stream securely or download the raw recording file directly to your device.
                </p>
              </div>
            </div>
            {playbackUrl ? (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 font-medium self-start sm:self-auto"
                onClick={async () => {
                  if (!cls?.id) return;
                  const safeName = (cls?.name || "recording").replace(/[^a-z0-9_-]/gi, "_");
                  const filename = `${safeName}_recording.webm`;
                  try {
                    let downloadUrl = "";
                    try {
                      const res = await requestRecordingPlaybackUrl(cls.id, {
                        disposition: "attachment",
                        filename,
                      });
                      if (res.url) downloadUrl = res.url;
                    } catch {
                      downloadUrl = playbackUrl;
                    }

                    try {
                      const response = await fetch(downloadUrl);
                      if (response.ok) {
                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                        return;
                      }
                    } catch {}

                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = filename;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      try {
                        document.body.removeChild(a);
                      } catch {}
                    }, 2000);
                  } catch (err) {
                    console.error("Student download error", err);
                  }
                }}
              >
                <Download className="mr-1.5 h-4 w-4" /> Download Recording
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
