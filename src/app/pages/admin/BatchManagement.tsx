import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Pencil,
  Plus,
  Trash2,
  Users,
  UserPlus,
  Search,
  X,
  Layers,
  Calendar,
  BookOpen,
  LayoutList,
  LayoutGrid,
  GraduationCap,
} from "lucide-react";
import type { Batch } from "../../context/DataContext";

type BatchFormData = {
  name: string;
  description: string;
  schedule: string;
  subjects: string;
};

const emptyFormData: BatchFormData = {
  name: "",
  description: "",
  schedule: "",
  subjects: "",
};

function parseSubjects(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean),
    ),
  );
}

export default function BatchManagement() {
  const navigate = useNavigate();
  const { batches, addBatch, updateBatch, deleteBatch, getStudentsByBatch } =
    useData();
  const [isOpen, setIsOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BatchFormData>(emptyFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "students-desc" | "students-asc" | "newest"
  >("name");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const editingBatch = editingBatchId
    ? batches.find((batch) => batch.id === editingBatchId)
    : null;
  const currentSubjects = parseSubjects(formData.subjects);

  // Pre-calculate student counts for performance and sorting
  const batchStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of batches) {
      counts[b.id] = getStudentsByBatch(b.id).length;
    }
    return counts;
  }, [batches, getStudentsByBatch]);

  const totalStudents = useMemo(() => {
    return Object.values(batchStudentCounts).reduce((acc, c) => acc + c, 0);
  }, [batchStudentCounts]);

  const allUniqueSubjects = useMemo(() => {
    const subjects = new Set<string>();
    for (const b of batches) {
      if (b.subjects) {
        b.subjects.forEach((s) => subjects.add(s));
      }
    }
    return Array.from(subjects);
  }, [batches]);

  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...batches];

    if (q) {
      list = list.filter((b) => {
        const name = (b.name || "").toLowerCase();
        const desc = (b.description || "").toLowerCase();
        const sched = (b.schedule || "").toLowerCase();
        const subjects = (b.subjects || [])
          .map((s) => s.toLowerCase())
          .join(" ");
        return (
          name.includes(q) ||
          desc.includes(q) ||
          sched.includes(q) ||
          subjects.includes(q)
        );
      });
    }

    return list.sort((a, b) => {
      if (sortBy === "students-desc") {
        return (
          (batchStudentCounts[b.id] || 0) - (batchStudentCounts[a.id] || 0)
        );
      }
      if (sortBy === "students-asc") {
        return (
          (batchStudentCounts[a.id] || 0) - (batchStudentCounts[b.id] || 0)
        );
      }
      if (sortBy === "newest") {
        const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return dateB - dateA;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [batches, searchQuery, sortBy, batchStudentCounts]);

  const resetForm = () => {
    setFormData(emptyFormData);
    setEditingBatchId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEditDialog = (batch: Batch) => {
    setEditingBatchId(batch.id);
    setFormData({
      name: batch.name || "",
      description: batch.description || "",
      schedule: batch.schedule || "",
      subjects: (batch.subjects || []).join(", "),
    });
    setIsOpen(true);
  };

  const removeSubjectFromForm = (subjectToRemove: string) => {
    const nextSubjects = currentSubjects.filter(
      (subject) => subject !== subjectToRemove,
    );
    setFormData((prev) => ({ ...prev, subjects: nextSubjects.join(", ") }));
  };

  const handleSaveBatch = async () => {
    if (!formData.name.trim()) {
      alert("Batch name is required");
      return;
    }

    const subjects = parseSubjects(formData.subjects);

    if (subjects.length === 0) {
      alert("At least one subject is required");
      return;
    }

    try {
      const batchData: Partial<Batch> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        schedule: formData.schedule.trim(),
        subjects,
      };

      if (editingBatchId) {
        await updateBatch(editingBatchId, batchData);
      } else {
        await addBatch(
          batchData as Omit<Batch, "id" | "createdDate" | "studentCount">,
        );
      }

      resetForm();
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to save batch:", error);
      alert("Failed to save batch. Please try again.");
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Batches
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {batches.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Enrolled Students
            </p>
            <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Subjects
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {allUniqueSubjects.length}
            </p>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search, Sort, View Toggle & Create */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Left: Search & Sort */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-0">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search batches by name, subject, or schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs sm:text-sm border-slate-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger
              className="w-[170px] h-9 text-xs font-medium border-slate-200 bg-white"
              aria-label="Sort batches"
            >
              <SelectValue placeholder="Sort batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="students-desc">Most Students</SelectItem>
              <SelectItem value="students-asc">Fewest Students</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right: View Toggle + Create Batch Button */}
        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="List View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>

          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 h-9 text-xs sm:text-sm"
                onClick={openCreateDialog}
              >
                <Plus className="w-4 h-4" />
                Create Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingBatch ? "Edit Batch" : "Create New Batch"}
                </DialogTitle>
                <DialogDescription>
                  {editingBatch
                    ? "Update batch details and add or remove subjects."
                    : "Add a new batch (batch name and subjects are required)"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Batch Name
                  </label>
                  <Input
                    placeholder="e.g., Morning Batch, Evening Batch"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Schedule{" "}
                    <span className="text-xs text-slate-500">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g., Monday-Friday, 6:00 AM - 12:00 PM"
                    value={formData.schedule}
                    onChange={(e) =>
                      setFormData({ ...formData, schedule: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Description{" "}
                    <span className="text-xs text-slate-500">(optional)</span>
                  </label>
                  <Textarea
                    placeholder="Enter batch description..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Subjects
                  </label>
                  <Input
                    placeholder="e.g., Physics, Chemistry, Mathematics"
                    value={formData.subjects}
                    onChange={(e) =>
                      setFormData({ ...formData, subjects: e.target.value })
                    }
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Add or remove subjects separated by commas. Example:
                    Physics, Chemistry, Maths
                  </p>
                  {currentSubjects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {currentSubjects.map((subject) => (
                        <span
                          key={subject}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                        >
                          {subject}
                          <button
                            type="button"
                            onClick={() => removeSubjectFromForm(subject)}
                            className="ml-1 rounded-full px-1 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                            aria-label={`Remove ${subject}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleSaveBatch} className="w-full">
                  {editingBatch ? "Save Changes" : "Create Batch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* List View */}
      {viewMode === "list" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                  <TableHead className="min-w-[240px]">Batch Details</TableHead>
                  <TableHead className="min-w-[190px]">Subjects</TableHead>
                  <TableHead className="min-w-[180px]">Schedule</TableHead>
                  <TableHead className="min-w-[130px]">Students</TableHead>
                  <TableHead className="min-w-[190px]">
                    Enrollment Forms
                  </TableHead>
                  <TableHead className="text-right min-w-[90px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.length > 0 ? (
                  filteredBatches.map((batch) => {
                    const studentCount = batchStudentCounts[batch.id] || 0;
                    return (
                      <TableRow
                        key={batch.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Batch Name & Details */}
                        <TableCell className="align-middle py-3.5">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5 shadow-2xs">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
                                {batch.name}
                              </p>
                              {batch.description ? (
                                <p
                                  className="text-xs text-slate-500 mt-0.5 line-clamp-1 max-w-[280px]"
                                  title={batch.description}
                                >
                                  {batch.description}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 mt-0.5 italic">
                                  No description
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Subjects */}
                        <TableCell className="align-middle py-3.5">
                          {batch.subjects && batch.subjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                              {batch.subjects.slice(0, 3).map((subj) => (
                                <span
                                  key={subj}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100/80"
                                >
                                  {subj}
                                </span>
                              ))}
                              {batch.subjects.length > 3 && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600"
                                  title={batch.subjects.slice(3).join(", ")}
                                >
                                  +{batch.subjects.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              —
                            </span>
                          )}
                        </TableCell>

                        {/* Schedule */}
                        <TableCell className="align-middle py-3.5">
                          {batch.schedule ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span
                                className="truncate max-w-[180px]"
                                title={batch.schedule}
                              >
                                {batch.schedule}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Open schedule
                            </span>
                          )}
                        </TableCell>

                        {/* Enrolled Students */}
                        <TableCell className="align-middle py-3.5">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/students?batchId=${batch.id}`)
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border border-slate-200/80 transition-colors group cursor-pointer"
                            title="Click to view enrolled students"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600" />
                            <span>{studentCount}</span>
                            <span className="text-[10px] font-normal text-slate-500">
                              enrolled
                            </span>
                          </button>
                        </TableCell>

                        {/* Enrollment & Forms */}
                        <TableCell className="align-middle py-3.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 border-indigo-200/80 gap-1.5 shadow-2xs"
                            onClick={() =>
                              navigate(`/admin/enrollments?batchId=${batch.id}`)
                            }
                          >
                            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Forms & Links</span>
                          </Button>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right align-middle py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              onClick={() => openEditDialog(batch)}
                              title="Edit batch"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            <button
                              type="button"
                              onClick={() => setDeleteId(batch.id)}
                              className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Search className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          No batches found
                        </p>
                        <p className="text-xs text-slate-500">
                          {searchQuery
                            ? `No batches matching "${searchQuery}"`
                            : "Create your first batch to get started"}
                        </p>
                        {searchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => setSearchQuery("")}
                          >
                            Clear Search
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        /* Grid View (Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBatches.map((batch) => {
            const studentCount = batchStudentCounts[batch.id] || 0;
            return (
              <Card
                key={batch.id}
                className="border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold text-slate-900 truncate">
                          {batch.name}
                        </CardTitle>
                        {batch.schedule && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{batch.schedule}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600"
                        onClick={() => openEditDialog(batch)}
                        title="Edit batch"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(batch.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3.5 pt-0">
                  {batch.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {batch.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-medium text-slate-600">
                        Enrolled Students
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/admin/students?batchId=${batch.id}`)
                      }
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                      title="View students in this batch"
                    >
                      {studentCount}
                    </button>
                  </div>

                  {!!batch.subjects?.length && (
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {batch.subjects.map((subject) => (
                          <span
                            key={subject}
                            className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100/80"
                          >
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 border-indigo-200 gap-1.5 font-semibold text-xs h-8"
                      onClick={() =>
                        navigate(`/admin/enrollments?batchId=${batch.id}`)
                      }
                    >
                      <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                      Batch Enrollment &amp; Form Link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this batch? Enrolled students will
              be unassigned from this batch but their accounts will not be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteBatch(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
