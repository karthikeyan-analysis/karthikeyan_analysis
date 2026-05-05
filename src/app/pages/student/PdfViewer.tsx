import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ArrowLeft, Shield, FileText } from "lucide-react";

export default function PdfViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { content } = useData();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 24, y: 24 });
  const [watermarkStamp, setWatermarkStamp] = useState(
    new Date().toLocaleString(),
  );

  const file = content.find((item) => item.id === id);
  const userMark = useMemo(
    () => user?.studentId || user?.email || "student",
    [user?.studentId, user?.email],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefault = (e: Event) => e.preventDefault();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey && ["s", "p", "c", "x", "u"].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        key === "f12" ||
        key === "printscreen"
      ) {
        e.preventDefault();
      }
    };

    container.addEventListener("contextmenu", preventDefault);
    container.addEventListener("copy", preventDefault);
    container.addEventListener("cut", preventDefault);
    container.addEventListener("dragstart", preventDefault);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("contextmenu", preventDefault);
      container.removeEventListener("copy", preventDefault);
      container.removeEventListener("cut", preventDefault);
      container.removeEventListener("dragstart", preventDefault);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setWatermarkStamp(new Date().toLocaleString());
    }, 15000);

    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let x = 24;
    let y = 24;
    let vx = 0.6;
    let vy = 0.5;
    const pad = 16;
    const watermarkWidth = 240;
    const watermarkHeight = 56;

    const animate = () => {
      const bounds = container.getBoundingClientRect();
      const maxX = Math.max(pad, bounds.width - watermarkWidth - pad);
      const maxY = Math.max(pad, bounds.height - watermarkHeight - pad);

      x += vx;
      y += vy;

      if (x <= pad || x >= maxX) vx = -vx;
      if (y <= pad || y >= maxY) vy = -vy;

      setWatermarkPosition({ x, y });
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  if (!file || !file.fileUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            PDF not found
          </h2>
          <Button onClick={() => navigate("/student/media")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </div>
    );
  }
  const protectedPdfUrl = `${file.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div ref={containerRef} className="space-y-4 select-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/student/media")}
            className="mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">{file.title}</h1>
          <p className="text-slate-600 mt-1">{file.description}</p>
        </div>
        <Badge className="bg-indigo-600 hover:bg-indigo-600 flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Protected View
        </Badge>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <CardContent className="p-0 relative">
          <object
            data={protectedPdfUrl}
            type="application/pdf"
            className="w-full h-[78vh] bg-slate-100"
            aria-label={file.title}
          >
            <embed
              src={protectedPdfUrl}
              type="application/pdf"
              className="w-full h-[78vh] bg-slate-100"
            />
            <div className="h-[78vh] flex items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  PDF preview is unavailable in this browser.
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  Try updating Edge/Chrome or disable strict PDF blocking
                  policies in your browser settings.
                </p>
              </div>
            </div>
          </object>
          <div
            className="pointer-events-none absolute z-20 rounded-md bg-black/45 text-white text-xs px-3 py-2 backdrop-blur-sm border border-white/20"
            style={{
              left: `${watermarkPosition.x}px`,
              top: `${watermarkPosition.y}px`,
            }}
          >
            <div className="font-medium leading-tight">{userMark}</div>
            <div className="text-[10px] opacity-90 leading-tight">
              {watermarkStamp}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Protected mode is enabled: direct download controls are disabled and
        activity is restricted inside the viewer.
      </div>
    </div>
  );
}
