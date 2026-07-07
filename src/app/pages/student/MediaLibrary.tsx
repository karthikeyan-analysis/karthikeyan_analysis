import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ChevronDown, ChevronRight, FileText, Film, Folder, FolderOpen, Lock, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";

export default function MediaLibrary() {
  const { user } = useAuth();
  const { content, videos, batches } = useData();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());

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
    return [...batchContent, ...batchVideos].sort(
      (a, b) =>
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime(),
    );
  }, [batchContent, batchVideos]);

  const availableSubjects = useMemo(() => {
    const batchSubjects = (currentBatch?.subjects || []).map((s) => s.trim()).filter(Boolean);
    // Also collect subjects actually present in media so folders exist even when
    // the batch's subjects list is empty or missing.
    const mediaSubjects = [
      ...new Set(allMedia.map((item) => (item as any).subject?.trim()).filter(Boolean)),
    ] as string[];
    const combined = [...new Set([...batchSubjects, ...mediaSubjects])];
    if (!combined.includes("Uncategorized")) combined.push("Uncategorized");
    return combined;
  }, [currentBatch?.subjects, allMedia]);

  const groupedMediaBySubject = useMemo(() => {
    // Case-insensitive lookup so "Maths" and "maths" map to the same folder.
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
      // Disable Ctrl+S, Ctrl+Shift+I, Ctrl+I, F12, Ctrl+C, Ctrl+X
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
          This content is protected. Downloads, screenshots, and screen
          recording are disabled. Content is for viewing only.
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
                        {items.map((item) => {
                          const isVideo = "videoUrl" in item;
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
                                    {isVideo ? "Video" : "PDF"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-600 mb-1">
                                  {item.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                  <span>Uploaded: {item.uploadDate}</span>
                                  {isVideo && "duration" in item && (
                                    <span>Duration: {item.duration}</span>
                                  )}
                                </div>
                              </div>

                              {/* Action Button */}
                              <div className="flex-shrink-0 sm:self-auto self-stretch">
                                <Button
                                  onClick={() => {
                                    if (isVideo) {
                                      navigate(`/student/video/${item.id}`);
                                      return;
                                    }
                                    if ("fileUrl" in item && item.fileUrl) {
                                      navigate(`/student/pdf/${item.id}`);
                                    }
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap w-full sm:w-auto"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
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
    </div>
  );
}
