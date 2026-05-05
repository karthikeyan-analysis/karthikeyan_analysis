import { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FileText, Film, Lock, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";

export default function MediaLibrary() {
  const { user } = useAuth();
  const { content, videos, batches } = useData();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current batch name
  const currentBatch = batches.find((b) => b.id === user?.batchId);

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

  const allMedia = [...batchContent, ...batchVideos].sort(
    (a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime(),
  );

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
        <div className="space-y-4">
          {allMedia.map((item) => {
            const isVideo = "videoUrl" in item;
            return (
              <Card
                key={item.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div
                      className="w-16 h-16 rounded-lg bg-gradient-to-br flex items-center justify-center"
                      style={{
                        backgroundImage: isVideo
                          ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                          : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                      }}
                    >
                      {isVideo ? (
                        <Film className="w-8 h-8 text-white" />
                      ) : (
                        <FileText className="w-8 h-8 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      <Badge variant={isVideo ? "default" : "secondary"}>
                        {isVideo ? "Video" : "PDF"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
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

                {/* Security Features Bar */}
                <div className="bg-slate-50 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 border-t">
                  <div className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Protected Content</span>
                  </div>
                  <span>•</span>
                  <span>No Download</span>
                  <span>•</span>
                  <span>No Screenshots</span>
                  <span>•</span>
                  <span>No Recording</span>
                </div>
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
