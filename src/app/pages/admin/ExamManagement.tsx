import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Calendar, Edit2, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import {
  createExamTest,
  deleteExamTest,
  listExamTestsForAdmin,
} from "../../features/exams/examApi";
import type { ExamShowAnswersAfter, ExamTest, ExamVisibility } from "../../features/exams/types";

export default function ExamManagement() {
  const { batches, students, getStudentsByBatch } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<ExamTest[]>([]);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    batchId: batches[0]?.id || "",
    subject: "",
    instructions: "",
    startAt: "",
    endAt: "",
    durationMinutes: "60",
    negativeMarkPerWrong: "0",
    showAnswersAfter: "after_end" as ExamShowAnswersAfter,
    visibility: "BATCH" as ExamVisibility,
    selectedStudentRecordIds: [] as string[],
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const t = await listExamTestsForAdmin();
        if (!cancelled) setTests(t);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const batchSubjects = useMemo(() => {
    const b = batches.find((x) => x.id === form.batchId);
    return b?.subjects || [];
  }, [batches, form.batchId]);

  const batchStudents = useMemo(() => {
    if (!form.batchId) return [];
    return getStudentsByBatch(form.batchId);
  }, [form.batchId, getStudentsByBatch, students.length]);

  const create = async () => {
    if (!form.title.trim() || !form.batchId || !form.subject.trim()) {
      alert("Please fill Title, Batch, Subject");
      return;
    }
    if (!form.startAt || !form.endAt) {
      alert("Please set start and end date/time");
      return;
    }
    const start = new Date(form.startAt).toISOString();
    const end = new Date(form.endAt).toISOString();
    if (new Date(start).getTime() >= new Date(end).getTime()) {
      alert("End time must be after start time");
      return;
    }

    setCreating(true);
    try {
      const id = await createExamTest({
        title: form.title.trim(),
        batchId: form.batchId,
        subject: form.subject.trim(),
        instructions: form.instructions.trim() || "",
        startAt: start,
        endAt: end,
        durationMinutes: Math.max(1, parseInt(form.durationMinutes || "60", 10) || 60),
        totalQuestions: 0,
        totalMarks: 0,
        negativeMarkPerWrong: Math.max(0, parseFloat(form.negativeMarkPerWrong || "0") || 0),
        showAnswersAfter: form.showAnswersAfter,
        visibility: form.visibility,
        selectedStudentRecordIds:
          form.visibility === "SELECTIVE" ? form.selectedStudentRecordIds : [],
      });

      setTests((prev) => [
        {
          id,
          title: form.title.trim(),
          batchId: form.batchId,
          subject: form.subject.trim(),
          instructions: form.instructions.trim() || "",
          startAt: start,
          endAt: end,
          durationMinutes: Math.max(1, parseInt(form.durationMinutes || "60", 10) || 60),
          totalQuestions: 0,
          totalMarks: 0,
          negativeMarkPerWrong: Math.max(0, parseFloat(form.negativeMarkPerWrong || "0") || 0),
          showAnswersAfter: form.showAnswersAfter,
          visibility: form.visibility,
          selectedStudentRecordIds:
            form.visibility === "SELECTIVE" ? form.selectedStudentRecordIds : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setOpen(false);
      navigate(`/admin/tests/${id}`);
    } catch (e) {
      console.error(e);
      alert("Failed to create exam. Check console.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (testId: string) => {
    if (!confirm("Delete this exam? (Subcollections need Firebase CLI recursive delete)")) return;
    try {
      await deleteExamTest(testId);
      setTests((prev) => prev.filter((t) => t.id !== testId));
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  };

  const statusOf = (t: ExamTest) => {
    const now = Date.now();
    const s = new Date(t.startAt).getTime();
    const e = new Date(t.endAt).getTime();
    if (now >= s && now <= e) return "active";
    if (now < s) return "upcoming";
    return "closed";
  };

  const statusBadge = (s: string) => {
    if (s === "active") return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    if (s === "upcoming") return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Closed</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> New Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create new CBT exam</DialogTitle>
              <DialogDescription>
                Configure batch, timing, and answer visibility. Add questions after creation.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Quantitative Aptitude - Mock 01"
                />
              </div>

              <div className="space-y-2">
                <Label>Batch *</Label>
                <Select
                  value={form.batchId}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      batchId: v,
                      subject: "",
                      selectedStudentRecordIds: [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
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
                <Label>Subject *</Label>
                {batchSubjects.length > 0 ? (
                  <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {batchSubjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g. Maths"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Start (date & time) *</Label>
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End (date & time) *</Label>
                <Input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Negative mark per wrong</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.25}
                  value={form.negativeMarkPerWrong}
                  onChange={(e) => setForm({ ...form, negativeMarkPerWrong: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Show correct answers</Label>
                <Select
                  value={form.showAnswersAfter}
                  onValueChange={(v) => setForm({ ...form, showAnswersAfter: v as ExamShowAnswersAfter })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="after_end">After exam end</SelectItem>
                    <SelectItem value="immediate">Immediately after submit</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      visibility: v as ExamVisibility,
                      selectedStudentRecordIds: [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BATCH">Whole batch</SelectItem>
                    <SelectItem value="SELECTIVE">Select students</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.visibility === "SELECTIVE" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Select students</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-3">
                    {batchStudents.map((s) => {
                      const checked = form.selectedStudentRecordIds.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          className={`text-left rounded-lg border px-3 py-2 transition-all ${
                            checked
                              ? "border-indigo-400 bg-indigo-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setForm((prev) => {
                              const has = prev.selectedStudentRecordIds.includes(s.id);
                              return {
                                ...prev,
                                selectedStudentRecordIds: has
                                  ? prev.selectedStudentRecordIds.filter((x) => x !== s.id)
                                  : [...prev.selectedStudentRecordIds, s.id],
                              };
                            });
                          }}
                        >
                          <div className="font-medium text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-600">{s.email}</div>
                        </button>
                      );
                    })}
                    {batchStudents.length === 0 && (
                      <div className="text-sm text-slate-500">No students in this batch.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Instructions (optional)</Label>
                <Input
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="Shown to students before starting..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void create()} disabled={creating}>
                {creating ? "Creating..." : "Create & Add Questions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert className="border-indigo-200 bg-indigo-50">
        <Calendar className="h-4 w-4 text-indigo-600" />
        <AlertTitle className="text-indigo-900">Security</AlertTitle>
        <AlertDescription className="text-indigo-800">
          Correct answers are stored in a private subcollection and become readable to students only
          after submission (and optionally after exam end), enforced via Firestore rules.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>All CBT exams</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-slate-500">Loading exams...</div>
          ) : tests.length === 0 ? (
            <div className="text-sm text-slate-500">No exams yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((t) => {
                    const s = statusOf(t);
                    const batchName = batches.find((b) => b.id === t.batchId)?.name || t.batchId;
                    return (
                      <TableRow key={t.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">{t.title}</TableCell>
                        <TableCell className="text-sm">{batchName}</TableCell>
                        <TableCell className="text-sm">{t.subject}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(t.startAt).toLocaleString()} – {new Date(t.endAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{statusBadge(s)}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-semibold">{t.totalQuestions}</span> /{" "}
                          <span className="font-semibold">{t.totalMarks}</span>
                        </TableCell>
                        <TableCell className="text-right flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-700 hover:bg-indigo-50"
                            onClick={() => navigate(`/admin/tests/${t.id}`)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-700 hover:bg-emerald-50"
                            onClick={() => navigate(`/admin/tests/${t.id}/results`)}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-700 hover:bg-rose-50"
                            onClick={() => void remove(t.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

