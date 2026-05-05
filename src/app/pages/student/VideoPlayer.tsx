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
  const watermarkRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const video = videos.find((v) => v.id === id);

  useEffect(() => {
    // Animate watermark position
    if (watermarkRef.current) {
      let x = 10;
      let y = 10;
      let dx = 1;
      let dy = 1;

      const animate = () => {
        if (!watermarkRef.current) return;
        
        const maxX = window.innerWidth - 300;
        const maxY = window.innerHeight - 100;

        x += dx;
        y += dy;

        if (x <= 0 || x >= maxX) dx = -dx;
        if (y <= 0 || y >= maxY) dy = -dy;

        watermarkRef.current.style.left = `${x}px`;
        watermarkRef.current.style.top = `${y}px`;

        requestAnimationFrame(animate);
      };

      animate();
    }
  }, []);

  // Harden player interaction and common download/devtool shortcuts
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
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
    if (videoElement) {
      videoElement.addEventListener("contextmenu", preventContextMenu);
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (videoElement) {
        videoElement.removeEventListener("contextmenu", preventContextMenu);
      }
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{video.title}</h1>
            <p className="text-slate-600 mt-1">{video.description}</p>
          </div>
          <Badge className="bg-indigo-600 hover:bg-indigo-600 flex items-center gap-1">
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
              {/* Video Element */}
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                controlsList="nodownload noremoteplayback noplaybackrate"
                disablePictureInPicture
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                poster={video.thumbnail}
                onContextMenu={(e) => e.preventDefault()}
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Dynamic Watermark Overlay */}
              {isPlaying && (
                <div
                  ref={watermarkRef}
                  className="fixed pointer-events-none z-50"
                  style={{
                    opacity: 0.7,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "white",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                    padding: "8px 12px",
                    backgroundColor: "rgba(0,0,0,0.4)",
                    borderRadius: "6px",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <div>{user?.studentId}</div>
                  <div className="text-xs">{user?.email}</div>
                </div>
              )}
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
