import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { QuestionMarksSelect } from "../../components/exams/QuestionMarksSelect";
import { normalizeExamBatchFields } from "../../features/exams/examBatchUtils";
import { createExamTest } from "../../features/exams/examApi";
import {
  DEFAULT_MARKS_PER_QUESTION,
  type QuestionMarkOption,
} from "../../features/exams/examMarks";
import { DEFAULT_EXAM_SETTINGS } from "../../features/exams/settings";

export default function ExamCreatePage() {
  const navigate = useNavigate();
  const { batches } = useData();
  const [creating, setCreating] = useState(false);
  const [testName, setTestName] = useState("demo");
  const [batchIds, setBatchIds] = useState<string[]>(() =>
    batches[0]?.id ? [batches[0].id] : [],
  );
  const [subject, setSubject] = useState("");
  const [defaultMarksPerQuestion, setDefaultMarksPerQuestion] =
    useState<QuestionMarkOption>(DEFAULT_MARKS_PER_QUESTION);

  const subjects = useMemo(() => {
    const names = new Set<string>();
    for (const id of batchIds) {
      const batch = batches.find((b) => b.id === id);
      for (const s of batch?.subjects || []) {
        const t = s.trim();
        if (t) names.add(t);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [batchIds, batches]);

  const toggleBatch = (id: string, checked: boolean) => {
    setBatchIds((prev) => {
      const next = checked ? [...prev, id] : prev.filter((b) => b !== id);
      return next;
    });
    setSubject((prev) => {
      if (!checked) return prev;
      const batch = batches.find((b) => b.id === id);
      const first = batch?.subjects?.[0]?.trim();
      return prev || first || prev;
    });
  };

  const create = async () => {
    if (!testName.trim()) {
      alert("Please enter test name.");
      return;
    }
    let normalized: { batchId: string; batchIds: string[] };
    try {
      normalized = normalizeExamBatchFields(batchIds);
    } catch {
      alert("Please select at least one batch.");
      return;
    }
    if (!subject.trim()) {
      alert("Please select or enter a subject.");
      return;
    }
    setCreating(true);
    try {
      const now = Date.now();
      const start = new Date(now - 60_000).toISOString();
      const end = new Date(now + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const id = await createExamTest({
        title: testName.trim(),
        batchId: normalized.batchId,
        batchIds: normalized.batchIds,
        subject: subject.trim(),
        instructions: "",
        startAt: start,
        endAt: end,
        durationMinutes: 60,
        totalQuestions: 0,
        totalMarks: 0,
        defaultMarksPerQuestion,
        negativeMarkPerWrong: 0,
        showAnswersAfter: "after_end",
        visibility: "BATCH",
        selectedStudentRecordIds: [],
        status: "draft",
        settings: DEFAULT_EXAM_SETTINGS,
      });
      navigate(`/admin/tests/${id}/dashboard`);
    } catch (e) {
      console.error(e);
      alert("Could not create test.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Create a New Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Start with basic details. You can configure all advanced settings in the next step.
          </p>
          <div className="space-y-2">
            <Label>Test Name</Label>
            <Input value={testName} onChange={(e) => setTestName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Batches *</Label>
            <p className="text-xs text-slate-500">
              Select one or more batches. Students in any selected batch will see this test.
            </p>
            <div className="rounded-lg border border-slate-200 p-3 max-h-48 overflow-y-auto space-y-2">
              {batches.length === 0 ? (
                <p className="text-sm text-slate-500">No batches yet. Create a batch first.</p>
              ) : (
                batches.map((batch) => {
                  const checked = batchIds.includes(batch.id);
                  return (
                    <label
                      key={batch.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleBatch(batch.id, v === true)}
                      />
                      <span className="text-sm font-medium text-slate-800">{batch.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            {batchIds.length > 0 ? (
              <p className="text-xs text-slate-600">
                Selected: {batchIds.length} batch{batchIds.length === 1 ? "" : "es"}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            {subjects.length > 0 ? (
              <Select value={subject} onValueChange={(v) => setSubject(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            )}
          </div>
          <QuestionMarksSelect
            value={defaultMarksPerQuestion}
            onChange={setDefaultMarksPerQuestion}
            hint="Used for each new question you add. You can still change marks per question later."
          />
          <div className="flex justify-end">
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void create()} disabled={creating}>
              {creating ? "Creating..." : "Create and Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
