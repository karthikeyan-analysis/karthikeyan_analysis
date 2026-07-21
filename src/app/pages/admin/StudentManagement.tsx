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
import { UserPlus, Pencil, Trash2, Search, Upload, Loader2, FileSpreadsheet, X, Monitor, RotateCcw } from "lucide-react";
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
import {
  extractUrlFromExcelCell,
  findPhotoUrlInValues,
  looksLikePhotoUrl,
  normalizeStudentPhotoUrl,
  resolveStudentPhotoDisplayUrl,
} from "../../features/students/studentPhotoUrl";
import {
  normalizeStudentBatchIds,
  studentBelongsToBatch,
  studentHasNoBatch,
} from "../../features/students/studentBatchUtils";

type StudentSortKey = "name" | "studentId" | "email" | "batch" | "enrolledNewest" | "enrolledOldest" | "status";

function StudentPhotoFields({
  previewUrl,
  displayName,
  photoUrlText,
  onPhotoUrlTextChange,
  onPickFile,
  onRemove,
  canRemove,
}: {
  previewUrl: string | null;
  displayName: string;
  photoUrlText: string;
  onPhotoUrlTextChange: (value: string) => void;
  onPickFile: (file: File | null) => void;
  onRemove: () => void | Promise<void>;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-3 md:col-span-2">
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
            onPhotoUrlTextChange("");
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
      <div className="space-y-1.5">
        <Label htmlFor="student-photo-url" className="text-xs font-normal text-slate-600">
          Or paste image URL (Google Drive link or any https image)
        </Label>
        <Input
          id="student-photo-url"
          type="url"
          placeholder="https://drive.google.com/file/d/…"
          value={photoUrlText}
          onChange={(e) => {
            onPhotoUrlTextChange(e.target.value);
            if (e.target.value.trim()) onPickFile(null);
          }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Upload saves to Firebase Storage. Pasted links are stored as-is (Drive links are converted for display).
        Photos appear when the student logs in, during tests, and on result PDFs.
      </p>
    </div>
  );
}

export default function StudentManagement() {
  const { students, batches, addStudent, enrollStudentInBatch, updateStudent, deleteStudent, clearStudentPhoto, clearStudentDevice } =
    useData();
  const [resettingDeviceIds, setResettingDeviceIds] = useState<Set<string>>(new Set());

  const handleResetDevice = async (studentId: string) => {
    if (!confirm("Reset this student's device? They will be able to log in from any device again.")) return;
    setResettingDeviceIds((prev) => new Set(prev).add(studentId));
    try {
      await clearStudentDevice(studentId);
    } catch (e) {
      console.error(e);
    } finally {
      setResettingDeviceIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [studentSortKey, setStudentSortKey] = useState<StudentSortKey>("name");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importBatchId, setImportBatchId] = useState<string>("");
  const [importStatus, setImportStatus] = useState<"active" | "inactive">("active");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<
    Array<{ studentId: string; name: string; email: string; enrolledDate?: string; photoURL?: string }>
  >([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    updated: number;
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
    batchIds: [] as string[],
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrlText, setPhotoUrlText] = useState("");
  const blobPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    return () => {
      if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);
    };
  }, [blobPreviewUrl]);

  const photoPreviewDisplay =
    blobPreviewUrl ||
    resolveStudentPhotoDisplayUrl(photoUrlText) ||
    resolveStudentPhotoDisplayUrl(editingStudent?.photoURL) ||
    null;

  const getBatchName = (batchId?: string) => {
    if (!batchId) return "Not Assigned";
    return batches.find((b) => b.id === batchId)?.name || "Unknown";
  };

  const getStudentBatchLabels = (student: Student) => {
    const ids = normalizeStudentBatchIds(student);
    if (!ids.length) return ["Not Assigned"];
    return ids.map((id) => getBatchName(id));
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const dateValue = (value?: string) => {
      const ms = value ? new Date(value).getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    };
    const textValue = (value?: string) => String(value || "").toLowerCase();

    let list =
      selectedBatch === "all"
        ? [...students]
        : selectedBatch === "unassigned"
          ? students.filter((student) => studentHasNoBatch(student))
          : students.filter((student) => studentBelongsToBatch(student, selectedBatch));

    if (q) {
      list = list.filter(
        (student) =>
          student.name.toLowerCase().includes(q) ||
          student.email.toLowerCase().includes(q) ||
          student.studentId.toLowerCase().includes(q) ||
          getStudentBatchLabels(student).some((label) =>
            label.toLowerCase().includes(q),
          ),
      );
    }

    return list.sort((a, b) => {
      if (studentSortKey === "studentId") return textValue(a.studentId).localeCompare(textValue(b.studentId));
      if (studentSortKey === "email") return textValue(a.email).localeCompare(textValue(b.email));
      if (studentSortKey === "batch") {
        return getStudentBatchLabels(a)
          .join(", ")
          .localeCompare(getStudentBatchLabels(b).join(", "));
      }
      if (studentSortKey === "enrolledNewest") return dateValue(b.enrolledDate) - dateValue(a.enrolledDate);
      if (studentSortKey === "enrolledOldest") return dateValue(a.enrolledDate) - dateValue(b.enrolledDate);
      if (studentSortKey === "status") return textValue(a.status).localeCompare(textValue(b.status));
      return textValue(a.name).localeCompare(textValue(b.name));
    });
  }, [batches, searchQuery, selectedBatch, studentSortKey, students]);

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
    if (h.includes("photo") || h.includes("picture") || h.includes("image") || h.includes("drive"))
      return "photoURL";
    if (h.includes("profile") && (h.includes("url") || h.includes("link") || h.includes("photo")))
      return "photoURL";
    if ((h.includes("url") || h.includes("link")) && !h.includes("email")) return "photoURL";
    if (h.includes("full name") || (h.includes("name") && !h.includes("file"))) return "name";
    if (h.includes("enrolled") || h.includes("join") || h.includes("date") || h.includes("timestamp"))
      return "enrolledDate";
    return null;
  };

  const inferMappingFromValues = (
    headers: string[],
    sampleRows: Record<string, unknown>[],
  ): Partial<Record<"studentId" | "name" | "email" | "enrolledDate" | "photoURL", string>> => {
    const mapping: Partial<Record<"studentId" | "name" | "email" | "enrolledDate" | "photoURL", string>> = {};
    const sample = sampleRows.slice(0, 15);

    for (const h of headers) {
      const field = guessFieldFromHeader(h);
      if (field && !mapping[field]) mapping[field] = h;
    }

    if (!mapping.email) {
      for (const h of headers) {
        const hits = sample.filter((r) => isLikelyEmail(normalizeEmail(String(r[h] ?? "")))).length;
        if (hits >= Math.max(1, Math.ceil(sample.length * 0.4))) {
          mapping.email = h;
          break;
        }
      }
    }

    if (!mapping.name && mapping.email) {
      const emailIdx = headers.indexOf(mapping.email);
      if (emailIdx > 0) {
        const candidate = headers[emailIdx - 1];
        const hits = sample.filter((r) => String(r[candidate] ?? "").trim().length > 1).length;
        if (hits > 0) mapping.name = candidate;
      }
    }

    if (!mapping.photoURL && mapping.email) {
      const emailIdx = headers.indexOf(mapping.email);
      for (let i = emailIdx + 1; i < headers.length; i++) {
        const h = headers[i];
        if (sample.some((r) => looksLikePhotoUrl(String(r[h] ?? "")))) {
          mapping.photoURL = h;
          break;
        }
      }
    }

    if (!mapping.enrolledDate) {
      for (const h of headers) {
        if (h === mapping.name || h === mapping.email || h === mapping.photoURL) continue;
        const hits = sample.filter((r) => {
          const v = String(r[h] ?? "").trim();
          return v.length > 4 && !looksLikePhotoUrl(v) && !isLikelyEmail(v);
        }).length;
        if (hits >= Math.max(1, Math.ceil(sample.length * 0.3))) {
          mapping.enrolledDate = h;
          break;
        }
      }
    }

    return mapping;
  };

  const extractPhotoFromSheetRow = (
    ws: XLSX.WorkSheet,
    sheetRow: number,
    colStart: number,
    colEnd: number,
  ) => {
    for (let c = colStart; c <= colEnd; c++) {
      const addr = XLSX.utils.encode_cell({ r: sheetRow, c });
      const url = extractUrlFromExcelCell(ws[addr] as { v?: unknown; l?: { Target?: string }; f?: string });
      if (url && looksLikePhotoUrl(url)) return url;
    }
    return undefined;
  };

  const detectHeaderRowIndex = (ws: XLSX.WorkSheet, colStart: number, colEnd: number) => {
    const ref = ws["!ref"];
    if (!ref) return 0;
    const range = XLSX.utils.decode_range(ref);
    for (let r = range.s.r; r <= Math.min(range.s.r + 3, range.e.r); r++) {
      let headerHits = 0;
      for (let c = colStart; c <= colEnd; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const label = String(ws[addr]?.v ?? "").trim();
        if (guessFieldFromHeader(label)) headerHits += 1;
      }
      if (headerHits >= 2) return r;
    }
    return range.s.r;
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
    const wb = XLSX.read(buf, { type: "array", cellFormula: true });
    const wsName = wb.SheetNames?.[0];
    if (!wsName) throw new Error("No sheets found in Excel file.");

    const ws = wb.Sheets[wsName];
    const sheetRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    const colStart = sheetRange?.s.c ?? 0;
    const colEnd = sheetRange?.e.c ?? 0;
    const headerRowIndex = sheetRange ? detectHeaderRowIndex(ws, colStart, colEnd) : 0;

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
      defval: "",
      raw: false,
      range: headerRowIndex,
    });
    if (!rows.length) throw new Error("No rows found in the first sheet.");

    const headers = Object.keys(rows[0] || {});
    const mapping = inferMappingFromValues(headers, rows);

    if (!mapping.email) {
      throw new Error(
        'Could not detect an "Email" column. Add a header like "Email", or put email in the third column (Date, Name, Email, Photo URL).',
      );
    }
    if (!mapping.name) {
      throw new Error(
        'Could not detect a "Name" column. Add a header like "Full Name", or put the name column before email.',
      );
    }

    const seenInFile = new Set<string>();

    const parsed = rows
      .map((r, idx) => {
        const email = normalizeEmail(r[mapping.email!]);
        const name = String(r[mapping.name!]).trim();
        const studentIdFromSheet = mapping.studentId ? String(r[mapping.studentId]).trim() : "";
        const enrolledDate = mapping.enrolledDate ? String(r[mapping.enrolledDate]).trim() : "";
        let photoRaw = mapping.photoURL ? String(r[mapping.photoURL] ?? "").trim() : "";
        if (!looksLikePhotoUrl(photoRaw)) {
          photoRaw = findPhotoUrlInValues(Object.values(r)) ?? "";
        }
        if (!looksLikePhotoUrl(photoRaw) && sheetRange) {
          const sheetRow = headerRowIndex + 1 + idx;
          photoRaw = extractPhotoFromSheetRow(ws, sheetRow, colStart, colEnd) ?? "";
        }
        const photoURL = normalizeStudentPhotoUrl(photoRaw);
        const studentId = studentIdFromSheet || (email ? buildStudentId(email, idx) : "");
        const duplicateInFile = email ? seenInFile.has(email) : false;
        if (email) seenInFile.add(email);
        return {
          studentId,
          name,
          email,
          enrolledDate: enrolledDate || undefined,
          photoURL,
          duplicateInFile,
        };
      })
      .filter((r) => r.email && r.name);

    if (!parsed.length) {
      throw new Error("No valid rows found. Make sure Email and Name cells are filled.");
    }

    // Keep duplicates in preview so user can see why rows may skip later
    const previewRows = parsed.map(({ duplicateInFile, ...rest }) => rest);
    setImportRows(previewRows);

    const withPhoto = previewRows.filter((p) => p.photoURL).length;
    const warnings: string[] = [];
    if (parsed.some((p) => p.duplicateInFile)) {
      warnings.push("Your Excel has duplicate emails. Duplicates will be skipped during import.");
    }
    if (withPhoto === 0) {
      warnings.push(
        'No photo links were found. Add a column like "Upload your photo" with Google Drive URLs (shared as "Anyone with the link"), or use visible hyperlinks in Excel.',
      );
    } else if (withPhoto < previewRows.length) {
      warnings.push(
        `Photos detected for ${withPhoto} of ${previewRows.length} rows. Rows without a Drive link will use initials only.`,
      );
    }
    setImportError(warnings.join(" "));
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
    let updated = 0;
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
      try {
        const result = await enrollStudentInBatch({
          email,
          batchId: importBatchId,
          name: row.name,
          studentId: row.studentId,
          status: importStatus,
          enrolledDate: row.enrolledDate || new Date().toISOString().split("T")[0],
          ...(row.photoURL ? { photoURL: row.photoURL } : {}),
        });
        if (result.created) {
          created += 1;
        } else if (result.alreadyInBatch) {
          skipped += 1;
          failures.push({
            email,
            reason: "Already enrolled in this batch",
          });
        } else {
          updated += 1;
        }
        existingEmailSet.add(email);
      } catch (e: any) {
        failed += 1;
        failures.push({ email, reason: e?.message || "Failed to create student" });
      }
    }

    setImportSummary({
      total: importRows.length,
      created,
      updated,
      skipped,
      failed,
      failures,
    });
    setImporting(false);
  };

  const applyPhotoToStudent = async (studentId: string) => {
    if (photoFile) {
      const url = await uploadStudentProfileImage(studentId, photoFile);
      await updateStudent(studentId, { photoURL: url });
      return;
    }
    const normalized = normalizeStudentPhotoUrl(photoUrlText);
    if (normalized) {
      await updateStudent(studentId, { photoURL: normalized });
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoFile(null);
    setPhotoUrlText("");
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
        const selectedBatchIds =
          formData.batchIds.length > 0
            ? formData.batchIds
            : formData.batchId
              ? [formData.batchId]
              : [];
        await updateStudent(editingStudent.id, {
          studentId: formData.studentId,
          name: formData.name,
          email: formData.email,
          status: formData.status,
          batchIds: selectedBatchIds,
          batchId: selectedBatchIds[0] || "",
        });
        await applyPhotoToStudent(editingStudent.id);
        setEditingStudent(null);
      } else {
        if (!formData.batchId) {
          setError("Please select a batch.");
          setIsLoading(false);
          return;
        }
        const result = await enrollStudentInBatch({
          email: formData.email,
          batchId: formData.batchId,
          name: formData.name,
          studentId: formData.studentId,
          status: formData.status,
          enrolledDate: new Date().toISOString().split("T")[0],
        });
        if (result.alreadyInBatch) {
          setError("This student is already enrolled in the selected batch.");
          setIsLoading(false);
          return;
        }
        await applyPhotoToStudent(result.studentId);
        setIsAddDialogOpen(false);
        if (!result.created) {
          // Soft success notice via clearing error with a temporary message
          setError("");
        }
      }

      setPhotoFile(null);
      setPhotoUrlText("");
      setFormData({
        studentId: "",
        name: "",
        email: "",
        status: "active",
        batchId: "",
        batchIds: [],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save student");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setPhotoFile(null);
    setPhotoUrlText(student.photoURL || "");
    setEditingStudent(student);
    const ids = normalizeStudentBatchIds(student);
    setFormData({
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      status: student.status,
      batchId: student.batchId || ids[0] || "",
      batchIds: ids,
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
    setPhotoUrlText("");
    setFormData({
      studentId: "",
      name: "",
      email: "",
      status: "active",
      batchId: "",
      batchIds: [],
    });
    setEditingStudent(null);
    setError("");
  };

  const getStudentCountByBatch = (batchId: string) => {
    return students.filter((s) => studentBelongsToBatch(s, batchId)).length;
  };

  const getUnassignedStudentCount = () => {
    return students.filter((s) => studentHasNoBatch(s)).length;
  };

  const toggleFormBatchId = (batchId: string) => {
    setFormData((prev) => {
      const has = prev.batchIds.includes(batchId);
      const batchIds = has
        ? prev.batchIds.filter((id) => id !== batchId)
        : [...prev.batchIds, batchId];
      return {
        ...prev,
        batchIds,
        batchId: batchIds[0] || "",
      };
    });
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
                  : "Add a student or enroll an existing email into another batch"}
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
                      setFormData({
                        ...formData,
                        batchId: value,
                        batchIds: value ? [value] : [],
                      })
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
                  <p className="text-xs text-slate-500">
                    If this email already exists, they will be added to this batch (same Google login).
                  </p>
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
                  previewUrl={photoPreviewDisplay}
                  displayName={formData.name}
                  photoUrlText={photoUrlText}
                  onPhotoUrlTextChange={setPhotoUrlText}
                  onPickFile={setPhotoFile}
                  onRemove={handleRemovePhoto}
                  canRemove={!!(photoFile || photoUrlText.trim() || editingStudent?.photoURL)}
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
                Upload an <span className="font-medium">.xlsx</span> file to create students in bulk. Required:{" "}
                <span className="font-medium">Email</span> and <span className="font-medium">Name</span>. Optional:{" "}
                <span className="font-medium">Photo URL</span> (Google Drive share links work — file must be shared as
                &quot;Anyone with the link&quot;). Column order like Date → Name → Email → Photo URL is detected
                automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="space-y-4 py-2">
                {importError && (
                  <div
                    className={`p-3 border rounded-lg text-sm ${
                      /Could not detect|No rows found|No sheets found|No valid rows|Failed to parse/i.test(
                        importError,
                      )
                        ? "bg-red-50 border-red-200 text-red-800"
                        : importError.includes("No photo links were found")
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-sky-50 border-sky-200 text-sky-900"
                    }`}
                  >
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
                      <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
                        <span>Preview ({importRows.length} rows)</span>
                        <span className="text-xs font-normal text-slate-500">
                          {importRows.filter((r) => r.photoURL).length} with photo link
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Photo</TableHead>
                              <TableHead>Student ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importRows.slice(0, 10).map((r, idx) => (
                              <TableRow key={`${r.email}-${idx}`}>
                                <TableCell>
                                  <StudentAvatar name={r.name} photoURL={r.photoURL} size="sm" />
                                </TableCell>
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
                        Existing emails are enrolled into this batch (not skipped). Already-in-batch rows are skipped.
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
                        <Badge className="bg-indigo-100 text-indigo-800">Added to batch: {importSummary.updated}</Badge>
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

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={studentSortKey} onValueChange={(value) => setStudentSortKey(value as StudentSortKey)}>
                <SelectTrigger className="w-[190px]" aria-label="Sort students">
                  <SelectValue placeholder="Sort students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="studentId">Student ID A-Z</SelectItem>
                  <SelectItem value="email">Email A-Z</SelectItem>
                  <SelectItem value="batch">Batch A-Z</SelectItem>
                  <SelectItem value="enrolledNewest">Newest enrolled</SelectItem>
                  <SelectItem value="enrolledOldest">Oldest enrolled</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
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
                    <TableHead>Active Device</TableHead>
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
                        getStudentBatchLabels={getStudentBatchLabels}
                        toggleFormBatchId={toggleFormBatchId}
                        photoPreviewUrl={
                          editingStudent?.id === student.id
                            ? photoPreviewDisplay
                            : student.photoURL || null
                        }
                        photoUrlText={photoUrlText}
                        onPhotoUrlTextChange={setPhotoUrlText}
                        onPhotoPick={setPhotoFile}
                        onPhotoRemove={handleRemovePhoto}
                        canRemovePhoto={
                          editingStudent?.id === student.id
                            ? !!(photoFile || photoUrlText.trim() || editingStudent.photoURL)
                            : false
                        }
                        onResetDevice={() => handleResetDevice(student.id)}
                        isResettingDevice={resettingDeviceIds.has(student.id)}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
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
                      <TableHead>Active Device</TableHead>
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
                        getStudentBatchLabels={getStudentBatchLabels}
                        toggleFormBatchId={toggleFormBatchId}
                          showBatchColumn={false}
                          photoPreviewUrl={
                            editingStudent?.id === student.id
                              ? photoPreviewDisplay
                              : student.photoURL || null
                          }
                          photoUrlText={photoUrlText}
                          onPhotoUrlTextChange={setPhotoUrlText}
                          onPhotoPick={setPhotoFile}
                          onPhotoRemove={handleRemovePhoto}
                          canRemovePhoto={
                            editingStudent?.id === student.id
                              ? !!(photoFile || photoUrlText.trim() || editingStudent.photoURL)
                              : false
                          }
                          onResetDevice={() => handleResetDevice(student.id)}
                          isResettingDevice={resettingDeviceIds.has(student.id)}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
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
                      <TableHead>Active Device</TableHead>
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
                        getStudentBatchLabels={getStudentBatchLabels}
                        toggleFormBatchId={toggleFormBatchId}
                          showBatchColumn={false}
                          photoPreviewUrl={
                            editingStudent?.id === student.id
                              ? photoPreviewDisplay
                              : student.photoURL || null
                          }
                          photoUrlText={photoUrlText}
                          onPhotoUrlTextChange={setPhotoUrlText}
                          onPhotoPick={setPhotoFile}
                          onPhotoRemove={handleRemovePhoto}
                          canRemovePhoto={
                            editingStudent?.id === student.id
                              ? !!(photoFile || photoUrlText.trim() || editingStudent.photoURL)
                              : false
                          }
                          onResetDevice={() => handleResetDevice(student.id)}
                          isResettingDevice={resettingDeviceIds.has(student.id)}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
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
  getStudentBatchLabels: (student: Student) => string[];
  toggleFormBatchId: (batchId: string) => void;
  showBatchColumn?: boolean;
  photoPreviewUrl: string | null;
  photoUrlText: string;
  onPhotoUrlTextChange: (value: string) => void;
  onPhotoPick: (file: File | null) => void;
  onPhotoRemove: () => void | Promise<void>;
  canRemovePhoto: boolean;
  onResetDevice: () => Promise<void>;
  isResettingDevice: boolean;
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
  getStudentBatchLabels,
  toggleFormBatchId,
  showBatchColumn = true,
  photoPreviewUrl,
  photoUrlText,
  onPhotoUrlTextChange,
  onPhotoPick,
  onPhotoRemove,
  canRemovePhoto,
  onResetDevice,
  isResettingDevice,
}: StudentRowProps) {
  const formatLoginTime = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

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
          <div className="flex flex-wrap gap-1">
            {getStudentBatchLabels(student).map((label) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label}
              </Badge>
            ))}
          </div>
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
      {/* Active Device column */}
      <TableCell>
        {student.activeDevice ? (
          <div className="flex items-start gap-2 min-w-[180px]">
            <div className="mt-0.5 w-2 h-2 rounded-full bg-green-500 shrink-0 ring-2 ring-green-100" />
            <div>
              <p className="text-xs font-medium text-slate-800 leading-tight flex items-center gap-1">
                <Monitor className="w-3 h-3" />
                {student.activeDevice}
              </p>
              {student.activeDeviceLoginAt && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatLoginTime(student.activeDeviceLoginAt)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No active session</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
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
                    <Label>Batches (multi-enroll)</Label>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y">
                      {batches.map((batch) => {
                        const checked = (formData.batchIds || []).includes(batch.id);
                        return (
                          <label
                            key={batch.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={checked}
                              onChange={() => toggleFormBatchId(batch.id)}
                            />
                            <span>{batch.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500">
                      Select every batch this student should access. They will pick an active batch after Google login.
                    </p>
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
                    photoUrlText={photoUrlText}
                    onPhotoUrlTextChange={onPhotoUrlTextChange}
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
          {student.activeDevice && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void onResetDevice()}
              disabled={isResettingDevice}
              title="Reset device — allows student to log in from any device"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            >
              {isResettingDevice
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />}
            </Button>
          )}
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
