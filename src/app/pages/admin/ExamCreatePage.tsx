import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import ExamBatchAssignmentFields, {
  inferExamBatchMode,
  type ExamBatchMode,
} from "../../components/exams/ExamBatchAssignmentFields";
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
  const [batchMode, setBatchMode] = useState<ExamBatchMode>("single");
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
            Start with basic details. You can change batch assignment later under Setup Test.
          </p>
          <div className="space-y-2">
            <Label>Test Name</Label>
            <Input value={testName} onChange={(e) => setTestName(e.target.value)} />
          </div>
          <ExamBatchAssignmentFields
            batches={batches.map((b) => ({ id: b.id, name: b.name }))}
            mode={batchMode}
            batchIds={batchIds}
            onModeChange={setBatchMode}
            onBatchIdsChange={(ids) => {
              setBatchIds(ids);
              setBatchMode(inferExamBatchMode(ids));
            }}
            hint="Choose single batch or multiple batches. You can adjust this anytime in test settings."
          />
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
