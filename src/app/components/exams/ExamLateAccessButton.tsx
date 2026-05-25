import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { updateExamTest } from "../../features/exams/examApi";
import { getExamWindowStatus } from "../../features/exams/examAvailability";
import { guestJoinUrl, isPasscodeGuestTestConfigured } from "../../features/exams/settings";
import type { ExamTest } from "../../features/exams/types";
import { Check, Clock3, Loader2 } from "lucide-react";

type ExamLateAccessButtonProps = {
  test: ExamTest;
  onUpdated: (test: ExamTest) => void;
};

const lateAccessOptions = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
  { value: "1440", label: "1 day" },
];

function studentExamUrl(testId: string) {
  const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  return `${origin}/student/tests/${testId}`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("input");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
}

export function ExamLateAccessButton({ test, onUpdated }: ExamLateAccessButtonProps) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("60");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasPasscodeLink = isPasscodeGuestTestConfigured(test);
  const linkToCopy = hasPasscodeLink ? guestJoinUrl(test.id) : studentExamUrl(test.id);
  const windowStatus = getExamWindowStatus(test);
  const optionLabel = lateAccessOptions.find((option) => option.value === minutes)?.label || `${minutes} minutes`;

  const newEndAt = useMemo(() => {
    const now = Date.now();
    return new Date(now + Number(minutes) * 60 * 1000);
  }, [minutes]);

  const enableLateAccess = async () => {
    const nextEndAt = newEndAt.toISOString();
    setSaving(true);
    try {
      await updateExamTest(test.id, {
        endAt: nextEndAt,
        manuallyClosedAt: null as unknown as string,
      });
      await copyText(linkToCopy);
      setCopied(true);
      onUpdated({
        ...test,
        endAt: nextEndAt,
        manuallyClosedAt: undefined,
      });
      window.setTimeout(() => setCopied(false), 2500);
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert("Could not enable late access. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-blue-700 hover:bg-blue-50"
        onClick={() => setOpen(true)}
        aria-label="Enable late access and copy link"
        title="Enable late access and copy link"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock3 className="w-4 h-4" />}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable late access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reopen <strong>{test.title}</strong> for new starts, clear the manual lock if it was closed,
              extend the test end time, and copy a working link for the student.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-1">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Current: {windowStatus}</Badge>
              <Badge variant="outline">{hasPasscodeLink ? "Passcode link" : "Student login link"}</Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Keep open for</label>
              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lateAccessOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                New end time: {newEndAt.toLocaleString()}. Students still get the normal test duration after they start.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs break-all text-slate-600">
              {linkToCopy}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void enableLateAccess();
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                `Open for ${optionLabel} & copy link`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
