import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import type { Student } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { UserPlus, Pencil, Trash2, Search, Upload, Loader2, FileSpreadsheet, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import * as XLSX from "xlsx";
import StudentAvatar from "../../components/StudentAvatar";
import { uploadStudentProfileImage } from "../../features/students/studentPhotoStorage";

function StudentPhotoFields({
  previewUrl,
  displayName,
  onPickFile,
  onRemove,
  canRemove,
}: {
  previewUrl: string | null;
  displayName: string;
  onPickFile: (file: File | null) => void;
  onRemove: () => void | Promise<void>;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Profile photo (optional)</Label>
      <div className="flex flex-wrap items-center gap-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-50"
          />
        ) : (
          <StudentAvatar name={displayName || "?"} size="lg" />
        )}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="max-w-[220px]"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) {
              onPickFile(null);
              return;
            }
            if (!f.type.startsWith("image/")) {
              onPickFile(null);
              return;
            }
            onPickFile(f);
          }}
        />
        {canRemove ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void onRemove()}>
            <X className="w-4 h-4 mr-1" />
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Stored in Firebase Storage. Visible when the student logs in, on tests, and on result PDFs.
      </p>
    </div>
  );
}

export default function StudentManagement() {
  const { students, batches, addStudent, updateStudent, deleteStudent, clearStudentPhoto } =
    useData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importBatchId, setImportBatchId] = useState<string>("");
  const [importStatus, setImportStatus] = useState<"active" | "inactive">("active");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<
    Array<{ studentId: string; name: string; email: string; enrolledDate?: string }>
  >([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    skipped: number;
    failed: number;
    failures: Array<{ email?: string; reason: string }>;
  } | null>(null);

  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    email: "",
    status: "active" as "active" | "inactive",
    batchId: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const blobPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    return () => {
      if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);
    };
  }, [blobPreviewUrl]);

  const photoPreviewDisplay = blobPreviewUrl || editingStudent?.photoURL || null;

  // Filter students by selected batch
  const batchFilteredStudents =
    selectedBatch === "all"
      ? students
      : students.filter((student) => student.batchId === selectedBatch);

  // Then filter by search query
  const filteredStudents = batchFilteredStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const existingEmailSet = useMemo(() => {
    return new Set(students.map((s) => s.email.trim().toLowerCase()).filter(Boolean));
  }, [students]);

  const normalizeEmail = (value: unknown) => {
    // Handle messy inputs like "name @ gmail . com"
    const raw = String(value || "");
    const noWhitespace = raw.replace(/\s+/g, "");
    const email = noWhitespace.trim().toLowerCase();
    return email;
  };

  const isLikelyEmail = (email: string) => {
    // Basic sanity check (not perfect, but good for import validation)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const normalizeHeader = (h: unknown) =>
    String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const guessFieldFromHeader = (header: string) => {
    const h = normalizeHeader(header);
    if (!h) return null;
    if (h.includes("email")) return "email";
    if (h.includes("student id") || h === "id" || h.includes("studentid")) return "studentId";
    if (h.includes("full name") || h.includes("name")) return "name";
    if (h.includes("enrolled") || h.includes("join") || h.includes("date")) return "enrolledDate";
    return null;
  };

  const buildStudentId = (email: string, index: number) => {
    const base = email.split("@")[0]?.replace(/[^a-z0-9]/gi, "")?.slice(0, 6) || "STU";
    const suffix = String(index + 1).padStart(3, "0");
    return `${base.toUpperCase()}${suffix}`;
  };

  const parseImportFile = async (file: File) => {
    setImportError("");
    setImportSummary(null);
    setImportRows([]);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const wsName = wb.SheetNames?.[0];
    if (!wsName) throw new Error("No sheets found in Excel file.");

    const ws = wb.Sheets[wsName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
      defval: "",
      raw: false,
    });
    if (!rows.length) throw new Error("No rows found in the first sheet.");

    // Determine mapping by looking at the first row's keys (headers)
    const headers = Object.keys(rows[0] || {});
    const mapping: Partial<Record<"studentId" | "name" | "email" | "enrolledDate", string>> = {};
    for (const h of headers) {
      const field = guessFieldFromHeader(h);
      if (field && !mapping[field]) mapping[field] = h;
    }

    if (!mapping.email) {
      throw new Error('Could not detect an "Email" column. Please ensure a header like "Email", "Email ID", etc.');
    }
    if (!mapping.name) {
      throw new Error('Could not detect a "Name" column. Please ensure a header like "Full Name" or "Name".');
    }

    const seenInFile = new Set<string>();

    const parsed = rows
      .map((r, idx) => {
        const email = normalizeEmail(r[mapping.email!]);
        const name = String(r[mapping.name!]).trim();
        const studentIdFromSheet = mapping.studentId ? String(r[mapping.studentId]).trim() : "";
        const enrolledDate = mapping.enrolledDate ? String(r[mapping.enrolledDate]).trim() : "";
        const studentId = studentIdFromSheet || (email ? buildStudentId(email, idx) : "");
        const duplicateInFile = email ? seenInFile.has(email) : false;
        if (email) seenInFile.add(email);
        return { studentId, name, email, enrolledDate: enrolledDate || undefined, duplicateInFile };
      })
      .filter((r) => r.email && r.name);

    if (!parsed.length) {
      throw new Error("No valid rows found. Make sure Email and Name cells are filled.");
    }

    // Keep duplicates in preview so user can see why rows may skip later
    setImportRows(parsed.map(({ duplicateInFile, ...rest }) => rest));
    if (parsed.some((p) => p.duplicateInFile)) {
      setImportError("Warning: Your Excel has duplicate emails. Duplicates will be skipped during import.");
    }
  };

  const runImport = async () => {
    setImportError("");
    setImportSummary(null);
    if (!importFile) {
      setImportError("Please choose an Excel file (.xlsx).");
      return;
    }
    if (!importBatchId) {
      setImportError("Please select a batch to assign these students.");
      return;
    }
    if (!importRows.length) {
      setImportError("No parsed rows to import. Upload the file again.");
      return;
    }

    setImporting(true);
    const failures: Array<{ email?: string; reason: string }> = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    const seenInFile = new Set<string>();

    for (const row of importRows) {
      const email = normalizeEmail(row.email);
      if (!email) {
        skipped += 1;
        failures.push({ reason: "Missing email" });
        continue;
      }
      if (!isLikelyEmail(email)) {
        skipped += 1;
        failures.push({ email, reason: "Invalid email format" });
        continue;
      }
      if (seenInFile.has(email)) {
        skipped += 1;
        failures.push({ email, reason: "Duplicate email in Excel file" });
        continue;
      }
      seenInFile.add(email);
      if (existingEmailSet.has(email)) {
        skipped += 1;
        failures.push({ email, reason: "Already exists in system (duplicate email)" });
        continue;
      }
      try {
        await addStudent({
          studentId: row.studentId,
          name: row.name,
          email,
          status: importStatus,
          batchId: importBatchId,
          enrolledDate: row.enrolledDate || new Date().toISOString().split("T")[0],
        });
        created += 1;
        existingEmailSet.add(email);
      } catch (e: any) {
        failed += 1;
        failures.push({ email, reason: e?.message || "Failed to create student" });
      }
    }

    setImportSummary({
      total: importRows.length,
      created,
      skipped,
      failed,
      failures,
    });
    setImporting(false);
  };

  const handleRemovePhoto = async () => {
    setPhotoFile(null);
    if (editingStudent) {
      try {
        await clearStudentPhoto(editingStudent.id);
        setEditingStudent((prev) => (prev ? { ...prev, photoURL: undefined } : null));
      } catch (err) {
        console.error(err);
        setError("Could not remove photo from storage.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, formData);
        if (photoFile) {
          const url = await uploadStudentProfileImage(editingStudent.id, photoFile);
          await updateStudent(editingStudent.id, { photoURL: url });
        }
        setEditingStudent(null);
      } else {
        const newId = await addStudent({
          ...formData,
          enrolledDate: new Date().toISOString().split("T")[0],
        });
        if (photoFile) {
          const url = await uploadStudentProfileImage(newId, photoFile);
          await updateStudent(newId, { photoURL: url });
        }
        setIsAddDialogOpen(false);
      }

      setPhotoFile(null);
      setFormData({
        studentId: "",
        name: "",
        email: "",
        status: "active",
        batchId: "",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save student");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setPhotoFile(null);
    setEditingStudent(student);
    setFormData({
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      status: student.status,
      batchId: student.batchId || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this student?")) {
      setIsLoading(true);
      setError("");
      try {
        await deleteStudent(id);
      } catch (err: any) {
        setError(err?.message || "Failed to delete student");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetForm = () => {
    setPhotoFile(null);
    setFormData({
      studentId: "",
      name: "",
      email: "",
      status: "active",
      batchId: "",
    });
    setEditingStudent(null);
    setError("");
  };

  const getBatchName = (batchId?: string) => {
    if (!batchId) return "Not Assigned";
    return batches.find((b) => b.id === batchId)?.name || "Unknown";
  };

  const getStudentCountByBatch = (batchId: string) => {
    return students.filter((s) => s.batchId === batchId).length;
  };

  const getUnassignedStudentCount = () => {
    return students.filter((s) => !s.batchId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? "Edit Student" : "Enroll New Student"}
              </DialogTitle>
              <DialogDescription>
                {editingStudent
                  ? "Update student information"
                  : "Add a new student to the portal"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    placeholder="STU2024XXX"
                    value={formData.studentId}
                    onChange={(e) =>
                      setFormData({ ...formData, studentId: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@edu.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch">Batch</Label>
                  <Select
                    value={formData.batchId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, batchId: value })
                    }
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
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as "active" | "inactive",
                      })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <StudentPhotoFields
                  previewUrl={blobPreviewUrl || null}
                  displayName={formData.name}
                  onPickFile={setPhotoFile}
                  onRemove={handleRemovePhoto}
                  canRemove={!!photoFile}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Saving..."
                    : editingStudent
                      ? "Update Student"
                      : "Add Student"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Import Excel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Import students from Excel</DialogTitle>
              <DialogDescription>
                Upload an <span className="font-medium">.xlsx</span> file and we will create students in bulk.
                The sheet must have columns like <span className="font-medium">Email</span> and <span className="font-medium">Name</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="space-y-4 py-2">
                {importError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {importError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Assign batch *</Label>
                    <Select value={importBatchId} onValueChange={setImportBatchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={importStatus} onValueChange={(v) => setImportStatus(v as "active" | "inactive")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Excel file (.xlsx) *</Label>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <Input
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={async (e) => {
                        const f = e.target.files?.[0] || null;
                        setImportFile(f);
                        setImportSummary(null);
                        setImportRows([]);
                        setImportError("");
                        if (!f) return;
                        try {
                          await parseImportFile(f);
                        } catch (err: any) {
                          setImportError(err?.message || "Failed to parse Excel.");
                        }
                      }}
                    />
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      First sheet will be imported
                    </div>
                  </div>
                </div>

                {importRows.length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        Preview ({importRows.length} rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importRows.slice(0, 10).map((r, idx) => (
                              <TableRow key={`${r.email}-${idx}`}>
                                <TableCell className="font-medium">{r.studentId}</TableCell>
                                <TableCell>{r.name}</TableCell>
                                <TableCell className="text-sm text-slate-600">{r.email}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {importRows.length > 10 && (
                        <p className="text-xs text-slate-500 mt-2">
                          Showing first 10 rows.
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        Duplicate emails already in the system will be skipped automatically.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {importSummary && (
                  <Card className="border-slate-200">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Import summary</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Total: {importSummary.total}</Badge>
                        <Badge className="bg-emerald-100 text-emerald-800">Created: {importSummary.created}</Badge>
                        <Badge className="bg-slate-100 text-slate-800">Skipped: {importSummary.skipped}</Badge>
                        {importSummary.failed > 0 ? (
                          <Badge className="bg-rose-100 text-rose-800">Failed: {importSummary.failed}</Badge>
                        ) : null}
                      </div>
                      {importSummary.failed > 0 && (
                        <div className="text-xs text-slate-600">
                          {importSummary.failures.slice(0, 5).map((f, idx) => (
                            <div key={idx}>
                              {f.email || "Row"}: {f.reason}
                            </div>
                          ))}
                          {importSummary.failures.length > 5 ? (
                            <div>…and {importSummary.failures.length - 5} more</div>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                  setImportRows([]);
                  setImportError("");
                  setImportSummary(null);
                }}
                disabled={importing}
              >
                Close
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => void runImport()}
                disabled={importing || !importRows.length}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Students"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Batch Tabs - Horizontal at Top */}
      <div className="border-b border-slate-200 bg-white rounded-lg">
        <Tabs
          value={selectedBatch}
          onValueChange={setSelectedBatch}
          className="w-full"
        >
          <div className="flex items-center justify-between px-6 pt-4">
            <TabsList className="flex gap-1 bg-transparent p-0 h-auto">
              {/* All Students Tab */}
              <TabsTrigger
                value="all"
                className="px-4 py-2 rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 bg-slate-100"
              >
                <div className="text-center">
                  <div className="font-medium text-sm">All Students</div>
                  <div className="text-xs text-slate-500">
                    {students.length}
                  </div>
                </div>
              </TabsTrigger>

              {/* Individual Batch Tabs */}
              {batches.map((batch) => {
                const studentCount = getStudentCountByBatch(batch.id);
                return (
                  <TabsTrigger
                    key={batch.id}
                    value={batch.id}
                    className="px-4 py-2 rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 bg-slate-100"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm truncate">
                        {batch.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {studentCount}
                      </div>
                    </div>
                  </TabsTrigger>
                );
              })}

              {/* Unassigned Students Tab */}
              {getUnassignedStudentCount() > 0 && (
                <TabsTrigger
                  value="unassigned"
                  className="px-4 py-2 rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 bg-slate-100"
                >
                  <div className="text-center">
                    <div className="font-medium text-sm">Not Assigned</div>
                    <div className="text-xs text-slate-500">
                      {getUnassignedStudentCount()}
                    </div>
                  </div>
                </TabsTrigger>
              )}
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* All Students Content */}
          <TabsContent value="all" className="px-6 pb-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Photo</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        editingStudent={editingStudent}
                        formData={formData}
                        setFormData={setFormData}
                        batches={batches}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSubmit={handleSubmit}
                        onReset={resetForm}
                        getBatchName={getBatchName}
                        photoPreviewUrl={
                          editingStudent?.id === student.id
                            ? photoPreviewDisplay
                            : student.photoURL || null
                        }
                        onPhotoPick={setPhotoFile}
                        onPhotoRemove={handleRemovePhoto}
                        canRemovePhoto={
                          editingStudent?.id === student.id
                            ? !!(photoFile || editingStudent.photoURL)
                            : false
                        }
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <p className="text-slate-500">No students found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Individual Batch Content */}
          {batches.map((batch) => (
            <TabsContent key={batch.id} value={batch.id} className="px-6 pb-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Photo</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <StudentRow
                          key={student.id}
                          student={student}
                          editingStudent={editingStudent}
                          formData={formData}
                          setFormData={setFormData}
                          batches={batches}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onSubmit={handleSubmit}
                          onReset={resetForm}
                          getBatchName={getBatchName}
                          showBatchColumn={false}
                          photoPreviewUrl={
                            editingStudent?.id === student.id
                              ? photoPreviewDisplay
                              : student.photoURL || null
                          }
                          onPhotoPick={setPhotoFile}
                          onPhotoRemove={handleRemovePhoto}
                          canRemovePhoto={
                            editingStudent?.id === student.id
                              ? !!(photoFile || editingStudent.photoURL)
                              : false
                          }
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <p className="text-slate-500">
                            No students in this batch
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}

          {/* Unassigned Students Content */}
          {getUnassignedStudentCount() > 0 && (
            <TabsContent value="unassigned" className="px-6 pb-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Photo</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <StudentRow
                          key={student.id}
                          student={student}
                          editingStudent={editingStudent}
                          formData={formData}
                          setFormData={setFormData}
                          batches={batches}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onSubmit={handleSubmit}
                          onReset={resetForm}
                          getBatchName={getBatchName}
                          showBatchColumn={false}
                          photoPreviewUrl={
                            editingStudent?.id === student.id
                              ? photoPreviewDisplay
                              : student.photoURL || null
                          }
                          onPhotoPick={setPhotoFile}
                          onPhotoRemove={handleRemovePhoto}
                          canRemovePhoto={
                            editingStudent?.id === student.id
                              ? !!(photoFile || editingStudent.photoURL)
                              : false
                          }
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <p className="text-slate-500">
                            No unassigned students
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// Student Row Component
interface StudentRowProps {
  student: Student;
  editingStudent: Student | null;
  formData: any;
  setFormData: any;
  batches: any[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  getBatchName: (batchId?: string) => string;
  showBatchColumn?: boolean;
  photoPreviewUrl: string | null;
  onPhotoPick: (file: File | null) => void;
  onPhotoRemove: () => void | Promise<void>;
  canRemovePhoto: boolean;
}

function StudentRow({
  student,
  editingStudent,
  formData,
  setFormData,
  batches,
  onEdit,
  onDelete,
  onSubmit,
  onReset,
  getBatchName,
  showBatchColumn = true,
  photoPreviewUrl,
  onPhotoPick,
  onPhotoRemove,
  canRemovePhoto,
}: StudentRowProps) {
  return (
    <TableRow key={student.id}>
      <TableCell>
        <StudentAvatar name={student.name} photoURL={student.photoURL} size="sm" />
      </TableCell>
      <TableCell className="font-medium">{student.studentId}</TableCell>
      <TableCell>{student.name}</TableCell>
      <TableCell>{student.email}</TableCell>
      {showBatchColumn && (
        <TableCell className="text-sm text-slate-600">
          {getBatchName(student.batchId)}
        </TableCell>
      )}
      <TableCell>{student.enrolledDate}</TableCell>
      <TableCell>
        <Badge
          variant={student.status === "active" ? "default" : "secondary"}
          className={
            student.status === "active"
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : ""
          }
        >
          {student.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Dialog
            open={editingStudent?.id === student.id}
            onOpenChange={(open) => !open && onReset()}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(student)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Student</DialogTitle>
                <DialogDescription>
                  Update student information
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-studentId">Student ID</Label>
                    <Input
                      id="edit-studentId"
                      value={formData.studentId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          studentId: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-batch">Batch</Label>
                    <Select
                      value={formData.batchId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, batchId: value })
                      }
                    >
                      <SelectTrigger id="edit-batch">
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
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          status: value as "active" | "inactive",
                        })
                      }
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <StudentPhotoFields
                    previewUrl={photoPreviewUrl}
                    displayName={formData.name}
                    onPickFile={onPhotoPick}
                    onRemove={onPhotoRemove}
                    canRemove={canRemovePhoto}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onReset}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(student.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
