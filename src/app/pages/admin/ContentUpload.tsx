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
  FileText,
  Trash2,
  Globe,
  Users as UsersIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function ContentUpload() {
  const { content, batches, addContent, deleteContent, students } = useData();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isVisibilityDialogOpen, setIsVisibilityDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "pdf" as "pdf" | "doc" | "note",
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // In a real app, handle file upload here
    console.log("Files dropped:", e.dataTransfer.files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addContent({
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

    setFormData({ title: "", description: "", type: "pdf" });
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
    if (confirm("Are you sure you want to delete this content?")) {
      deleteContent(id);
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
            Content Upload Hub
          </h1>
          <p className="text-slate-600 mt-1">
            Upload and manage course materials
          </p>
        </div>

        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Upload className="w-4 h-4 mr-2" />
              Upload Content
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload New Content</DialogTitle>
              <DialogDescription>
                Add course materials, notes, or documents
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Drag and Drop Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-300"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-sm font-medium text-slate-700">
                    Drag and drop files here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    or click to browse (PDF, DOC, DOCX)
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    multiple
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter content title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the content..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Content Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as any })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="doc">Word Document</SelectItem>
                      <SelectItem value="note">Course Notes</SelectItem>
                    </SelectContent>
                  </Select>
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
                  Upload Content
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
              <DialogTitle>Visibility Settings</DialogTitle>
              <DialogDescription>
                Choose who can access this content
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
          <CardTitle>Uploaded Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {content.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-indigo-200 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{item.title}</h3>
                    <p className="text-sm text-slate-600">{item.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {item.type.toUpperCase()}
                      </Badge>
                      <Badge
                        variant={
                          item.visibilityType === "ALL"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          item.visibilityType === "ALL"
                            ? "bg-green-100 text-green-800"
                            : ""
                        }
                      >
                        {item.visibilityType === "ALL" ? (
                          <>
                            <Globe className="w-3 h-3 mr-1" />
                            Public
                          </>
                        ) : item.visibilityType === "BATCH" ? (
                          <>
                            <UsersIcon className="w-3 h-3 mr-1" />
                            {getBatchName(item.batchId)}
                          </>
                        ) : (
                          <>
                            <UsersIcon className="w-3 h-3 mr-1" />
                            {item.selectedStudents?.length} Students
                          </>
                        )}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {item.uploadDate}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
