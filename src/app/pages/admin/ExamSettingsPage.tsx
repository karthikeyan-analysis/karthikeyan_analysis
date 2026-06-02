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
import type { ExamAdvancedSettings, ExamTest } from "../../features/exams/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// ── datetime-local helpers ────────────────────────────────────────────────────

function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

// ── types ─────────────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  subject: string;
  batchMode: ExamBatchMode;
  batchIds: string[];
  startAt: string;
  endAt: string;
  durationMinutes: string;
  defaultMarksPerQuestion: QuestionMarkOption;
  negativeMarkPerWrong: string;
  passcode: string;
  settings: Required<ExamAdvancedSettings>;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function ExamSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const testId = id || "";
  const { students, batches } = useData();
  const [test, setTest] = useState<ExamTest | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
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
        setForm({
          title: t.title || "",
          subject: t.subject || "",
          batchMode: inferExamBatchMode(getExamBatchIds(t)),
          batchIds: getExamBatchIds(t),
          startAt: toDatetimeLocal(t.startAt),
          endAt: toDatetimeLocal(t.endAt),
          durationMinutes: String(t.durationMinutes || 60),
          defaultMarksPerQuestion: normalizeQuestionMarks(
            t.defaultMarksPerQuestion,
            DEFAULT_MARKS_PER_QUESTION,
          ) as QuestionMarkOption,
          negativeMarkPerWrong: String(t.negativeMarkPerWrong || 0),
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
    return () => { cancelled = true; };
  }, [testId]);

  const batchStudentCount = useMemo(() => {
    if (!form) return 0;
    const ids = new Set(form.batchIds);
    return students.filter((s) => s.batchId && ids.has(s.batchId)).length;
  }, [form, students]);

  const selectedBatchLabel = useMemo(() => {
    if (!form) return "—";
    return formatExamBatchLabel(
      { batchId: form.batchIds[0] || "", batchIds: form.batchIds },
      batches,
    );
  }, [form, batches]);

  const patch = (partial: Partial<FormState>) =>
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));

  const patchSettings = (partial: Partial<ExamAdvancedSettings>) =>
    setForm((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, ...partial } } : prev,
    );

  const save = async () => {
    if (!form || !test) return;
    if (!form.title.trim()) { alert("Test name is required."); return; }

    let batchFields: { batchId: string; batchIds: string[] };
    try {
      batchFields = normalizeExamBatchFields(form.batchIds);
    } catch {
      alert("Select at least one batch.");
      return;
    }

    if (!form.startAt) { alert("Set a start date for the exam window."); return; }
    if (!form.endAt)   { alert("Set an end date for the exam window."); return; }

    const startAt = fromDatetimeLocal(form.startAt);
    const endAt   = fromDatetimeLocal(form.endAt);

    if (new Date(endAt) <= new Date(startAt)) {
      alert("End date must be after the start date.");
      return;
    }

    if (form.passcode.trim() === "" && !test.accessPasswordHash) {
      alert("Set a passcode — every test requires one.");
      return;
    }

    const settings: ExamAdvancedSettings = applySystemExamSettingLocks({
      ...form.settings,
      accessMode: "both",
      allowedIdentifiers: [],
      allowedEmails: [],
    });

    setSaving(true);
    setSaveStatus("idle");
    try {
      const updates: Partial<ExamTest> = {
        title: form.title.trim(),
        subject: form.subject.trim(),
        batchId: batchFields.batchId,
        batchIds: batchFields.batchIds,
        startAt,
        endAt,
        durationMinutes: Math.max(1, parseInt(form.durationMinutes || "60", 10) || 60),
        defaultMarksPerQuestion: form.defaultMarksPerQuestion,
        negativeMarkPerWrong: form.settings.negativeMarkingEnabled
          ? Math.max(0, parseFloat(form.negativeMarkPerWrong || "0") || 0)
          : 0,
        showAnswersAfter: test.showAnswersAfter || "after_end",
        visibility: "BATCH",
        selectedStudentRecordIds: [],
        settings,
      };

      if (form.passcode.trim()) {
        (updates as Partial<ExamTest> & { accessPasswordHash?: string }).accessPasswordHash =
          await sha256Base64(form.passcode.trim());
      }

      await updateExamTest(testId, updates as Partial<ExamTest> & { accessPasswordHash?: string | null });
      setTest((prev) => (prev ? { ...prev, ...updates } : prev));
      patch({ passcode: "" });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form || !test)
    return <div className="text-sm text-slate-500 py-8 text-center">Loading settings…</div>;

  return (
    <div className="space-y-6">

      {/* ── Sticky header bar ── */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">Setup Test</p>
          <p className="text-xs text-slate-500">
            {test.title} · {selectedBatchLabel} · {batchStudentCount} student{batchStudentCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-rose-600">
              <AlertCircle className="w-4 h-4" /> Save failed
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/tests/${testId}/questions`)}>
            Go to Questions
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* ── 1. Basic Info ── */}
      <Section title="Basic Info">
        <Field label="Test Name" required>
          <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Eco Class Test-05" />
        </Field>

        <Field label="Subject">
          <Input value={form.subject} onChange={(e) => patch({ subject: e.target.value })} placeholder="e.g. Economics" />
        </Field>

        <ExamBatchAssignmentFields
          batches={batches.map((b) => ({ id: b.id, name: b.name }))}
          mode={form.batchMode}
          batchIds={form.batchIds}
          onModeChange={(batchMode) => patch({ batchMode })}
          onBatchIdsChange={(batchIds) =>
            patch({ batchIds, batchMode: inferExamBatchMode(batchIds) })
          }
        />
      </Section>

      {/* ── 2. Exam Window ── */}
      <Section
        title="Exam Window"
        description="When students are allowed to open and start this exam. Outside this window it shows as Upcoming or Closed."
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date & time" required>
            <Input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => patch({ startAt: e.target.value })}
            />
          </Field>
          <Field label="End date & time" required>
            <Input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => patch({ endAt: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Time limit (minutes)" hint="Duration each student gets once they press Start.">
          <Input
            type="number"
            min={1}
            value={form.durationMinutes}
            onChange={(e) => patch({ durationMinutes: e.target.value })}
            className="max-w-[140px]"
          />
        </Field>
      </Section>

      {/* ── 3. Questions ── */}
      <Section title="Questions">
        <QuestionMarksSelect
          value={form.defaultMarksPerQuestion}
          onChange={(v) => patch({ defaultMarksPerQuestion: v })}
          hint="Default marks applied when you add a new question."
        />

        <Toggle
          label="Show all questions on one page"
          description="Off = one question per page (recommended for long exams)."
          checked={form.settings.paginationMode === "all_on_one_page"}
          onChange={(v) => patchSettings({ paginationMode: v ? "all_on_one_page" : "one_per_page" })}
        />

        <Toggle
          label="Randomize question order"
          description="Each student gets questions in a different order."
          checked={form.settings.randomizeQuestionOrder}
          onChange={(v) => patchSettings({ randomizeQuestionOrder: v })}
        />

        <Toggle
          label="Allow blank answers"
          description="Students can submit without answering every question."
          checked={form.settings.allowBlankAnswers}
          onChange={(v) => patchSettings({ allowBlankAnswers: v })}
        />

        <Toggle
          label="Negative marking"
          description="Deduct marks for wrong answers."
          checked={form.settings.negativeMarkingEnabled}
          onChange={(v) => patchSettings({ negativeMarkingEnabled: v })}
        />

        {form.settings.negativeMarkingEnabled && (
          <Field label="Marks deducted per wrong answer">
            <Input
              type="number"
              min={0}
              step={0.25}
              value={form.negativeMarkPerWrong}
              onChange={(e) => patch({ negativeMarkPerWrong: e.target.value })}
              className="max-w-[140px]"
            />
          </Field>
        )}
      </Section>

      {/* ── 4. Access ── */}
      <Section
        title="Access & Passcode"
        description="Enrolled students and unenrolled students using the join link must enter the passcode before starting."
      >
        <Field
          label="Passcode"
          hint={test.accessPasswordHash ? "A passcode is set. Enter a new one only to change it." : undefined}
        >
          <Input
            type="password"
            value={form.passcode}
            onChange={(e) => patch({ passcode: e.target.value })}
            placeholder={test.accessPasswordHash ? "Leave blank to keep current passcode" : "Set passcode"}
            className="max-w-xs"
          />
        </Field>
      </Section>

      {/* ── Footer save ── */}
      <div className="flex justify-end gap-2 pb-8">
        <Button variant="outline" onClick={() => navigate(`/admin/tests/${testId}/questions`)}>
          Next: Questions
        </Button>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Small helper components ────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        className="mt-0.5"
      />
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
    </label>
  );
}
