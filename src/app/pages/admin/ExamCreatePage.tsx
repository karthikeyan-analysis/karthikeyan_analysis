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
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import ExamBatchAssignmentFields, {
  inferExamBatchMode,
  type ExamBatchMode,
} from "../../components/exams/ExamBatchAssignmentFields";
import { QuestionMarksSelect } from "../../components/exams/QuestionMarksSelect";
import { normalizeExamBatchFields } from "../../features/exams/examBatchUtils";
import { createExamTest } from "../../features/exams/examApi";
import { sha256Base64 } from "../../features/exams/password";
import {
  DEFAULT_MARKS_PER_QUESTION,
  type QuestionMarkOption,
} from "../../features/exams/examMarks";
import { DEFAULT_EXAM_SETTINGS } from "../../features/exams/settings";

type AudienceMode = "selected_batches" | "all_batches";
type SubjectMode = "common" | "per_batch";

export default function ExamCreatePage() {
  const navigate = useNavigate();
  const { batches } = useData();
  const [creating, setCreating] = useState(false);
  const [testName, setTestName] = useState("demo");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("selected_batches");
  const [batchMode, setBatchMode] = useState<ExamBatchMode>("single");
  const [batchIds, setBatchIds] = useState<string[]>(() =>
    batches[0]?.id ? [batches[0].id] : [],
  );
  const [subjectMode, setSubjectMode] = useState<SubjectMode>("common");
  const [subject, setSubject] = useState("");
  const [subjectByBatchId, setSubjectByBatchId] = useState<Record<string, string>>({});
  const [passcode, setPasscode] = useState("");
  const [defaultMarksPerQuestion, setDefaultMarksPerQuestion] =
    useState<QuestionMarkOption>(DEFAULT_MARKS_PER_QUESTION);

  const effectiveBatchIds = useMemo(() => {
    if (audienceMode === "all_batches") return batches.map((b) => b.id);
    return batchIds;
  }, [audienceMode, batchIds, batches]);

  const selectedBatches = useMemo(
    () =>
      effectiveBatchIds.flatMap((id) => {
        const batch = batches.find((b) => b.id === id);
        return batch ? [batch] : [];
      }),
    [effectiveBatchIds, batches],
  );

  const subjects = useMemo(() => {
    const names = new Set<string>();
    for (const id of effectiveBatchIds) {
      const batch = batches.find((b) => b.id === id);
      for (const s of batch?.subjects || []) {
        const t = s.trim();
        if (t) names.add(t);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [effectiveBatchIds, batches]);

  const create = async () => {
    if (!testName.trim()) {
      alert("Please enter test name.");
      return;
    }
    let normalized: { batchId: string; batchIds: string[] };
    try {
      normalized = normalizeExamBatchFields(effectiveBatchIds);
    } catch {
      alert("Please select at least one batch.");
      return;
    }
    const cleanSubjectByBatch = Object.fromEntries(
      normalized.batchIds.map((id) => [id, (subjectByBatchId[id] || "").trim()]),
    );
    if (subjectMode === "common" && !subject.trim()) {
      alert("Please select or enter a common subject.");
      return;
    }
    if (subjectMode === "per_batch" && Object.values(cleanSubjectByBatch).some((s) => !s)) {
      alert("Please select a subject for every selected batch.");
      return;
    }
    if (!passcode.trim()) {
      alert("Passcode is mandatory for every test.");
      return;
    }
    setCreating(true);
    try {
      const now = Date.now();
      const start = new Date(now - 60_000).toISOString();
      const end = new Date(now + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const resolvedSubject =
        subjectMode === "common"
          ? subject.trim()
          : [...new Set(Object.values(cleanSubjectByBatch))].join(", ");
      const accessPasswordHash = await sha256Base64(passcode.trim());
      const id = await createExamTest({
        title: testName.trim(),
        batchId: normalized.batchId,
        batchIds: normalized.batchIds,
        subject: resolvedSubject,
        subjectMode,
        subjectByBatchId: subjectMode === "per_batch" ? cleanSubjectByBatch : {},
        instructions: "",
        accessPasswordHash,
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
        settings: { ...DEFAULT_EXAM_SETTINGS, accessMode: "both" },
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
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <Label>Test coverage</Label>
              <p className="mt-1 text-xs text-slate-500">
                Choose whether this is a common test for every batch or only selected batches.
              </p>
            </div>
            <RadioGroup
              value={audienceMode}
              onValueChange={(v) => {
                const next = v as AudienceMode;
                setAudienceMode(next);
                if (next === "all_batches") {
                  const ids = batches.map((b) => b.id);
                  setBatchIds(ids);
                  setBatchMode(inferExamBatchMode(ids));
                }
              }}
              className="grid gap-2 md:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <RadioGroupItem value="all_batches" className="mt-0.5" />
                <span>
                  <span className="block font-semibold text-slate-900">Common test for all batches</span>
                  <span className="text-xs text-slate-500">Automatically includes every current batch.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <RadioGroupItem value="selected_batches" className="mt-0.5" />
                <span>
                  <span className="block font-semibold text-slate-900">Selected batch test</span>
                  <span className="text-xs text-slate-500">Pick one batch or multiple batches manually.</span>
                </span>
              </label>
            </RadioGroup>
          </div>
          {audienceMode === "selected_batches" ? (
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
          ) : (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-indigo-900">
              All {batches.length} batch{batches.length === 1 ? "" : "es"} will be included.
            </div>
          )}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div>
              <Label>Subject assignment</Label>
              <p className="mt-1 text-xs text-slate-500">
                Use one common subject, or set a different subject label for each selected batch.
              </p>
            </div>
            <RadioGroup
              value={subjectMode}
              onValueChange={(v) => setSubjectMode(v as SubjectMode)}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <RadioGroupItem value="common" />
                Common subject
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <RadioGroupItem value="per_batch" />
                Subject per batch
              </label>
            </RadioGroup>
            {subjectMode === "common" ? (
              <div className="space-y-2">
                <Label>Common Subject</Label>
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
            ) : (
              <div className="space-y-3">
                {selectedBatches.map((batch) => {
                  const batchSubjects = batch?.subjects || [];
                  return (
                    <div key={batch.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[220px_1fr] md:items-center">
                      <div className="text-sm font-medium text-slate-800">{batch.name}</div>
                      {batchSubjects.length > 0 ? (
                        <Select
                          value={subjectByBatchId[batch.id] || ""}
                          onValueChange={(v) =>
                            setSubjectByBatchId((prev) => ({ ...prev, [batch.id]: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject for this batch" />
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
                          value={subjectByBatchId[batch.id] || ""}
                          onChange={(e) =>
                            setSubjectByBatchId((prev) => ({ ...prev, [batch.id]: e.target.value }))
                          }
                          placeholder="Enter subject"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <Label>Mandatory Passcode</Label>
            <Input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Set passcode for enrolled students and link users"
            />
            <p className="text-xs text-amber-800">
              Every test is password protected by default. Enrolled students and unenrolled students using the join link
              must enter the passcode before starting.
            </p>
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
