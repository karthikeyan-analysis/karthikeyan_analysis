import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { sha256Base64 } from "../../features/exams/password";
import { getExamTest, updateExamTest } from "../../features/exams/examApi";
import {
  applySystemExamSettingLocks,
  getEffectiveExamSettings,
  parseCsvList,
} from "../../features/exams/settings";
import type { ExamAccessMode, ExamAdvancedSettings, ExamTest, ExamVisibility } from "../../features/exams/types";

type FormState = {
  title: string;
  instructions: string;
  durationMinutes: string;
  negativeMarkPerWrong: string;
  passcode: string;
  settings: Required<ExamAdvancedSettings>;
  identifierCsv: string;
};

export default function ExamSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const testId = id || "";
  const { students } = useData();
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
        setForm({
          title: t.title || "",
          instructions: t.instructions || "",
          durationMinutes: String(t.durationMinutes || 60),
          negativeMarkPerWrong: String(t.negativeMarkPerWrong || 0),
          passcode: "",
          settings: {
            ...settings,
            // Email-list mode removed from UI; fallback to ID-list for older records.
            accessMode: settings.accessMode === "email_list" ? "identifier_list" : settings.accessMode,
          },
          identifierCsv: (settings.allowedIdentifiers || []).join(", "),
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

  const selectiveStudentIds = useMemo(() => {
    if (!form || !test) return [];
    if (form.settings.accessMode === "identifier_list") {
      const identifiers = new Set(parseCsvList(form.identifierCsv).map((x) => x.toLowerCase()));
      return students
        .filter((s) => s.batchId === test.batchId)
        .filter((s) => identifiers.has((s.studentId || "").toLowerCase()))
        .map((s) => s.id);
    }
    return [];
  }, [form, students, test]);

  const batchStudents = useMemo(() => {
    if (!test) return [];
    return students.filter((s) => s.batchId === test.batchId);
  }, [students, test]);

  const selectedIdentifierSet = useMemo(() => {
    return new Set(parseCsvList(form?.identifierCsv || "").map((x) => x.toLowerCase()));
  }, [form?.identifierCsv]);

  const toggleIdentifier = (studentId: string) => {
    if (!form || !studentId.trim()) return;
    const current = parseCsvList(form.identifierCsv);
    const normalized = studentId.trim().toLowerCase();
    const exists = current.some((x) => x.toLowerCase() === normalized);
    const next = exists
      ? current.filter((x) => x.toLowerCase() !== normalized)
      : [...current, studentId.trim()];
    setForm({ ...form, identifierCsv: next.join(", ") });
  };

  const save = async () => {
    if (!form || !test) return;
    if (!form.title.trim()) {
      alert("Test name is required.");
      return;
    }

    // Schedule is system-managed to keep tests available without manual windows.
    const now = Date.now();
    const startAt = test.startAt || new Date(now - 60_000).toISOString();
    const endAt = test.endAt || new Date(now + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const accessMode = form.settings.accessMode as ExamAccessMode;
    const visibility: ExamVisibility =
      accessMode === "identifier_list" ? "SELECTIVE" : "BATCH";

    const settings: ExamAdvancedSettings = applySystemExamSettingLocks({
      ...form.settings,
      allowedIdentifiers: parseCsvList(form.identifierCsv),
      allowedEmails: [],
    });

    setSaving(true);
    try {
      const updates: Partial<ExamTest> = {
        title: form.title.trim(),
        instructions: form.instructions,
        startAt,
        endAt,
        durationMinutes: Math.max(1, parseInt(form.durationMinutes || "60", 10) || 60),
        negativeMarkPerWrong: form.settings.negativeMarkingEnabled
          ? Math.max(0, parseFloat(form.negativeMarkPerWrong || "0") || 0)
          : 0,
        visibility,
        selectedStudentRecordIds: visibility === "SELECTIVE" ? selectiveStudentIds : [],
        settings,
      };

      const clearPassword = accessMode !== "passcode";
      const wantsPassword = accessMode === "passcode" && form.passcode.trim().length > 0;
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
          <div className="space-y-2">
            <Label>Introduction</Label>
            <Textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              className="min-h-24"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <option value="anyone">Anyone</option>
              <option value="passcode">Anyone who enters a passcode</option>
              <option value="identifier_list">Anyone whose student ID is in my list</option>
            </select>
          </div>

          {form.settings.accessMode === "passcode" ? (
            <div className="space-y-2">
              <Label>Passcode</Label>
              <Input
                type="password"
                value={form.passcode}
                onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                placeholder="Set or change passcode"
              />
            </div>
          ) : null}

          {form.settings.accessMode === "identifier_list" ? (
            <div className="space-y-2">
              <Label>Allowed student IDs (comma separated)</Label>
              <Textarea
                value={form.identifierCsv}
                onChange={(e) => setForm({ ...form, identifierCsv: e.target.value })}
              />
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-slate-700 mb-2">Available students</div>
                <div className="max-h-52 overflow-y-auto space-y-2">
                  {batchStudents.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{s.name}</div>
                        <div className="text-xs text-slate-600 truncate">
                          {s.studentId || "No student ID"} • {s.email}
                        </div>
                      </div>
                      <Checkbox
                        checked={selectedIdentifierSet.has((s.studentId || "").toLowerCase())}
                        onCheckedChange={() => toggleIdentifier(s.studentId || "")}
                        disabled={!s.studentId}
                      />
                    </label>
                  ))}
                  {batchStudents.length === 0 ? (
                    <div className="text-sm text-slate-500">No students found in this batch.</div>
                  ) : null}
                </div>
              </div>
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

