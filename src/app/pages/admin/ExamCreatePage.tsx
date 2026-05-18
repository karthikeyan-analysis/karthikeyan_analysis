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
import { createExamTest } from "../../features/exams/examApi";
import { DEFAULT_EXAM_SETTINGS } from "../../features/exams/settings";

export default function ExamCreatePage() {
  const navigate = useNavigate();
  const { batches } = useData();
  const [creating, setCreating] = useState(false);
  const [testName, setTestName] = useState("demo");
  const [batchId, setBatchId] = useState(batches[0]?.id || "");
  const [subject, setSubject] = useState("");

  const subjects = useMemo(() => {
    const batch = batches.find((b) => b.id === batchId);
    return (batch?.subjects || []).map((s) => s.trim()).filter(Boolean);
  }, [batchId, batches]);

  const create = async () => {
    if (!testName.trim()) {
      alert("Please enter test name.");
      return;
    }
    if (!batchId) {
      alert("Please select a batch.");
      return;
    }
    if (!subject.trim()) {
      alert("Please select or enter a subject.");
      return;
    }
    setCreating(true);
    try {
      const now = Date.now();
      // Keep schedule always-open by default; duration controls per-attempt timer.
      const start = new Date(now - 60_000).toISOString();
      const end = new Date(now + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const id = await createExamTest({
        title: testName.trim(),
        batchId,
        subject: subject.trim(),
        instructions: "",
        startAt: start,
        endAt: end,
        durationMinutes: 60,
        totalQuestions: 0,
        totalMarks: 0,
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
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={(v) => setBatchId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

