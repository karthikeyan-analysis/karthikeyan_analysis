import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ArrowLeft, Shield, Clock, CheckCircle } from "lucide-react";

export default function VideoPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { videos } = useData();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const video = videos.find((v) => v.id === id);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    // If user switches away from the tab/app, pause playback.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        videoRef.current?.pause();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Harden player interaction and common download/devtool shortcuts
  useEffect(() => {
    const preventDefault = (e: Event) => {
      e.preventDefault();
    };

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

    const videoElement = videoRef.current;
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

  if (!video) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Video not found</h2>
          <Button onClick={() => navigate("/student/media")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/student/media")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 truncate">
              {video.title}
            </h1>
            <p className="text-slate-600 mt-1">{video.description}</p>
          </div>
          <Badge className="bg-indigo-600 hover:bg-indigo-600 flex items-center gap-1 self-start">
            <Shield className="w-3 h-3" />
            Secure Stream
          </Badge>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative">
        <Card className="border-slate-200 overflow-hidden bg-black">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-slate-900">
              {/* Custom speed control (native menu disabled via controlsList) */}
              <div className="absolute top-3 right-3 z-10">
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
                    <option value={3}>3x</option>
                  </select>
                </label>
              </div>
              {/* Video Element */}
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                controlsList="nodownload noremoteplayback noplaybackrate"
                disablePictureInPicture
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                poster={video.thumbnail}
                onContextMenu={(e) => e.preventDefault()}
                onLoadedMetadata={() => {
                  if (videoRef.current) videoRef.current.playbackRate = playbackRate;
                }}
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

            </div>

            {/* Security Notice */}
            <div className="bg-amber-50 border-t border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Protected Content</p>
                  <p className="text-xs text-amber-800 mt-1">
                    This video is encrypted and watermarked with your student ID. Recording or sharing this content is prohibited and traceable.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Video Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-200 lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">About this video</h2>
            <p className="text-slate-700 mb-4">{video.description}</p>
            <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4" />
                Duration: {video.duration}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4" />
                Published: {video.uploadDate}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Security Features</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">HLS Encryption</p>
                  <p className="text-xs text-slate-600">Video chunks are encrypted</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Dynamic Watermark</p>
                  <p className="text-xs text-slate-600">Your ID overlays the video</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">No Downloads</p>
                  <p className="text-xs text-slate-600">Download disabled</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Expiring URLs</p>
                  <p className="text-xs text-slate-600">Time-limited access</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
