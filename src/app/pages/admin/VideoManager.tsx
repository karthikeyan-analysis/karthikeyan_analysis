import { useState } from "react";
import { useData } from "../../context/DataContext";
import type { VisibilityType } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Upload,
  Video as VideoIcon,
  Trash2,
  Globe,
  Users as UsersIcon,
  Play,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function VideoManager() {
  const { videos, batches, addVideo, deleteVideo, students } = useData();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isVisibilityDialogOpen, setIsVisibilityDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail: "",
    duration: "",
  });

  const [visibilitySettings, setVisibilitySettings] = useState<{
    type: VisibilityType;
    selectedStudents: string[];
    selectedBatch: string;
  }>({
    type: "ALL",
    selectedStudents: [],
    selectedBatch: "",
  });

  const [searchQuery, setSearchQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addVideo({
      ...formData,
      visibilityType: visibilitySettings.type,
      selectedStudents:
        visibilitySettings.type === "SELECTIVE"
          ? visibilitySettings.selectedStudents
          : undefined,
      batchId:
        visibilitySettings.type === "BATCH"
          ? visibilitySettings.selectedBatch
          : undefined,
    });

    setFormData({ title: "", description: "", thumbnail: "", duration: "" });
    setVisibilitySettings({
      type: "ALL",
      selectedStudents: [],
      selectedBatch: "",
    });
    setIsUploadDialogOpen(false);
    setIsVisibilityDialogOpen(false);
  };

  const toggleStudentSelection = (studentId: string) => {
    setVisibilitySettings((prev) => ({
      ...prev,
      selectedStudents: prev.selectedStudents.includes(studentId)
        ? prev.selectedStudents.filter((id) => id !== studentId)
        : [...prev.selectedStudents, studentId],
    }));
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this video?")) {
      deleteVideo(id);
    }
  };

  const getBatchName = (batchId?: string) => {
    if (!batchId) return "Unknown";
    return batches.find((b) => b.id === batchId)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Video Manager
          </h1>
          <p className="text-slate-600 mt-1">
            Upload and manage secure course videos
          </p>
        </div>

        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Upload className="w-4 h-4 mr-2" />
              Upload Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Course Video</DialogTitle>
              <DialogDescription>
                Add a new secure video with metadata
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <VideoIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-sm font-medium text-slate-700">
                    Upload Video File
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    MP4, WebM, or MOV format (HLS encryption recommended)
                  </p>
                  <input type="file" className="hidden" accept="video/*" />
                  <Button type="button" variant="outline" className="mt-4">
                    Choose File
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-title">Video Title</Label>
                  <Input
                    id="video-title"
                    placeholder="Enter video title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-description">Description</Label>
                  <Textarea
                    id="video-description"
                    placeholder="Describe what students will learn..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      placeholder="e.g., 45:30"
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData({ ...formData, duration: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thumbnail">Thumbnail URL</Label>
                    <Input
                      id="thumbnail"
                      placeholder="https://..."
                      value={formData.thumbnail}
                      onChange={(e) =>
                        setFormData({ ...formData, thumbnail: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsVisibilityDialogOpen(true)}
                  >
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Configure Visibility Settings
                    {visibilitySettings.type === "SELECTIVE" && (
                      <Badge variant="secondary" className="ml-2">
                        {visibilitySettings.selectedStudents.length} students
                        selected
                      </Badge>
                    )}
                  </Button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900 font-medium mb-2">
                    Security Recommendations
                  </p>
                  <ul className="text-xs text-amber-800 space-y-1">
                    <li>• Use HLS encryption (AES-128) for video protection</li>
                    <li>• Generate signed URLs with expiration</li>
                    <li>• Store videos in private cloud storage</li>
                    <li>• Dynamic watermarks will be applied automatically</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Upload Video
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Visibility Settings Dialog */}
        <Dialog
          open={isVisibilityDialogOpen}
          onOpenChange={setIsVisibilityDialogOpen}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Video Visibility Settings</DialogTitle>
              <DialogDescription>
                Choose who can access this video
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <button
                  type="button"
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    visibilitySettings.type === "ALL"
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() =>
                    setVisibilitySettings({
                      type: "ALL",
                      selectedStudents: [],
                      selectedBatch: "",
                    })
                  }
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="font-medium text-slate-900">
                        Public (All Students)
                      </p>
                      <p className="text-sm text-slate-600">
                        Available to all enrolled students
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    visibilitySettings.type === "BATCH"
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() =>
                    setVisibilitySettings({
                      ...visibilitySettings,
                      type: "BATCH",
                    })
                  }
                >
                  <div className="flex items-center gap-3">
                    <UsersIcon className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="font-medium text-slate-900">
                        Batch Specific
                      </p>
                      <p className="text-sm text-slate-600">
                        Available to students in a specific batch
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    visibilitySettings.type === "SELECTIVE"
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() =>
                    setVisibilitySettings({
                      ...visibilitySettings,
                      type: "SELECTIVE",
                    })
                  }
                >
                  <div className="flex items-center gap-3">
                    <UsersIcon className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="font-medium text-slate-900">
                        Selective (Specific Students)
                      </p>
                      <p className="text-sm text-slate-600">
                        Choose individual students
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {visibilitySettings.type === "BATCH" && (
                <div className="mt-4 space-y-3">
                  <Label>Select Batch</Label>
                  <Select
                    value={visibilitySettings.selectedBatch}
                    onValueChange={(value) =>
                      setVisibilitySettings({
                        ...visibilitySettings,
                        selectedBatch: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name} ({batch.studentCount} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {visibilitySettings.type === "SELECTIVE" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Select Students</Label>
                    <span className="text-sm text-slate-600">
                      {visibilitySettings.selectedStudents.length} selected
                    </span>
                  </div>
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={visibilitySettings.selectedStudents.includes(
                            student.id,
                          )}
                          onCheckedChange={() =>
                            toggleStudentSelection(student.id)
                          }
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{student.name}</p>
                          <p className="text-xs text-slate-600">
                            {student.email}
                          </p>
                        </div>
                        <Badge variant="outline">{student.studentId}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVisibilityDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setIsVisibilityDialogOpen(false)}
              >
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Video Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="border border-slate-200 rounded-lg overflow-hidden hover:border-indigo-200 transition-all group"
              >
                <div className="relative aspect-video bg-slate-900">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-slate-900 ml-1" />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/60 text-white hover:bg-black/60">
                      <Clock className="w-3 h-3 mr-1" />
                      {video.duration}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-slate-900 mb-1">
                    {video.title}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                    {video.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={
                        video.visibilityType === "ALL" ? "default" : "secondary"
                      }
                      className={
                        video.visibilityType === "ALL"
                          ? "bg-green-100 text-green-800"
                          : ""
                      }
                    >
                      {video.visibilityType === "ALL" ? (
                        <>
                          <Globe className="w-3 h-3 mr-1" />
                          Public
                        </>
                      ) : video.visibilityType === "BATCH" ? (
                        <>
                          <UsersIcon className="w-3 h-3 mr-1" />
                          {getBatchName(video.batchId)}
                        </>
                      ) : (
                        <>
                          <UsersIcon className="w-3 h-3 mr-1" />
                          {video.selectedStudents?.length}
                        </>
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(video.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
