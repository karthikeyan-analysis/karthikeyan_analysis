import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useNavigate } from "react-router";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { requestRecordingPlaybackUrl } from "../../features/liveClasses/recordingPlayback";
import {
  Card,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ChevronDown, ChevronRight, FileText, Film, Folder, FolderOpen, Lock, Eye, PlayCircle, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";

export default function MediaLibrary() {
  const { user } = useAuth();
  const { content, videos, batches } = useData();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());

  const [liveClassRecordings, setLiveClassRecordings] = useState<any[]>([]);

  // Student Video Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Subscribe to Live Class recordings from Firestore
  useEffect(() => {
    const q = query(collection(db, "liveClasses"));
    const unsub = onSnapshot(q, (snap) => {
      const recs: any[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const classId = docSnap.id;
        const subject = data.subject || "Test Discussion";
        const title = data.name || "Live Class Session";
        const batchId = data.batchId;
        const batchIds = Array.isArray(data.batchIds) ? data.batchIds : [];

        // Check if student belongs to this batch (if restricted)
        if (
          user?.batchId &&
          batchId &&
          batchId !== user.batchId &&
          batchIds.length > 0 &&
          !batchIds.includes(user.batchId)
        ) {
          return;
        }

        if (Array.isArray(data.recordings) && data.recordings.length > 0) {
          data.recordings.forEach((r: any) => {
            recs.push({
              id: r.id || `${classId}_${r.key}`,
              classId,
              title: r.name ? `${title} (${r.name})` : title,
              subject,
              uploadDate: r.createdAt
                ? new Date(r.createdAt).toLocaleDateString("en-IN")
                : new Date().toLocaleDateString("en-IN"),
              downloadUrl: r.downloadUrl,
              recordingKey: r.key,
              visibilityType: "ALL",
              isLiveRecording: true,
              description: `Recorded live session (${Math.round((r.durationSec || 0) / 60)} mins)`,
            });
          });
        } else if (data.recordingKey || data.recordingDownloadUrl) {
          recs.push({
            id: `rec_${classId}`,
            classId,
            title,
            subject,
            uploadDate: data.endedAt
              ? new Date(data.endedAt).toLocaleDateString("en-IN")
              : new Date().toLocaleDateString("en-IN"),
            downloadUrl: data.recordingDownloadUrl,
            recordingKey: data.recordingKey,
            visibilityType: "ALL",
            isLiveRecording: true,
            description: "Recorded live class session",
          });
        }
      });
      setLiveClassRecordings(recs);
    });
    return () => unsub();
  }, [user?.batchId]);

  // Get current batch name
  const currentBatch = batches.find((b) => b.id === user?.batchId);

  // Collapse all folders when the student's batch changes
  useEffect(() => {
    setOpenSubjects(new Set());
  }, [user?.batchId]);

  const toggleSubject = (subject: string) => {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      next.has(subject) ? next.delete(subject) : next.add(subject);
      return next;
    });
  };

  const canAccessItem = (item: {
    visibilityType: "ALL" | "SELECTIVE" | "BATCH";
    batchId?: string;
    selectedStudents?: string[];
  }) => {
    if (!user) return false;
    if (item.visibilityType === "ALL") return true;
    if (item.visibilityType === "BATCH") return !!user.batchId && item.batchId === user.batchId;
    return (
      item.selectedStudents?.includes(user.studentRecordId || "") ||
      item.selectedStudents?.includes(user.id) ||
      false
    );
  };

  const batchContent = content.filter((c) => canAccessItem(c));
  const batchVideos = videos.filter((v) => canAccessItem(v));

  const allMedia = useMemo(() => {
    return [...batchContent, ...batchVideos, ...liveClassRecordings].sort(
      (a, b) =>
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime(),
    );
  }, [batchContent, batchVideos, liveClassRecordings]);

  const availableSubjects = useMemo(() => {
    const batchSubjects = (currentBatch?.subjects || []).map((s) => s.trim()).filter(Boolean);
    const seenNorm = new Set(batchSubjects.map((s) => s.toLowerCase()));
    const extraSubjects: string[] = [];
    for (const item of allMedia) {
      const s: string | undefined = (item as any).subject?.trim();
      if (s && !seenNorm.has(s.toLowerCase())) {
        seenNorm.add(s.toLowerCase());
        extraSubjects.push(s);
      }
    }
    const combined = [...batchSubjects, ...extraSubjects];
    if (!combined.some((s) => s.toLowerCase() === "uncategorized")) combined.push("Uncategorized");
    return combined;
  }, [currentBatch?.subjects, allMedia]);

  const groupedMediaBySubject = useMemo(() => {
    const normalise = (v?: string) => v?.trim().toLowerCase() || "";
    const subjectByNorm = new Map(availableSubjects.map((s) => [normalise(s), s]));

    const groups = new Map<string, typeof allMedia>();
    for (const s of availableSubjects) groups.set(s, []);

    for (const item of allMedia) {
      const norm = normalise((item as any).subject);
      const canonicalKey = norm ? (subjectByNorm.get(norm) ?? "Uncategorized") : "Uncategorized";
      groups.get(canonicalKey)!.push(item);
    }

    return availableSubjects.map((s) => [s, groups.get(s) || []] as const);
  }, [allMedia, availableSubjects]);

  const handleStudentPreview = async (item: any) => {
    setPreviewTitle(item.title);
    setLoadingPreview(true);
    setPreviewOpen(true);
    setPreviewUrl("");

    let rawUrl = item.downloadUrl;
    if (!rawUrl && item.classId) {
      try {
        const { url } = await requestRecordingPlaybackUrl(item.classId, {
          recordingKey: item.recordingKey,
        });
        if (url) rawUrl = url;
      } catch (e) {
        console.warn("Student playback URL error:", e);
      }
    }

    if (!rawUrl) {
      alert("Recording video is currently processing or unavailable.");
      setPreviewOpen(false);
      setLoadingPreview(false);
      return;
    }

    const cleanUrl = rawUrl.replace(/%0D%0A/gi, "").replace(/[\r\n]/g, "").trim();
    setPreviewUrl(cleanUrl);
    setLoadingPreview(false);
  };

  // Disable right-click, copying, and keyboard shortcuts for security
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key === "s") ||
        (e.ctrlKey && e.shiftKey && e.key === "i") ||
        (e.ctrlKey && e.key === "i") ||
        e.key === "F12" ||
        (e.ctrlKey && e.key === "c") ||
        (e.ctrlKey && e.key === "x")
      ) {
        e.preventDefault();
        return false;
      }
    };

    container.addEventListener("contextmenu", handleContextMenu);
    container.addEventListener("copy", handleCopy);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("contextmenu", handleContextMenu);
      container.removeEventListener("copy", handleCopy);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-900">Media Library</h1>
        <Alert>
          <AlertTitle>Not Logged In</AlertTitle>
          <AlertDescription>
            Please sign in to view your learning materials.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6 select-none">
      {/* Security Notice */}
      <Alert className="border-amber-200 bg-amber-50">
        <Lock className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900">Secured Content</AlertTitle>
        <AlertDescription className="text-amber-800">
          This content is protected. Content is for viewing only.
        </AlertDescription>
      </Alert>

      {allMedia.length > 0 ? (
        <div className="space-y-3">
          {groupedMediaBySubject.map(([subjectName, items]) => {
            const isOpen = openSubjects.has(subjectName);
            return (
              <Card key={subjectName} className="border-slate-200 overflow-hidden">
                {/* Folder header — click to open/close */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition text-left select-none"
                  onClick={() => toggleSubject(subjectName)}
                >
                  <span className="text-indigo-500">
                    {isOpen
                      ? <FolderOpen className="w-5 h-5" />
                      : <Folder className="w-5 h-5" />}
                  </span>
                  <span className="flex-1 font-semibold text-slate-800">
                    {subjectName}
                  </span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-slate-400 ml-1">
                    {isOpen
                      ? <ChevronDown className="w-5 h-5" />
                      : <ChevronRight className="w-5 h-5" />}
                  </span>
                </button>

                {/* Items — only rendered when folder is open */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {items.length === 0 ? (
                      <p className="p-6 text-center text-sm text-slate-500">
                        No materials in this subject yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {items.map((item: any) => {
                          const isVideo = "videoUrl" in item || item.isLiveRecording;
                          return (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50/60 transition-colors"
                            >
                              {/* Icon */}
                              <div className="flex-shrink-0">
                                <div
                                  className="w-14 h-14 rounded-lg flex items-center justify-center"
                                  style={{
                                    backgroundImage: isVideo
                                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                      : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                                  }}
                                >
                                  {isVideo
                                    ? <Film className="w-7 h-7 text-white" />
                                    : <FileText className="w-7 h-7 text-white" />}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-slate-900">
                                    {item.title}
                                  </h3>
                                  <Badge variant={isVideo ? "default" : "secondary"}>
                                    {item.isLiveRecording ? "Live Class Recording" : isVideo ? "Video" : "PDF"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-600 mb-1">
                                  {item.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                  <span>Uploaded: {item.uploadDate}</span>
                                </div>
                              </div>

                              {/* Action Button */}
                              <div className="flex-shrink-0 sm:self-auto self-stretch">
                                <Button
                                  onClick={() => {
                                    if (item.isLiveRecording) {
                                      void handleStudentPreview(item);
                                      return;
                                    }
                                    if (isVideo) {
                                      navigate(`/student/video/${item.id}`);
                                      return;
                                    }
                                    if ("fileUrl" in item && item.fileUrl) {
                                      navigate(`/student/pdf/${item.id}`);
                                    }
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap w-full sm:w-auto font-medium"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Content
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-8 text-center pb-8">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">No Materials Yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Your instructor will upload course materials soon
            </p>
          </CardContent>
        </Card>
      )}

      {/* Student Video Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-indigo-600" />
              Recording Preview: {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {loadingPreview ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                Loading live class video stream…
              </div>
            ) : previewUrl ? (
              <div className="overflow-hidden rounded-xl bg-black border border-slate-800 aspect-video flex items-center justify-center">
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className="w-full h-full max-h-[480px]"
                />
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Recording video is currently processing or unavailable.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {previewUrl ? (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 font-medium"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = previewUrl;
                  a.download = `${previewTitle}_recording.webm`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download Video File
              </Button>
            ) : <div />}
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
