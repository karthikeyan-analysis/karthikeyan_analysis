import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { QuestionMarksSelect } from "../../components/exams/QuestionMarksSelect";
import {
  DEFAULT_MARKS_PER_QUESTION,
  normalizeQuestionMarks,
  type QuestionMarkOption,
} from "../../features/exams/examMarks";
import { sha256Base64 } from "../../features/exams/password";
import { getExamTest, updateExamTest } from "../../features/exams/examApi";
import { applySystemExamSettingLocks, getEffectiveExamSettings } from "../../features/exams/settings";
import ExamBatchAssignmentFields, {
  inferExamBatchMode,
  type ExamBatchMode,
} from "../../components/exams/ExamBatchAssignmentFields";
import {
  formatExamBatchLabel,
  getExamBatchIds,
  normalizeExamBatchFields,
} from "../../features/exams/examBatchUtils";
import type { ExamAccessMode, ExamAdvancedSettings, ExamTest } from "../../features/exams/types";

type FormState = {
  title: string;
  batchMode: ExamBatchMode;
  batchIds: string[];
  durationMinutes: string;
  negativeMarkPerWrong: string;
  defaultMarksPerQuestion: QuestionMarkOption;
  passcode: string;
  settings: Required<ExamAdvancedSettings>;
};

export default function ExamSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const testId = id || "";
  const { students, batches } = useData();
  const [test, setTest] = useState<ExamTest | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const t = await getExamTest(testId);
        if (!t || cancelled) return;
        const settings = getEffectiveExamSettings(t);
        setTest(t);
        const loadedBatchIds = getExamBatchIds(t);
        setForm({
          title: t.title || "",
          batchMode: inferExamBatchMode(loadedBatchIds),
          batchIds: loadedBatchIds,
          durationMinutes: String(t.durationMinutes || 60),
          negativeMarkPerWrong: String(t.negativeMarkPerWrong || 0),
          defaultMarksPerQuestion: normalizeQuestionMarks(
            t.defaultMarksPerQuestion,
            DEFAULT_MARKS_PER_QUESTION,
          ) as QuestionMarkOption,
          passcode: "",
          settings,
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const batchStudentCount = useMemo(() => {
    if (!form) return 0;
    const batchIdSet = new Set(form.batchIds);
    return students.filter((s) => s.batchId && batchIdSet.has(s.batchId)).length;
  }, [form, students]);

  const selectedBatchLabel = useMemo(() => {
    if (!form) return "—";
    return formatExamBatchLabel(
      { batchId: form.batchIds[0] || "", batchIds: form.batchIds },
      batches,
    );
  }, [form, batches]);

  const save = async () => {
    if (!form || !test) return;
    if (!form.title.trim()) {
      alert("Test name is required.");
      return;
    }

    let batchFields: { batchId: string; batchIds: string[] };
    try {
      batchFields = normalizeExamBatchFields(form.batchIds);
    } catch {
      alert("Select at least one batch.");
      return;
    }

    // Schedule is system-managed to keep tests available without manual windows.
    const now = Date.now();
    const startAt = test.startAt || new Date(now - 60_000).toISOString();
    const endAt = test.endAt || new Date(now + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const accessMode = form.settings.accessMode as ExamAccessMode;
    const usesPasscode = accessMode === "passcode" || accessMode === "both";

    if (usesPasscode && !form.passcode.trim() && !test.accessPasswordHash) {
      alert("Set a passcode for this access mode.");
      return;
    }

    const settings: ExamAdvancedSettings = applySystemExamSettingLocks({
      ...form.settings,
      allowedIdentifiers: [],
      allowedEmails: [],
    });

    setSaving(true);
    try {
      const updates: Partial<ExamTest> = {
        title: form.title.trim(),
        batchId: batchFields.batchId,
        batchIds: batchFields.batchIds,
        startAt,
        endAt,
        durationMinutes: Math.max(1, parseInt(form.durationMinutes || "60", 10) || 60),
        negativeMarkPerWrong: form.settings.negativeMarkingEnabled
          ? Math.max(0, parseFloat(form.negativeMarkPerWrong || "0") || 0)
          : 0,
        defaultMarksPerQuestion: form.defaultMarksPerQuestion,
        visibility: "BATCH",
        selectedStudentRecordIds: [],
        settings,
      };

      const clearPassword = accessMode === "batch";
      const wantsPassword = usesPasscode && form.passcode.trim().length > 0;
      if (clearPassword) {
        (updates as Partial<ExamTest> & { accessPasswordHash?: string | null }).accessPasswordHash = null;
      } else if (wantsPassword) {
        (updates as Partial<ExamTest> & { accessPasswordHash?: string }).accessPasswordHash =
          await sha256Base64(form.passcode.trim());
      }

      await updateExamTest(testId, updates as Partial<ExamTest> & { accessPasswordHash?: string | null });
      setTest((prev) => (prev ? { ...prev, ...updates } : prev));
      setForm((prev) => (prev ? { ...prev, passcode: "" } : prev));
      alert("Settings saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form || !test) return <div className="text-sm text-slate-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Setup Test</div>
            <div className="text-xs text-slate-600">
              Configure access, time limit, question behavior, and notifications.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/admin/tests/${testId}/questions`)}>
              Go to Questions
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Test Name</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <ExamBatchAssignmentFields
            batches={batches.map((b) => ({ id: b.id, name: b.name }))}
            mode={form.batchMode}
            batchIds={form.batchIds}
            onModeChange={(batchMode) => setForm({ ...form, batchMode })}
            onBatchIdsChange={(batchIds) =>
              setForm({
                ...form,
                batchIds,
                batchMode: inferExamBatchMode(batchIds),
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <QuestionMarksSelect
            value={form.defaultMarksPerQuestion}
            onChange={(v) => setForm({ ...form, defaultMarksPerQuestion: v })}
            hint="Applies when you add new questions on the Questions tab."
          />
          <SettingToggle
            label="Show all test questions on one page"
            checked={form.settings.paginationMode === "all_on_one_page"}
            onChange={(value) =>
              setForm({
                ...form,
                settings: {
                  ...form.settings,
                  paginationMode: value ? "all_on_one_page" : "one_per_page",
                },
              })
            }
          />
          <SettingToggle
            label="Randomize the order of questions"
            checked={form.settings.randomizeQuestionOrder}
            onChange={(value) =>
              setForm({ ...form, settings: { ...form.settings, randomizeQuestionOrder: value } })
            }
          />
          <SettingToggle
            label="Allow students to submit blank/empty answers"
            checked={form.settings.allowBlankAnswers}
            onChange={(value) => setForm({ ...form, settings: { ...form.settings, allowBlankAnswers: value } })}
          />
          <SettingToggle
            label="Penalize incorrect answers (negative marking)"
            checked={form.settings.negativeMarkingEnabled}
            onChange={(value) =>
              setForm({ ...form, settings: { ...form.settings, negativeMarkingEnabled: value } })
            }
          />
          {form.settings.negativeMarkingEnabled ? (
            <div className="space-y-2">
              <Label>Negative marks per wrong answer</Label>
              <Input
                type="number"
                min={0}
                step={0.25}
                value={form.negativeMarkPerWrong}
                onChange={(e) => setForm({ ...form, negativeMarkPerWrong: e.target.value })}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Who can take your test?</Label>
            <select
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={form.settings.accessMode}
              onChange={(e) =>
                setForm({
                  ...form,
                  settings: { ...form.settings, accessMode: e.target.value as ExamAccessMode },
                })
              }
            >
              <option value="batch">Students in selected batch(es) only</option>
              <option value="passcode">Anyone who enters a passcode</option>
              <option value="both">Both — selected batch(es) and passcode link</option>
            </select>
          </div>

          {form.settings.accessMode === "batch" || form.settings.accessMode === "both" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="text-xs font-medium text-slate-700">Selected batch(es)</div>
              <div className="text-sm text-slate-900">{selectedBatchLabel}</div>
              <div className="text-xs text-slate-600">
                {batchStudentCount} enrolled student{batchStudentCount === 1 ? "" : "s"} can take this test from
                their schedule. Change batches in Basic Settings above.
              </div>
            </div>
          ) : null}

          {form.settings.accessMode === "passcode" || form.settings.accessMode === "both" ? (
            <div className="space-y-2">
              <Label>Passcode</Label>
              <Input
                type="password"
                value={form.passcode}
                onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                placeholder={
                  test.accessPasswordHash ? "Leave blank to keep current passcode" : "Set passcode"
                }
              />
              {test.accessPasswordHash ? (
                <p className="text-xs text-slate-500">A passcode is already set. Enter a new one only to change it.</p>
              ) : null}
              <p className="text-xs text-slate-600">
                {form.settings.accessMode === "both"
                  ? "Unenrolled students can also join at "
                  : "Students join at "}
                <span className="font-mono text-slate-800">/student/join-test</span> with this passcode.
                {form.settings.accessMode === "both"
                  ? " Enrolled students in the selected batch(es) use their normal login — no passcode required."
                  : " They enter name and email before starting; results appear in analytics."}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Time limit (minutes)</Label>
            <Input
              type="number"
              min={1}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>What should test takers enter to identify themselves?</Label>
            <Input
              value={form.settings.identityPrompt}
              onChange={(e) =>
                setForm({ ...form, settings: { ...form.settings, identityPrompt: e.target.value } })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`/admin/tests/${testId}/questions`)}>
          Next: Questions
        </Button>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

function SettingToggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <Checkbox checked={props.checked} onCheckedChange={(v) => props.onChange(Boolean(v))} />
      <span>{props.label}</span>
    </label>
  );
}

