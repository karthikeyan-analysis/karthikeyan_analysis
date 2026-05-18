import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../components/ui/utils";
import { useNavigate, useParams } from "react-router";
import {
  deleteQuestion,
  getExamTest,
  listPrivateQuestions,
  listPublicQuestions,
  updateExamTest,
  uploadQuestionImage,
  upsertQuestion,
} from "../../features/exams/examApi";
import type { ExamQuestionPublic, ExamTest } from "../../features/exams/types";
import { Plus, Save, Trash2 } from "lucide-react";

type EditorQuestion = {
  localId: string;
  questionId?: string;
  text: string;
  options: string[];
  correctIndex: number;
  marks: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreviewUrl: string;
};

const DEFAULT_5_OPTIONS = ["A", "B", "C", "D", "E"];

function fromPublicQuestion(q: ExamQuestionPublic, correctIndex = 0): EditorQuestion {
  const options = q.options?.length ? [...q.options] : [...DEFAULT_5_OPTIONS];
  return {
    localId: q.id,
    questionId: q.id,
    text: q.text || "",
    options,
    correctIndex: Math.max(0, Math.min(correctIndex, Math.max(0, options.length - 1))),
    marks: String(q.marks || 1),
    imageUrl: q.imageUrl || "",
    imageFile: null,
    imagePreviewUrl: "",
  };
}

