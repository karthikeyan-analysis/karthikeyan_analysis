import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import {
  deleteQuestion,
  getExamTest,
  listPublicQuestions,
  uploadQuestionImage,
  upsertQuestion,
  updateExamTest,
} from "../../features/exams/examApi";
import type { ExamQuestionPublic, ExamShowAnswersAfter, ExamTest, ExamVisibility } from "../../features/exams/types";
import { ArrowLeft, Edit2, Image as ImageIcon, Plus, Settings2, Trash2 } from "lucide-react";
import { useData } from "../../context/DataContext";
import { sha256Base64 } from "../../features/exams/password";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

function emptyQuestion(nextNo: number) {
  return {
    questionNo: nextNo,
    text: "",
    imageUrl: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    marks: 1,
  };
}

export default function ExamEditor() {
  const { id } = useParams();
  const testId = id || "";
  const navigate = useNavigate();
  const { batches, getStudentsByBatch } = useData();

  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [test, setTest] = useState<ExamTest | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qForm, setQForm] = useState(() => emptyQuestion(1));
  const [qSaving, setQSaving] = useState(false);
  const [qImageFile, setQImageFile] = useState<File | null>(null);
  const [qImageUploading, setQImageUploading] = useState(false);
  const [qLocalPreviewUrl, setQLocalPreviewUrl] = useState<string | null>(null);

  const [metaOpen, setMetaOpen] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaForm, setMetaForm] = useState<{
    title: string;
    batchId: string;
    subject: string;
    instructions: string;
    accessPassword: string;
    hadPasswordInitially: boolean;
    startAtLocal: string;
    endAtLocal: string;
    durationMinutes: string;
    negativeMarkPerWrong: string;
    showAnswersAfter: ExamShowAnswersAfter;
    visibility: ExamVisibility;
    selectedStudentRecordIds: string[];
  } | null>(null);

  useEffect(() => {
    if (!qImageFile) {
      setQLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(qImageFile);
    setQLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [qImageFile]);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, qs] = await Promise.all([getExamTest(testId), listPublicQuestions(testId)]);
        if (cancelled) return;
        setTest(t);
        setQuestions(qs);
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
  }, [testId]);

  useEffect(() => {
    if (!test) return;
    // Convert ISO -> datetime-local string
    const toLocalInput = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes(),
      )}`;
    };
    setMetaForm({
      title: test.title || "",
      batchId: test.batchId || "",
      subject: test.subject || "",
      instructions: test.instructions || "",
      accessPassword: "",
      hadPasswordInitially: !!test.accessPasswordHash,
      startAtLocal: test.startAt ? toLocalInput(test.startAt) : "",
      endAtLocal: test.endAt ? toLocalInput(test.endAt) : "",
      durationMinutes: String(test.durationMinutes || 60),
      negativeMarkPerWrong: String(test.negativeMarkPerWrong || 0),
      showAnswersAfter: test.showAnswersAfter || "after_end",
      visibility: test.visibility || "BATCH",
      selectedStudentRecordIds: test.selectedStudentRecordIds || [],
    });
  }, [test]);

  const totals = useMemo(() => {
    const totalQuestions = questions.length;
    const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 0), 0);
    return { totalQuestions, totalMarks };
  }, [questions]);

  useEffect(() => {
    if (!testId) return;
    if (!test) return;
    if (
      test.totalQuestions === totals.totalQuestions &&
      test.totalMarks === totals.totalMarks
    ) {
      return;
    }
    let cancelled = false;
    const update = async () => {
      try {
        setSavingMeta(true);
        await updateExamTest(testId, {
          totalQuestions: totals.totalQuestions,
          totalMarks: totals.totalMarks,
        });
        if (!cancelled) {
          setTest((prev) =>
            prev
              ? {
                  ...prev,
                  totalQuestions: totals.totalQuestions,
                  totalMarks: totals.totalMarks,
                }
              : prev,
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setSavingMeta(false);
      }
    };
    update();
    return () => {
      cancelled = true;
    };
  }, [test, testId, totals.totalMarks, totals.totalQuestions]);

  const batchStudents = useMemo(() => {
    const batchId = metaForm?.batchId || test?.batchId || "";
    if (!batchId) return [];
    return getStudentsByBatch(batchId);
  }, [getStudentsByBatch, metaForm?.batchId, test?.batchId]);

  const saveMeta = async () => {
    if (!testId || !metaForm) return;
    if (!metaForm.title.trim() || !metaForm.batchId || !metaForm.subject.trim()) {
      alert("Title, Batch, and Subject are required.");
      return;
    }
    if (!metaForm.startAtLocal || !metaForm.endAtLocal) {
      alert("Start and End time are required.");
      return;
    }
    const startIso = new Date(metaForm.startAtLocal).toISOString();
    const endIso = new Date(metaForm.endAtLocal).toISOString();
    if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
      alert("End time must be after start time.");
      return;
    }

    setMetaSaving(true);
    try {
      const pw = metaForm.accessPassword.trim();
      const updates: Partial<ExamTest> = {
        title: metaForm.title.trim(),
        batchId: metaForm.batchId,
        subject: metaForm.subject.trim(),
        instructions: metaForm.instructions.trim(),
        startAt: startIso,
        endAt: endIso,
        durationMinutes: Math.max(1, parseInt(metaForm.durationMinutes || "60", 10) || 60),
        negativeMarkPerWrong: Math.max(0, parseFloat(metaForm.negativeMarkPerWrong || "0") || 0),
        showAnswersAfter: metaForm.showAnswersAfter,
        visibility: metaForm.visibility,
        selectedStudentRecordIds:
          metaForm.visibility === "SELECTIVE" ? metaForm.selectedStudentRecordIds : [],
      };

      // Only update password if the admin typed something, or if they explicitly cleared it.
      // - typed password => set new hash
      // - empty + had password initially => clear password
      const pwUpdates: Partial<ExamTest> & { accessPasswordHash?: string | null } = { ...updates };
      if (pw) pwUpdates.accessPasswordHash = await sha256Base64(pw);
      else if (metaForm.hadPasswordInitially) pwUpdates.accessPasswordHash = null;

      await updateExamTest(testId, pwUpdates as any);
      setTest((prev) => (prev ? { ...prev, ...updates } as ExamTest : prev));
      setMetaOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save exam details.");
    } finally {
      setMetaSaving(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setQForm(emptyQuestion(questions.length + 1));
    setQImageFile(null);
    setDialogOpen(true);
  };

  const openEdit = async (q: ExamQuestionPublic) => {
    setEditingId(q.id);
    setQForm({
      questionNo: q.questionNo,
      text: q.text,
      imageUrl: q.imageUrl || "",
      options: q.options.length ? q.options : ["", "", "", ""],
      correctIndex: 0,
      marks: q.marks || 1,
    });
    setQImageFile(null);
    // Correct index is stored privately; admin will set it again when editing if needed.
    setDialogOpen(true);
  };

  const saveQuestion = async () => {
    if (!testId) return;
    if (!qForm.text.trim()) {
      alert("Question text required");
      return;
    }
    const opts = qForm.options.map((o) => o.trim());
    if (opts.some((o) => !o)) {
      alert("All options must be filled");
      return;
    }
    if (qForm.correctIndex < 0 || qForm.correctIndex > opts.length - 1) {
      alert("Correct option invalid");
      return;
    }

    setQSaving(true);
    try {
      const id = await upsertQuestion({
        testId,
        questionId: editingId || undefined,
        publicData: {
          questionNo: qForm.questionNo,
          text: qForm.text.trim(),
          imageUrl: qForm.imageUrl?.trim() || "",
          options: opts,
          marks: Math.max(1, Number(qForm.marks || 1)),
        },
        privateData: {
          correctIndex: qForm.correctIndex,
        },
      });

      if (qImageFile) {
        setQImageUploading(true);
        const url = await uploadQuestionImage({ testId, questionId: id, file: qImageFile });
        await upsertQuestion({
          testId,
          questionId: id,
          publicData: {
            questionNo: qForm.questionNo,
            text: qForm.text.trim(),
            imageUrl: url,
            options: opts,
            marks: Math.max(1, Number(qForm.marks || 1)),
          },
          privateData: { correctIndex: qForm.correctIndex },
        });
      }

      const updated = await listPublicQuestions(testId);
      setQuestions(updated);
      setDialogOpen(false);
      setEditingId(null);
      setQForm(emptyQuestion(updated.length + 1));
      setQImageFile(null);
      setQImageUploading(false);
      if (!id) return;
    } catch (e) {
      console.error(e);
      alert("Save failed");
    } finally {
      setQSaving(false);
      setQImageUploading(false);
    }
  };

  const removeQuestion = async (qid: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteQuestion(testId, qid);
      const updated = await listPublicQuestions(testId);
      setQuestions(updated);
    } catch (e) {
      console.error(e);
      alert("Delete failed");
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading exam editor...</div>;
  }

  if (!test) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Exam not found</AlertTitle>
        <AlertDescription>Invalid exam id.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" className="-ml-3" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {test.title}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {test.subject}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {test.durationMinutes} min
            </Badge>
            <Badge variant="outline" className="text-xs">
              Window: {new Date(test.startAt).toLocaleString()} – {new Date(test.endAt).toLocaleString()}
            </Badge>
            {savingMeta ? (
              <Badge className="bg-slate-100 text-slate-800">Updating totals…</Badge>
            ) : (
              <Badge className="bg-indigo-100 text-indigo-800">
                {test.totalQuestions} questions • {test.totalMarks} marks
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings2 className="w-4 h-4 mr-2" />
                Edit Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Edit exam details</DialogTitle>
                <DialogDescription>Update timing, subject, visibility, and instructions.</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Title *</Label>
                    <Input
                      value={metaForm?.title || ""}
                      onChange={(e) => setMetaForm((p) => (p ? { ...p, title: e.target.value } : p))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Batch *</Label>
                    <Select
                      value={metaForm?.batchId || test.batchId}
                      onValueChange={(v) =>
                        setMetaForm((p) =>
                          p
                            ? {
                                ...p,
                                batchId: v,
                                selectedStudentRecordIds: [],
                              }
                            : p,
                        )
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
                    <Input
                      value={metaForm?.subject || ""}
                      onChange={(e) => setMetaForm((p) => (p ? { ...p, subject: e.target.value } : p))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Start (date & time) *</Label>
                    <Input
                      type="datetime-local"
                      value={metaForm?.startAtLocal || ""}
                      onChange={(e) => setMetaForm((p) => (p ? { ...p, startAtLocal: e.target.value } : p))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End (date & time) *</Label>
                    <Input
                      type="datetime-local"
                      value={metaForm?.endAtLocal || ""}
                      onChange={(e) => setMetaForm((p) => (p ? { ...p, endAtLocal: e.target.value } : p))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Duration (minutes) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={metaForm?.durationMinutes || "60"}
                      onChange={(e) =>
                        setMetaForm((p) => (p ? { ...p, durationMinutes: e.target.value } : p))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Negative mark per wrong</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.25}
                      value={metaForm?.negativeMarkPerWrong || "0"}
                      onChange={(e) =>
                        setMetaForm((p) => (p ? { ...p, negativeMarkPerWrong: e.target.value } : p))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Show correct answers</Label>
                    <Select
                      value={metaForm?.showAnswersAfter || "after_end"}
                      onValueChange={(v) =>
                        setMetaForm((p) =>
                          p ? { ...p, showAnswersAfter: v as ExamShowAnswersAfter } : p,
                        )
                      }
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
                      value={metaForm?.visibility || "BATCH"}
                      onValueChange={(v) =>
                        setMetaForm((p) =>
                          p
                            ? {
                                ...p,
                                visibility: v as ExamVisibility,
                                selectedStudentRecordIds: [],
                              }
                            : p,
                        )
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

                  {metaForm?.visibility === "SELECTIVE" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Select students</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-3">
                        {batchStudents.map((s) => {
                          const checked = metaForm.selectedStudentRecordIds.includes(s.id);
                          return (
                            <button
                              type="button"
                              key={s.id}
                              className={`text-left rounded-lg border px-3 py-2 transition-all ${
                                checked
                                  ? "border-indigo-400 bg-indigo-50"
                                  : "border-slate-200 hover:bg-slate-50"
                              }`}
                              onClick={() =>
                                setMetaForm((p) => {
                                  if (!p) return p;
                                  const has = p.selectedStudentRecordIds.includes(s.id);
                                  return {
                                    ...p,
                                    selectedStudentRecordIds: has
                                      ? p.selectedStudentRecordIds.filter((x) => x !== s.id)
                                      : [...p.selectedStudentRecordIds, s.id],
                                  };
                                })
                              }
                            >
                              <div className="font-medium text-slate-900">{s.name}</div>
                              <div className="text-xs text-slate-600">{s.email}</div>
                            </button>
                          );
                        })}
                        {batchStudents.length === 0 ? (
                          <div className="text-sm text-slate-500">No students in this batch.</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2 md:col-span-2">
                    <Label>Test password</Label>
                    <Input
                      value={metaForm?.accessPassword || ""}
                      onChange={(e) =>
                        setMetaForm((p) => (p ? { ...p, accessPassword: e.target.value } : p))
                      }
                      placeholder={
                        metaForm?.hadPasswordInitially
                          ? "Enter new password to change (leave empty to clear)"
                          : "Optional password students must enter"
                      }
                    />
                    <div className="text-[11px] text-slate-500">
                      {metaForm?.hadPasswordInitially
                        ? "Leave empty and save to remove the password. Enter a value to change it."
                        : "If set, students must enter this password before starting the exam."}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Instructions</Label>
                    <Textarea
                      value={metaForm?.instructions || ""}
                      onChange={(e) =>
                        setMetaForm((p) => (p ? { ...p, instructions: e.target.value } : p))
                      }
                      placeholder="Shown to students..."
                      className="min-h-20"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setMetaOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => void saveMeta()}
                  disabled={metaSaving}
                >
                  {metaSaving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit question" : "Add question"}</DialogTitle>
                <DialogDescription>
                  Correct answers are stored securely in a private subcollection.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Question No</Label>
                    <Input
                      type="number"
                      min={1}
                      value={qForm.questionNo}
                      onChange={(e) =>
                        setQForm({ ...qForm, questionNo: parseInt(e.target.value || "1", 10) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marks</Label>
                    <Input
                      type="number"
                      min={1}
                      value={qForm.marks}
                      onChange={(e) =>
                        setQForm({ ...qForm, marks: parseInt(e.target.value || "1", 10) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Correct option</Label>
                    <Input
                      type="number"
                      min={1}
                      max={qForm.options.length}
                      value={qForm.correctIndex + 1}
                      onChange={(e) =>
                        setQForm({
                          ...qForm,
                          correctIndex: Math.max(0, parseInt(e.target.value || "1", 10) - 1),
                        })
                      }
                    />
                    <div className="text-[11px] text-slate-500">Enter 1 to 4</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Question</Label>
                  <Textarea
                    value={qForm.text}
                    onChange={(e) => setQForm({ ...qForm, text: e.target.value })}
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData?.items || []);
                      const img = items.find((i) => i.type.startsWith("image/"));
                      if (!img) return;
                      const file = img.getAsFile();
                      if (!file) return;
                      setQImageFile(file);
                      e.preventDefault();
                    }}
                    placeholder="Type the question text..."
                    className="min-h-24"
                  />
                  <div className="text-[11px] text-slate-500">
                    Tip: you can paste a screenshot here (Ctrl+V).
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Question screenshot (optional)</Label>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setQImageFile(e.target.files?.[0] || null)}
                    />
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      JPG/PNG/WebP supported
                    </div>
                  </div>
                  {qLocalPreviewUrl ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                      <img
                        src={qLocalPreviewUrl}
                        alt="New question screenshot preview"
                        className="w-full max-h-[35vh] object-contain"
                      />
                      <div className="p-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-600 truncate">
                          Selected image will upload on save
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQImageFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : qForm.imageUrl ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                      <img
                        src={qForm.imageUrl}
                        alt="Question screenshot"
                        className="w-full max-h-[35vh] object-contain"
                      />
                      <div className="p-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-600 truncate">{qForm.imageUrl}</div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQForm({ ...qForm, imageUrl: "" })}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {qForm.options.map((opt, idx) => (
                    <div key={idx} className="space-y-2">
                      <Label>Option {String.fromCharCode(65 + idx)}</Label>
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...qForm.options];
                          next[idx] = e.target.value;
                          setQForm({ ...qForm, options: next });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      />
                    </div>
                  ))}
                </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => void saveQuestion()}
                  disabled={qSaving || qImageUploading}
                >
                  {qSaving || qImageUploading ? "Saving..." : "Save Question"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {test.instructions ? (
        <Alert className="border-slate-200 bg-white">
          <AlertTitle>Instructions</AlertTitle>
          <AlertDescription>{test.instructions}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Questions</CardTitle>
          <Badge variant="outline" className="text-xs">
            {questions.length} total
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 ? (
            <div className="text-sm text-slate-500">
              No questions yet. Click <span className="font-semibold">Add Question</span>.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                          Q{q.questionNo}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {q.marks} mark{q.marks === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-slate-900 whitespace-pre-wrap">{q.text}</div>
                      {q.imageUrl ? (
                        <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                          <img
                            src={q.imageUrl}
                            alt={`Q${q.questionNo} screenshot`}
                            className="w-full max-h-64 object-contain"
                          />
                        </div>
                      ) : null}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {q.options.map((o, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                            {o}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-indigo-700 hover:bg-indigo-50"
                        onClick={() => void openEdit(q)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-700 hover:bg-rose-50"
                        onClick={() => void removeQuestion(q.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

