import React, { useMemo, useRef, useState } from "react";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import {
  Trash2,
  FileText,
  Plus,
  FileVideo,
  Users,
  Layers3,
  CalendarClock,
  Search,
} from "lucide-react";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "../../../config/firebase";

function sanitizeStorageFileName(originalName: string) {
  const trimmed = (originalName || "file").trim();
  const parts = trimmed.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()}` : "";
  const base = parts.join(".") || "file";
  const safeBase = base
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const safeExt = ext.replace(/[^\w.]+/g, "").slice(0, 10);
  return `${safeBase || "file"}${safeExt}`;
}

export default function MediaManager() {
  const {
    batches,
    content,
    videos,
    addContent,
    addVideo,
    deleteContent,
    deleteVideo,
  } = useData();
  const [selectedBatch, setSelectedBatch] = useState<string>(
    batches[0]?.id || "",
  );
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoBytes, setVideoBytes] = useState<{ transferred: number; total: number } | null>(null);
  const [videoSpeedBps, setVideoSpeedBps] = useState<number | null>(null);
  const [videoEtaSeconds, setVideoEtaSeconds] = useState<number | null>(null);
  const [videoUploadState, setVideoUploadState] = useState<
    "idle" | "running" | "paused" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    kind: "video" | "doc";
  } | null>(null);
  const [resultPopup, setResultPopup] = useState<{
    open: boolean;
    title: string;
    message: string;
    tone: "success" | "error";
  }>({ open: false, title: "", message: "", tone: "success" });
  const videoUploadTaskRef = useRef<ReturnType<typeof uploadBytesResumable> | null>(null);
  const videoMetricsRef = useRef<{ lastAt: number; lastBytes: number }>({
    lastAt: 0,
    lastBytes: 0,
  });

  const currentBatch = useMemo(() => {
    return batches.find((b) => b.id === selectedBatch);
  }, [batches, selectedBatch]);

  const availableSubjects = useMemo(() => {
    return (currentBatch?.subjects || []).map((s) => s.trim()).filter(Boolean);
  }, [currentBatch?.subjects]);

  const toSubjectKey = (value?: string) => value?.trim() || "Uncategorized";

  // Batch configured subjects first; always include "Uncategorized"
  const orderedSubjects = useMemo(() => {
    const base = [...availableSubjects];
    if (!base.includes("Uncategorized")) base.push("Uncategorized");
    return base;
  }, [availableSubjects]);

  const uploadFileToStorage = async (
    folder: "content" | "videos",
    file: File,
    onProgress?: (progress: number) => void,
  ) => {
    const safeName = sanitizeStorageFileName(file.name);
    const filePath = `${folder}/${Date.now()}-${safeName}`;
    const fileRef = ref(storage, filePath);
    if (folder === "videos") {
      return new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, file, {
          contentType: file.type || "video/mp4",
          cacheControl: "public,max-age=31536000",
        });
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            );
            onProgress?.(progress);
          },
          reject,
          async () => {
            resolve(await getDownloadURL(uploadTask.snapshot.ref));
          },
        );
      });
    }

    await uploadBytes(fileRef, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "public,max-age=31536000",
    });
    return getDownloadURL(fileRef);
  };

  const uploadVideoToStorage = async (file: File) => {
    const safeName = sanitizeStorageFileName(file.name);
    const filePath = `videos/${Date.now()}-${safeName}`;
    const fileRef = ref(storage, filePath);

    return await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type || "video/mp4",
        cacheControl: "public,max-age=31536000",
      });
      videoUploadTaskRef.current = uploadTask;
      videoMetricsRef.current = { lastAt: Date.now(), lastBytes: 0 };
      setVideoUploadState("running");

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          setVideoUploadProgress(progress);
          setVideoBytes({ transferred: snapshot.bytesTransferred, total: snapshot.totalBytes });

          const now = Date.now();
          const dt = Math.max(1, now - videoMetricsRef.current.lastAt);
          const db = Math.max(0, snapshot.bytesTransferred - videoMetricsRef.current.lastBytes);
          if (dt >= 900 && db > 0) {
            const bps = (db / dt) * 1000;
            setVideoSpeedBps(bps);
            const remaining = Math.max(0, snapshot.totalBytes - snapshot.bytesTransferred);
            setVideoEtaSeconds(bps > 0 ? Math.round(remaining / bps) : null);
            videoMetricsRef.current = { lastAt: now, lastBytes: snapshot.bytesTransferred };
          }

          if (snapshot.state === "paused") setVideoUploadState("paused");
          else setVideoUploadState("running");
        },
        (err) => {
          setVideoUploadState("error");
          reject(err);
        },
        async () => {
          setVideoUploadState("success");
          resolve(await getDownloadURL(uploadTask.snapshot.ref));
        },
      );
    });
  };

  const formatBytes = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB", "TB"] as const;
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
  };

  const formatEta = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const getFileBaseName = (file: File) =>
    file.name.replace(/\.[^/.]+$/, "").trim() || "Untitled";

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedBatch) {
      setError("Please select a batch.");
      return;
    }

    if (!selectedSubject) {
      setError("Please select a subject.");
      return;
    }

    if (!selectedPdfFile && !selectedVideoFile) {
      setError("Please select at least one file (PDF or Video).");
      return;
    }

    try {
      setIsUploading(true);
      setVideoUploadProgress(0);
      setVideoBytes(null);
      setVideoSpeedBps(null);
      setVideoEtaSeconds(null);
      setVideoUploadState("idle");
      const hasBothFiles = !!selectedPdfFile && !!selectedVideoFile;

      if (selectedPdfFile) {
        const fileUrl = await uploadFileToStorage("content", selectedPdfFile);
        const type = selectedPdfFile.name.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : "doc";
        const title =
          formData.title.trim() && !hasBothFiles
            ? formData.title.trim()
            : formData.title.trim()
              ? `${formData.title.trim()} (PDF)`
              : getFileBaseName(selectedPdfFile);
        await addContent({
          title,
          description: formData.description,
          type,
          visibilityType: "BATCH",
          batchId: selectedBatch,
          subject: selectedSubject,
          fileUrl,
        });
      }

      if (selectedVideoFile) {
        const videoUrl = await uploadVideoToStorage(selectedVideoFile);
        const title =
          formData.title.trim() && !hasBothFiles
            ? formData.title.trim()
            : formData.title.trim()
              ? `${formData.title.trim()} (Video)`
              : getFileBaseName(selectedVideoFile);

        await addVideo({
          title,
          description: formData.description,
          duration: "00:00",
          thumbnail: `https://placehold.co/640x360/0f172a/ffffff?text=${encodeURIComponent(title || "Video")}`,
          visibilityType: "BATCH",
          batchId: selectedBatch,
          subject: selectedSubject,
          videoUrl,
        });
      }

      setFormData({ title: "", description: "" });
      setSelectedPdfFile(null);
      setSelectedVideoFile(null);
      setSelectedSubject("");
      setVideoUploadProgress(0);
      setIsUploadDialogOpen(false);
    } catch (uploadError: any) {
      const code = uploadError?.code ? ` (${uploadError.code})` : "";
      const serverResponse = uploadError?.customData?.serverResponse
        ? `\n\nServer response:\n${String(uploadError.customData.serverResponse)}`
        : "";
      setError(
        (uploadError?.message ? `${uploadError.message}${code}` : `Upload failed${code}.`) +
          serverResponse,
      );
    } finally {
      setIsUploading(false);
      videoUploadTaskRef.current = null;
    }
  };

  const batchContent = selectedBatch
    ? [
        ...content.filter((c) => c.batchId === selectedBatch),
        ...videos.filter((v) => v.batchId === selectedBatch),
      ].sort(
        (a, b) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime(),
      )
    : [];

  const filteredBatchContent = useMemo(() => {
    return batchContent.filter((item) => {
      const normalizedSubject = item.subject?.trim() || "Uncategorized";
      const matchesSubject =
        subjectFilter === "all" || normalizedSubject === subjectFilter;
      const normalizedQuery = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery);
      return matchesSubject && matchesSearch;
    });
  }, [batchContent, subjectFilter, searchTerm]);

  const groupedMediaBySubject = useMemo(() => {
    const groups = new Map<string, typeof filteredBatchContent>();
    for (const subject of orderedSubjects) groups.set(subject, []);

    for (const item of filteredBatchContent) {
      const key = toSubjectKey(item.subject);
      if (groups.has(key)) {
        groups.get(key)!.push(item);
        continue;
      }
      // Upload has a subject not present in batch subjects: treat as Uncategorized
      groups.get("Uncategorized")!.push(item);
    }

    return orderedSubjects
      .filter((s) => subjectFilter === "all" || s === subjectFilter)
      .map((s) => [s, groups.get(s) || []] as const);
  }, [filteredBatchContent, orderedSubjects, subjectFilter]);
  const mediaCount = batchContent.length;
  const videoCount = batchContent.filter((item) => "videoUrl" in item).length;
  const documentCount = mediaCount - videoCount;

  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId);
    setSelectedSubject("");
    setSubjectFilter("all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Upload Media
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Media</DialogTitle>
              <DialogDescription>Upload PDF and video together in one go</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload}>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="batch">Select Batch</Label>
                  <Select
                    value={selectedBatch}
                    onValueChange={handleBatchChange}
                  >
                    <SelectTrigger id="batch">
                      <SelectValue placeholder="Select a batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Select Subject</Label>
                  <Select
                    value={selectedSubject}
                    onValueChange={setSelectedSubject}
                    disabled={!selectedBatch || availableSubjects.length === 0}
                  >
                    <SelectTrigger id="subject">
                      <SelectValue
                        placeholder={
                          availableSubjects.length === 0
                            ? "No subjects available for this batch"
                            : "Select a subject"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBatch && availableSubjects.length === 0 && (
                    <p className="text-xs text-amber-700">
                      This batch has no subjects yet. Add subjects in Batch Management first.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Optional: common title for selected files"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pdf-file">PDF Document</Label>
                    <label
                      htmlFor="pdf-file"
                      className="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:bg-slate-50 cursor-pointer transition"
                    >
                      <FileText className="w-8 h-8 mx-auto text-red-500 mb-2" />
                      <p className="text-sm text-slate-700 font-medium">
                        Select PDF file
                      </p>
                      <p className="text-xs text-slate-500 mt-1">.pdf supported</p>
                      <input
                        id="pdf-file"
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={(e) =>
                          setSelectedPdfFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                    {selectedPdfFile && (
                      <p className="text-xs text-slate-500 truncate">
                        Selected: {selectedPdfFile.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video-file">Video File</Label>
                    <label
                      htmlFor="video-file"
                      className="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:bg-slate-50 cursor-pointer transition"
                    >
                      <FileVideo className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
                      <p className="text-sm text-slate-700 font-medium">
                        Select video file
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        MP4, MOV, WebM, etc.
                      </p>
                      <input
                        id="video-file"
                        type="file"
                        className="hidden"
                        accept="video/*"
                        onChange={(e) =>
                          setSelectedVideoFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                    {selectedVideoFile && (
                      <p className="text-xs text-slate-500 truncate">
                        Selected: {selectedVideoFile.name}
                      </p>
                    )}
                  </div>
                </div>

                {isUploading && selectedVideoFile && (
                  <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                    <div className="flex items-center justify-between text-xs font-medium text-indigo-800">
                      <span>Video upload progress</span>
                      <span>{videoUploadProgress}%</span>
                    </div>
                    <Progress value={videoUploadProgress} className="h-2" />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-indigo-900">
                      <div className="flex flex-wrap items-center gap-3">
                        {videoBytes ? (
                          <span>
                            {formatBytes(videoBytes.transferred)} / {formatBytes(videoBytes.total)}
                          </span>
                        ) : null}
                        {videoSpeedBps ? <span>{formatBytes(videoSpeedBps)}/s</span> : null}
                        {videoEtaSeconds != null ? <span>ETA {formatEta(videoEtaSeconds)}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!videoUploadTaskRef.current || videoUploadState !== "running"}
                          onClick={() => {
                            videoUploadTaskRef.current?.pause();
                            setVideoUploadState("paused");
                          }}
                        >
                          Pause
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!videoUploadTaskRef.current || videoUploadState !== "paused"}
                          onClick={() => {
                            videoUploadTaskRef.current?.resume();
                            setVideoUploadState("running");
                          }}
                        >
                          Resume
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!videoUploadTaskRef.current}
                          onClick={() => {
                            videoUploadTaskRef.current?.cancel();
                            setVideoUploadState("idle");
                            setIsUploading(false);
                            setError("Upload cancelled.");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setSelectedPdfFile(null);
                    setSelectedVideoFile(null);
                    setSelectedSubject("");
                    setVideoUploadProgress(0);
                    setError("");
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload Selected Media"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            <Label htmlFor="batch-select">Select Batch</Label>
            <Select value={selectedBatch} onValueChange={handleBatchChange}>
              <SelectTrigger id="batch-select">
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label htmlFor="subject-filter">Filter by Subject</Label>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger id="subject-filter">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {availableSubjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
                {!availableSubjects.includes("Uncategorized") && (
                  <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label htmlFor="media-search">Search Uploads</Label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="media-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title or description"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Overview */}
      {currentBatch && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Active Batch
              </p>
              <p className="text-lg font-semibold text-slate-900 mt-1 truncate">
                {currentBatch.name}
              </p>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                {currentBatch.description?.trim() || "No batch description provided."}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Enrolled Students
                </p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {currentBatch.studentCount}
                </p>
              </div>
              <Users className="w-5 h-5 text-indigo-600" />
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total Uploads
                </p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {mediaCount}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {documentCount} docs, {videoCount} videos
                </p>
              </div>
              <Layers3 className="w-5 h-5 text-violet-600" />
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Schedule
                </p>
                <p className="text-sm font-medium text-slate-900 mt-1 line-clamp-2">
                  {currentBatch.schedule || "Not specified"}
                </p>
              </div>
              <CalendarClock className="w-5 h-5 text-emerald-600" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Media List By Subject */}
      <div className="space-y-5">
        {groupedMediaBySubject.map(([subjectName, subjectItems]) => (
          <Card key={subjectName} className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base text-slate-900">
                    {subjectName}
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    {subjectItems.length} upload{subjectItems.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant="outline" className="bg-white">
                  Subject
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {subjectItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-600">
                  No uploads for this subject yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {subjectItems.map((item) => {
                    const isVideo = "videoUrl" in item;
                    return (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-900">
                              {item.title}
                            </p>
                            <Badge variant={isVideo ? "default" : "secondary"}>
                              {isVideo ? "Video" : "PDF"}
                            </Badge>
                            <Badge variant="outline">{item.uploadDate}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {item.description || "No description provided."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 md:pl-4 md:shrink-0">
                          {"fileUrl" in item && item.fileUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(item.fileUrl, "_blank")}
                            >
                              Open File
                            </Button>
                          )}
                          {"videoUrl" in item && item.videoUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(item.videoUrl, "_blank")}
                            >
                              Play Video
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                id: item.id,
                                title: item.title,
                                kind: isVideo ? "video" : "doc",
                              })
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {groupedMediaBySubject.every(([, items]) => items.length === 0) && (
          <Card>
            <CardContent className="pt-6 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600">
                No uploads match your current filters
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Try changing subject/search filters or upload new media
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.kind === "video" ? "Video" : "Document"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  Are you sure you want to delete <span className="font-medium">{deleteTarget.title}</span>? This
                  can&apos;t be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  if (deleteTarget.kind === "video") await deleteVideo(deleteTarget.id);
                  else await deleteContent(deleteTarget.id);
                  setResultPopup({
                    open: true,
                    title: "Deleted",
                    message: `"${deleteTarget.title}" was deleted successfully.`,
                    tone: "success",
                  });
                } catch (e: any) {
                  setResultPopup({
                    open: true,
                    title: "Delete failed",
                    message: e?.message || "Could not delete the item. Please try again.",
                    tone: "error",
                  });
                } finally {
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result popup */}
      <Dialog
        open={resultPopup.open}
        onOpenChange={(open) => setResultPopup((p) => ({ ...p, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{resultPopup.title}</DialogTitle>
            <DialogDescription
              className={resultPopup.tone === "error" ? "text-rose-600" : "text-slate-600"}
            >
              {resultPopup.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setResultPopup((p) => ({ ...p, open: false }))}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