function newQuestion(): EditorQuestion {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text: "",
    options: [...DEFAULT_5_OPTIONS],
    correctIndex: 0,
    marks: "1",
    imageUrl: "",
    imageFile: null,
    imagePreviewUrl: "",
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ExamQuestionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const testId = id || "";
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [test, setTest] = useState<ExamTest | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [editorQuestions, setEditorQuestions] = useState<EditorQuestion[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadData = async () => {
    const [t, qs, privateQs] = await Promise.all([
      getExamTest(testId),
      listPublicQuestions(testId),
      listPrivateQuestions(testId),
    ]);
    const keyById = new Map(privateQs.map((x) => [x.id, x.correctIndex]));
    setTest(t);
    setQuestions(qs);
    setEditorQuestions(qs.map((q) => fromPublicQuestion(q, keyById.get(q.id) || 0)));
  };

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await loadData();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      setEditorQuestions((prev) => {
        prev.forEach((q) => {
          if (q.imagePreviewUrl) URL.revokeObjectURL(q.imagePreviewUrl);
        });
        return prev;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const totals = useMemo(() => {
    return {
      totalQuestions: questions.length,
      totalMarks: questions.reduce((acc, q) => acc + (q.marks || 0), 0),
    };
  }, [questions]);

  useEffect(() => {
    if (!testId || !test) return;
    if (test.totalQuestions === totals.totalQuestions && test.totalMarks === totals.totalMarks) return;
    let cancelled = false;
    const syncTotals = async () => {
      try {
        await updateExamTest(testId, totals);
        if (cancelled) return;
        setTest((prev) => (prev ? { ...prev, ...totals } : prev));
      } catch (e) {
        console.error(e);
      }
    };
    void syncTotals();
    return () => {
      cancelled = true;
    };
  }, [test, testId, totals]);

  const updateQuestion = (localId: string, updater: (q: EditorQuestion) => EditorQuestion) => {
    setEditorQuestions((prev) => prev.map((q) => (q.localId === localId ? updater(q) : q)));
  };

  const addOption = (localId: string) => {
    updateQuestion(localId, (q) => ({
      ...q,
      options: [...q.options, ""],
    }));
  };

  const removeOption = (localId: string, optionIndex: number) => {
    updateQuestion(localId, (q) => {
      if (q.options.length <= 2) return q;
      const next = q.options.filter((_, idx) => idx !== optionIndex);
      const nextCorrect = clamp(q.correctIndex > optionIndex ? q.correctIndex - 1 : q.correctIndex, 0, next.length - 1);
      return { ...q, options: next, correctIndex: nextCorrect };
    });
  };

  const attachImageFile = (localId: string, file: File | null) => {
    updateQuestion(localId, (q) => {
      if (q.imagePreviewUrl) URL.revokeObjectURL(q.imagePreviewUrl);
      if (!file) return { ...q, imageFile: null, imagePreviewUrl: "" };
      return { ...q, imageFile: file, imagePreviewUrl: URL.createObjectURL(file) };
    });
  };

  const handlePasteImage = (localId: string, e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find((item) => item.type.startsWith("image/"));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (!file) return;
    attachImageFile(localId, file);
    e.preventDefault();
  };

  const addQuestion = () => {
    setEditorQuestions((prev) => [...prev, newQuestion()]);
  };

  const removeQuestion = async (localId: string) => {
    if (!confirm("Delete this question?")) return;
    const target = editorQuestions.find((q) => q.localId === localId);
    if (!target) return;
    if (target.imagePreviewUrl) URL.revokeObjectURL(target.imagePreviewUrl);
    try {
      if (target.questionId) {
        await deleteQuestion(testId, target.questionId);
        const updated = await listPublicQuestions(testId);
        setQuestions(updated);
      }
      setEditorQuestions((prev) => prev.filter((q) => q.localId !== localId));
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  };

  const validateQuestion = (q: EditorQuestion, index: number) => {
    const hasText = Boolean(q.text.trim());
    const hasImage = Boolean(q.imageFile || q.imageUrl.trim());
    if (!hasText && !hasImage) {
      return `Question ${index + 1}: add question text or paste/upload a screenshot.`;
    }
    const cleaned = q.options.map((x) => x.trim()).filter(Boolean);
    if (cleaned.length < 2) return `Question ${index + 1}: at least 2 options are required.`;
    if (q.correctIndex < 0 || q.correctIndex >= cleaned.length) {
      return `Question ${index + 1}: select a valid correct option.`;
    }
    return "";
  };

  const saveAll = async () => {
    if (!testId) return;
    for (let i = 0; i < editorQuestions.length; i += 1) {
      const err = validateQuestion(editorQuestions[i], i);
      if (err) {
        alert(err);
        return;
      }
    }

    setSavingAll(true);
    try {
      for (let i = 0; i < editorQuestions.length; i += 1) {
        const q = editorQuestions[i];
        const options = q.options.map((x) => x.trim()).filter(Boolean);
        const questionId = await upsertQuestion({
          testId,
          questionId: q.questionId,
          publicData: {
            questionNo: i + 1,
            text: q.text.trim(),
            imageUrl: q.imageUrl.trim(),
            options,
            marks: Math.max(1, parseFloat(q.marks || "1") || 1),
          },
          privateData: {
            correctIndex: clamp(q.correctIndex, 0, options.length - 1),
          },
        });

        if (q.imageFile) {
          const uploadedUrl = await uploadQuestionImage({
            testId,
            questionId,
            file: q.imageFile,
          });
          await upsertQuestion({
            testId,
            questionId,
            publicData: {
              questionNo: i + 1,
              text: q.text.trim(),
              imageUrl: uploadedUrl,
              options,
              marks: Math.max(1, parseFloat(q.marks || "1") || 1),
            },
            privateData: {
              correctIndex: clamp(q.correctIndex, 0, options.length - 1),
            },
          });
        }
      }

      await loadData();
      alert("Questions saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save questions.");
    } finally {
      setSavingAll(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading questions...</div>;

  return (
    <div className="space-y-6">
      {editorQuestions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-slate-500">No questions added yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {editorQuestions.map((q, idx) => (
            <Card key={q.localId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                  <Button variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => void removeQuestion(q.localId)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Question (type or paste screenshot)</Label>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    <Textarea
                      value={q.text}
                      onChange={(e) => updateQuestion(q.localId, (prev) => ({ ...prev, text: e.target.value }))}
                      onPaste={(e) => handlePasteImage(q.localId, e)}
                      placeholder="Type your question here, or paste an image (Ctrl+V)."
                      className="min-h-24 border-slate-200"
                    />

                    {q.imagePreviewUrl ? (
                      <img
                        src={q.imagePreviewUrl}
                        alt={`Question ${idx + 1} preview`}
                        className="w-full max-h-80 object-contain rounded-lg border border-slate-200 bg-slate-50"
                      />
                    ) : q.imageUrl ? (
                      <img
                        src={q.imageUrl}
                        alt={`Question ${idx + 1}`}
                        className="w-full max-h-80 object-contain rounded-lg border border-slate-200 bg-slate-50"
                      />
                    ) : (
                      <div className="text-xs text-slate-500">
                        Paste a screenshot here (Ctrl+V) or use Upload.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={(el) => {
                          fileInputRefs.current[q.localId] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => attachImageFile(q.localId, e.target.files?.[0] || null)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[q.localId]?.click()}
                      >
                        Upload image
                      </Button>
                      {(q.imagePreviewUrl || q.imageUrl) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateQuestion(q.localId, (prev) => ({ ...prev, imageUrl: "" }));
                            attachImageFile(q.localId, null);
                          }}
                        >
                          Remove image
                        </Button>
                      ) : null}
                      <div className="text-[11px] text-slate-500">
                        Tip: copy an image and press Ctrl+V inside the text box.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Options</Label>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`Correct option for question ${idx + 1}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    {q.options.slice(0, 5).map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const selected = q.correctIndex === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() =>
                            updateQuestion(q.localId, (prev) => ({
                              ...prev,
                              correctIndex: optIdx,
                            }))
                          }
                          className={cn(
                            "h-9 px-3 rounded-lg border text-sm font-semibold transition-colors",
                            selected
                              ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                          aria-checked={selected}
                          role="radio"
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Five choices (A–E) are fixed. Click the correct letter.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2 md:max-w-[160px]">
                    <Label>Marks</Label>
                    <Input
                      type="number"
                      min={1}
                      value={q.marks}
                      onChange={(e) =>
                        updateQuestion(q.localId, (prev) => ({ ...prev, marks: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="sticky bottom-4">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
            <Button
              variant="outline"
              onClick={() => void saveAll()}
              disabled={savingAll || editorQuestions.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              {savingAll ? "Saving..." : "Save All"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/tests/${testId}/publish`)}
              disabled={editorQuestions.length === 0}
            >
              Next: Publish
            </Button>
          </div>
          <div className="mt-2 text-center text-[11px] text-slate-500">
            {editorQuestions.length} question{editorQuestions.length === 1 ? "" : "s"} •{" "}
            {test?.totalMarks || 0} marks
          </div>
        </div>
      </div>
    </div>
  );
}

